import fs from 'node:fs';
import path from 'node:path';
import {flatpakLaunch} from './flatpak-emulators.mjs';
import {nativeExecutable} from './linux.mjs';
import {windowsPath} from './vdf.mjs';
import {digest} from './files.mjs';
import {executableTitle} from './executable-title.mjs';
import {inspectPSP,parseSFO,reader,isoFile} from './psp.mjs';
import {PROFILES,coreFor} from './emulator-registry.mjs';
import {PLATFORMS,platformByKey,platformFromPath,platformsForExtension,AMBIGUOUS_EXT} from './platforms.mjs';
import {parseRomName,serialFromText,normalizeSerial,cleanPCTitle} from './rom-name.mjs';
import {openDisc,systemCnf,segaDiscHeader} from './disc.mjs';
import {cartridgeHeader,readHead,consoleFromSfo} from './rom-headers.mjs';
import {mainZipEntry} from './zip.mjs';
export {PROFILES};
const PLATFORM_EXT=PLATFORMS.flatMap(p=>p.ext);
export const EXTENSIONS=[...new Set(['exe','iso','cso','pbp','chd','cue','bin','m3u','gcm','rvz','wbfs','ciso','nkit','nes','sfc','smc','gb','gbc','gba','nds','3ds','z64','n64','v64','gen','md','sms','gg','wud','wux','wua','rpx','xex','cci','gdi','cdi','img','wia','gcz',...PLATFORM_EXT])];
// Compactados só entram quando a pasta indica uma plataforma de cartucho/arcade.
const ARCHIVE_EXT=['zip','7z'];
// Perfil inicial da plataforma: o primeiro emulador listado no catálogo que existe no registro.
export function profileForPlatform(key){const p=platformByKey(key);for(const profile of p?.profiles||[])if(PROFILES[profile])return profile;return 'custom';}
function applyPlatform(info,key,source){const p=platformByKey(key);if(!p)return;info.platformKey=p.key;info.platformName=p.name;info.platformSource=source;if(!info.profileLocked)info.profile=profileForPlatform(p.key);}
export function inspectGame(input){
 const file=fs.realpathSync(input),st=fs.statSync(file),ext=path.extname(file).slice(1).toLowerCase(),base=path.basename(file),upper=base.toUpperCase();
 const native=process.platform==='linux'&&nativeExecutable(file);
 const folder=platformFromPath(file),archive=ARCHIVE_EXT.includes(ext);
 if(!st.isFile()||!st.size||(!native&&!EXTENSIONS.includes(ext)&&upper!=='EBOOT.BIN'&&!(archive&&folder)))throw Error('Formato não suportado ou arquivo vazio.');
 const name=parseRomName(file);
 let pbpPS1=false;
 if(['iso','cso','pbp'].includes(ext)){try{const psp=inspectPSP(file);return {...psp,profile:'psp',platformName:PROFILES.psp.platform,platformKey:'psp',platformSource:'header',serial:normalizeSerial(psp.discId),fileTitle:name.title,region:name.regions,languages:name.languages,discNumber:name.disc};}catch(e){if(ext==='pbp'&&/PS1/.test(e.message))pbpPS1=true;else if(ext==='cso'&&/CISO v1|CSO inválido|Bloco CSO/.test(e.message))throw e;}}
 let identitySource=null,internalTitle=null,revision=null;
 const info={profile:'custom',platformName:'Não informada',platformKey:null,platformSource:null};
 if(pbpPS1)applyPlatform(info,'ps1','header');
 let title=name.title||path.basename(file,path.extname(file)),discId='',serial=name.serial||'';
 if(native){info.profile='pc';info.profileLocked=true;info.platformName='Linux';info.platformKey='linux';info.platformSource='header';title=cleanPCTitle(path.basename(file,path.extname(file)))||title;}
 else if(ext==='exe'){
  info.profile='pc';info.profileLocked=true;info.platformName=PROFILES.pc.platform;info.platformKey='pc';info.platformSource='extension';
  if(folder?.platform.key==='dos'){info.profileLocked=false;applyPlatform(info,'dos','folder');}
  const product=executableTitle(file);
  if(product){title=product;internalTitle=product;identitySource='PE ProductName';}
  else title=cleanPCTitle(path.basename(file,path.extname(file)))||title;
  if(/^(game|start|launcher|shipping|win64|play|run|main|app|client)$/i.test(title))title=cleanPCTitle(path.basename(path.dirname(file)))||path.basename(path.dirname(file));
 }
 else if(upper==='EBOOT.BIN'){
  const parent=path.basename(path.dirname(file)).toUpperCase();
  if(parent==='USRDIR'){
   info.profile='ps3';info.platformName='PlayStation 3';info.platformKey='ps3';info.platformSource='header';const sfo=path.join(path.dirname(path.dirname(file)),'PARAM.SFO');
   try{const s=fs.statSync(sfo);if(s.size>1024*1024)throw Error();const m=parseSFO(fs.readFileSync(sfo));title=m.TITLE||path.basename(path.dirname(path.dirname(path.dirname(file))));discId=m.TITLE_ID||'';if(m.TITLE&&m.TITLE_ID&&(!m.CATEGORY||['DG','HG'].includes(m.CATEGORY))){identitySource='PARAM.SFO';internalTitle=m.TITLE;revision=m.APP_VER||m.VERSION||null;}}catch{title=path.basename(path.dirname(path.dirname(path.dirname(file))));}
  }else{
   // PS Vita (Vita3K) e PS4 (shadPS4): pasta instalada com sce_sys/param.sfo.
   const sfo=path.join(path.dirname(file),'sce_sys','param.sfo');
   try{const s=fs.statSync(sfo);if(s.size>1024*1024)throw Error();const m=parseSFO(fs.readFileSync(sfo)),key=consoleFromSfo(m);if(!key)throw Error();applyPlatform(info,key,'header');title=m.TITLE||title;discId=m.TITLE_ID||'';if(m.TITLE&&m.TITLE_ID){identitySource='PARAM.SFO';internalTitle=m.TITLE;revision=m.APP_VER||m.VERSION||null;}}
   catch{throw Error('EBOOT.BIN sem estrutura PS3 reconhecida. Selecione a imagem do jogo ou o EBOOT.PBP.');}
  }
 }
 else if(['wud','wux','wua','rpx'].includes(ext)){info.profile='cemu';info.platformName='Wii U';info.platformKey='wiiu';info.platformSource='extension';if(ext==='rpx'){const meta=path.join(path.dirname(path.dirname(file)),'meta','meta.xml');try{if(fs.statSync(meta).size>1024*1024)throw Error('Metadata muito grande.');const xml=fs.readFileSync(meta,'utf8'),id=xml.match(/<title_id>\s*([a-f0-9]+)\s*<\/title_id>/i)?.[1],label=xml.match(/<longname_en>\s*([^<]+)\s*<\/longname_en>/)?.[1];if(id&&/^0005000[ce]/i.test(id))throw Error('Atualização ou DLC: selecione o jogo base.');if(label){title=label.replaceAll('&amp;','&');discId=id||'';identitySource=discId?'Wii U meta.xml':null;internalTitle=label;}}catch(e){if(/Atualização ou DLC/.test(e.message))throw e;}}}
 else if(ext==='xex'){info.profile='xenia';info.platformName='Xbox 360';info.platformKey='xbox360';info.platformSource='extension';if(title.toLowerCase()==='default')title=parseRomName(path.basename(path.dirname(file))).title;}
 else if(ext==='xbe'){applyPlatform(info,'xbox','extension');if(/^default$/i.test(title))title=parseRomName(path.basename(path.dirname(file))).title;}
 else if(['gcm','rvz','wbfs','ciso','nkit','gcz','wia'].includes(ext)){info.profile='dolphin';info.platformName=ext==='wbfs'?'Wii':'Nintendo GameCube';info.platformKey=ext==='wbfs'?'wii':'gc';info.platformSource='extension';if(folder&&['gc','wii'].includes(folder.platform.key)){info.platformName=folder.platform.name;info.platformKey=folder.platform.key;info.platformSource='folder';}}
 else{
  // Cartuchos: o cabeçalho interno decide a plataforma; a extensão confirma.
  let header=null;
  if(!AMBIGUOUS_EXT.has(ext)||ext==='bin'||ext==='zip'){try{header=cartridgeHeader(ext==='zip'?null:readHead(file),ext);}catch{}}
  if(header){applyPlatform(info,header.platform,'header');if(header.title&&header.title.length>2){internalTitle=header.title;}if(header.serial){discId=header.serial;}}
  else{const byExt=platformsForExtension(ext);if(byExt.length===1)applyPlatform(info,byExt[0].key,'extension');else if(byExt.length>1&&folder&&byExt.some(p=>p.key===folder.platform.key))applyPlatform(info,folder.platform.key,'folder');else if(byExt.length>1)applyPlatform(info,byExt[0].key,'extension');}
 }
 // Imagens de disco: SYSTEM.CNF (PS1/PS2), PARAM.SFO (PS3), cabeçalhos Sega.
 if(['iso','bin','img','cue','cso','gdi','mdf','m3u'].includes(ext)&&!info.platformKey||ext==='iso'){
  let disc;try{disc=openDisc(file);
   try{const cnf=systemCnf(disc);if(cnf){info.profileLocked=false;applyPlatform(info,cnf.platform,'header');discId=cnf.serial;serial=normalizeSerial(cnf.serial);}}catch{}
   if(!info.platformKey)try{const sega=segaDiscHeader(disc);if(sega){applyPlatform(info,sega.platform,'header');serial=sega.serial||serial;if(sega.title&&sega.title.length>2&&!/^(?:SEGA|GAME)\b/i.test(sega.title))internalTitle=sega.title;}}catch{}
   if(ext==='iso')try{const sfo=isoFile(disc.read,['PS3_GAME','PARAM.SFO']);if(sfo){const m=parseSFO(sfo);applyPlatform(info,'ps3','header');info.profile='ps3';title=m.TITLE||title;discId=m.TITLE_ID||'';if(m.TITLE&&discId){identitySource='PARAM.SFO';internalTitle=m.TITLE;revision=m.APP_VER||m.VERSION||null;}}}catch{}
  }catch{}finally{try{disc?.close();}catch{}}
 }
 // Uncompressed GameCube/Wii images expose a magic signature, disc ID and title.
 if(['iso','gcm'].includes(ext)){const fd=fs.openSync(file,'r');try{const h=Buffer.alloc(160),n=fs.readSync(fd,h,0,h.length,0);if(n===160&&(h.readUInt32BE(28)===0xc2339f3d||h.readUInt32BE(24)===0x5d1c9ea3)){info.profile='dolphin';info.platformName=h.readUInt32BE(24)===0x5d1c9ea3?'Wii':'Nintendo GameCube';info.platformKey=h.readUInt32BE(24)===0x5d1c9ea3?'wii':'gc';info.platformSource='header';discId=h.toString('ascii',0,6);const label=h.toString('utf8',32).split('\0')[0].trim();if(label&&/^[A-Z0-9]{6}$/.test(discId)){title=label;internalTitle=label;identitySource='Disc header';revision=String(h[7]);}}}finally{fs.closeSync(fd);}}
 if(ext==='gdi'&&!info.platformKey)applyPlatform(info,'dreamcast','extension');
 // A pasta só decide quando o conteúdo não identificou (CHD, ZIP, ISO genérica, .bin de cartucho).
 if(!info.platformKey&&folder){applyPlatform(info,folder.platform.key,'folder');}
 if(archive&&folder){try{const entry=mainZipEntry(file);if(entry)title=parseRomName(entry.name).title||title;}catch{}}
 if(info.platformName==='Não informada'&&PROFILES[info.profile])info.platformName=PROFILES[info.profile].platform;
 if(!serial&&discId)serial=normalizeSerial(discId);
 delete info.profileLocked;
 return {id:digest(windowsPath(file)).slice(0,20),path:file,title:title||'Jogo',bytes:st.size,sizeBasis:['pc','ps3','vita3k','shadps4'].includes(info.profile)?'Tamanho do arquivo executável selecionado; não representa a instalação completa.':null,mtime:st.mtimeMs,profile:info.profile,platformName:info.platformName,platformKey:info.platformKey,platformSource:info.platformSource,discId,serial,internalTitle,identitySource,revision,fileTitle:name.title,region:name.regions,languages:name.languages,discNumber:name.disc,needsReview:info.profile==='custom',art:{}};
}
// Discovery excludes helpers; identity resolution decides which candidates can be imported automatically.
const AUX_EXE=/^(?:unins\d*|uninstall.*|setup.*|install.*|update.*|patcher.*|vcredist.*|vc_redist.*|dxsetup|dxwebsetup|crash.*|unitycrashhandler.*|ue4prereq.*|dotnet.*|report.*|cef.*|chrome.*|notification.*|service.*|helper.*|7z.*|ffmpeg.*|python.*|node|steam|steamservice|steamwebhelper|ppsspp.*|rpcs3.*|pcsx2.*|duckstation.*|dolphin.*|retroarch.*|cemu.*|xenia.*|mgba.*|melonds.*|vita3k.*|shadps4.*|ryujinx.*|yuzu.*|citron.*|eden.*|sudachi.*|azahar.*|lime3ds.*|citra.*|flycast.*|redream.*|xemu.*|mesen.*|snes9x.*|project64.*|mame.*|dosbox.*|emuhawk.*|ares.*)\.exe$/i;
const AUX_DIR=/^(?:node_modules|\.git|redist|_CommonRedist|__Installer|Installer|Installers|Prerequisites|Engine|CrashReportClient|Support|Tools|Drivers|DirectX|dotnet|WebView2|cef|cache|shadercache|saves|savestates|states|screenshots|cheats|bios|shaders|textures|manuals|downloaded_images|downloaded_media|covers|snaps|boxart|marquees|wheel|videos)$/i;
// Extensões genéricas (usadas também por outros programas) só contam dentro de pasta da plataforma.
const GENERIC_EXT=new Set(['md','int','min','ws','col','sg','bs','fig','vb','wad','pc2','dsi','swc','agb','dmg','cgb','sgb','unf','unif','ndd','mx1','mx2','sgx','lyx','jag','img','cia','3dsx']);
export const auxiliaryExecutable=file=>AUX_EXE.test(path.basename(file));
export function suggestedGameRoot(file){
 let dir=path.dirname(file);
 while(/^(bin|binaries|win32|win64|x64|x86|release)$/i.test(path.basename(dir)))dir=path.dirname(dir);
 if(dir===path.parse(dir).root||/^(games|jogos|downloads|desktop|documents|common|steamapps|program files(?: \(x86\))?|windows|users|temp|tmp)$/i.test(path.basename(dir)))return null;
 return dir;
}
const CARTRIDGE_BIN=new Set(['genesis','sega32x','atari2600','atari7800','colecovision','intellivision','sms','gamegear','sg1000','pce','lynx','jaguar','msx','wonderswan','wonderswancolor','ngp','ngpc']);
export function scanGames(root,errors=[]){
 const out=[];let visited=0;
 const walk=(p,depth)=>{if(depth>12||++visited>30000)throw Error('Pasta muito grande. Escolha uma pasta mais específica.');const s=fs.lstatSync(p);if(s.isSymbolicLink())return;
  if(s.isDirectory()){
   const boot=path.join(p,'PS3_GAME','USRDIR','EBOOT.BIN');if(fs.existsSync(boot)){out.push(boot);return;}
   // Jogos instalados de PS Vita/PS4 (Vita3K, shadPS4): eboot.bin ao lado de sce_sys/param.sfo.
   const sce=path.join(p,'sce_sys','param.sfo');if(fs.existsSync(sce)){const eboot=fs.readdirSync(p).find(n=>n.toLowerCase()==='eboot.bin');if(eboot){out.push(path.join(p,eboot));return;}}
   for(const name of fs.readdirSync(p)){if(AUX_DIR.test(name))continue;if(visited>=30000){errors.push({file:p,message:'Limite de leitura atingido. Escolha uma pasta menor para ver os demais candidatos.'});break;}try{walk(path.join(p,name),depth+1);}catch(e){if(errors.length<100)errors.push({file:path.join(p,name),message:e.message});}}}
  else{const ext=path.extname(p).slice(1).toLowerCase();if(ext==='pkg'){if(errors.length<100)errors.push({file:p,message:'Pacote de instalação: instale no emulador e importe a pasta instalada. PKG não é um executável do jogo.'});return;}
   if(ARCHIVE_EXT.includes(ext)){const folder=ext==='zip'?platformFromPath(p)?.platform:null;if(folder&&(folder.key==='arcade'||folder.hash&&!['psp','ps1','ps2','segacd','saturn'].includes(folder.hash)))out.push(p);return;}
   if(!EXTENSIONS.includes(ext)&&!(process.platform==='linux'&&nativeExecutable(p)))return;
   if(GENERIC_EXT.has(ext)){const folder=platformFromPath(p)?.platform;if(!folder||!folder.ext.includes(ext)&&!(ext==='img'&&folder.dat.some(d=>d[0]==='redump')))return;}
   if(depth>0&&ext==='bin'&&path.basename(p).toUpperCase()!=='EBOOT.BIN'){const folder=platformFromPath(p);if(!folder||!CARTRIDGE_BIN.has(folder.platform.key))return;}
   if(depth>0&&ext==='exe'&&auxiliaryExecutable(p))return;out.push(p);}
 };walk(root,0);
 return finalizeCandidates(out);
}
// Remove trilhas referenciadas por .cue/.gdi/.m3u e discos extras do mesmo jogo.
function finalizeCandidates(out){
 const referenced=new Set();for(const f of out.filter(f=>/\.(cue|m3u|gdi)$/i.test(f))){if(fs.statSync(f).size>1024*1024)continue;const content=fs.readFileSync(f,'utf8');const names=/\.cue$/i.test(f)?[...content.matchAll(/FILE\s+(?:"([^"]+)"|(\S+))\s+/gi)].map(m=>m[1]||m[2]):/\.gdi$/i.test(f)?content.split(/\r?\n/).slice(1).map(l=>l.match(/^\s*\d+\s+\d+\s+\d+\s+\d+\s+(?:"([^"]+)"|(\S+))/)).filter(Boolean).map(m=>m[1]||m[2]):content.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#'));for(const n of names)referenced.add(path.resolve(path.dirname(f),n.trim()).toLowerCase());}
 const files=out.filter(f=>!referenced.has(path.resolve(f).toLowerCase()));
 // Jogos de vários discos sem .m3u: mantém o Disco 1 e registra os demais como discos extras.
 const groups=new Map();for(const f of files){const n=parseRomName(f);if(n.disc===null||!/^(?:cue|chd|iso|bin|img|pbp|cso|gdi)$/i.test(n.ext))continue;const key=path.dirname(f).toLowerCase()+'|'+n.title.toLowerCase()+'|'+n.regions.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push({f,disc:n.disc});}
 const extra=new Set();for(const list of groups.values()){if(list.length<2)continue;list.sort((a,b)=>String(a.disc).localeCompare(String(b.disc),undefined,{numeric:true}));for(const item of list.slice(1))extra.add(item.f);}
 return files.filter(f=>!extra.has(f));
}
// Varredura ampla (busca automática): pastas do usuário e unidades inteiras, com orçamento de tempo e de pastas.
// Diferente de scanGames, não aceita .exe soltos nem extensões genéricas fora de uma pasta de plataforma, e nunca
// aborta por pasta grande, só para quando o orçamento acaba. A prova de que é jogo vem depois, do cabeçalho.
const SWEEP_SKIP=/^(?:windows|windows\.old|program files|program files \(x86\)|programdata|\$recycle\.bin|\$windows\.~bt|\$windows\.~ws|system volume information|recovery|perflogs|msocache|config\.msi|intel|amd|nvidia|drivers|appdata|application data|local settings|steamapps|node_modules|\.git|\.svn|\.cache|\.vscode|venv|site-packages|__pycache__|temp|tmp|cache|caches|shadercache|logs|winsxs|onedrivetemp|dropbox\.cache|xboxgames|windowsapps|ea app|ea games|epic games|origin games|ubisoft game launcher|battle\.net|riot games|gog galaxy)$/i;
export function sweepGames(roots,{maxDirs=60000,maxMs=45000,maxDepth=7,errors=[],skipPaths=[]}={}){
 const out=[],started=Date.now(),skip=new Set(skipPaths.map(p=>path.resolve(p).toLowerCase()));let dirs=0,stopped=false;
 const consider=(p,ext,size)=>{
  if(ext==='exe'||ext==='pkg'||size<16*1024)return;
  if(ARCHIVE_EXT.includes(ext)){const folder=platformFromPath(p)?.platform;if(folder&&(folder.key==='arcade'||folder.hash&&!['psp','ps1','ps2','segacd','saturn'].includes(folder.hash)))out.push(p);return;}
  if(!EXTENSIONS.includes(ext))return;
  if(GENERIC_EXT.has(ext)){const folder=platformFromPath(p)?.platform;if(!folder||!folder.ext.includes(ext)&&!(ext==='img'&&folder.dat.some(d=>d[0]==='redump')))return;}
  if(ext==='bin'&&path.basename(p).toUpperCase()!=='EBOOT.BIN'){const folder=platformFromPath(p);if(!folder||!CARTRIDGE_BIN.has(folder.platform.key))return;}
  out.push(p);
 };
 const walk=(dir,depth)=>{
  if(stopped||depth>maxDepth)return;if(++dirs>maxDirs||Date.now()-started>maxMs){stopped=true;errors.push({file:dir,message:'Busca automática interrompida pelo limite de tempo; pastas restantes não foram lidas.'});return;}
  if(skip.has(path.resolve(dir).toLowerCase())&&depth>0)return;
  let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
  if(entries.some(e=>e.isDirectory()&&e.name==='PS3_GAME')){const boot=path.join(dir,'PS3_GAME','USRDIR','EBOOT.BIN');if(fs.existsSync(boot)){out.push(boot);return;}}
  if(entries.some(e=>e.isDirectory()&&e.name.toLowerCase()==='sce_sys')&&fs.existsSync(path.join(dir,'sce_sys','param.sfo'))){const eboot=entries.find(e=>e.isFile()&&e.name.toLowerCase()==='eboot.bin');if(eboot){out.push(path.join(dir,eboot.name));return;}}
  for(const e of entries){if(stopped)return;const p=path.join(dir,e.name);
   if(e.isSymbolicLink())continue;
   if(e.isDirectory()){if(SWEEP_SKIP.test(e.name)||AUX_DIR.test(e.name)||e.name.startsWith('.'))continue;walk(p,depth+1);continue;}
   if(!e.isFile())continue;const ext=path.extname(e.name).slice(1).toLowerCase();if(!ext)continue;
   if(!EXTENSIONS.includes(ext)&&!ARCHIVE_EXT.includes(ext))continue;
   let size=0;try{size=fs.statSync(p).size;}catch{continue;}consider(p,ext,size);
  }
 };
 for(const root of roots){if(stopped)break;try{if(fs.statSync(root).isDirectory())walk(root,0);}catch{}}
 return finalizeCandidates(out);
}
// Outros discos do mesmo jogo (para mostrar na ficha e montar a lista do emulador).
export function siblingDiscs(file){try{const n=parseRomName(file);if(n.disc===null)return [];return fs.readdirSync(path.dirname(file)).filter(name=>{const m=parseRomName(name);return m.disc!==null&&m.title.toLowerCase()===n.title.toLowerCase()&&m.ext===n.ext;}).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(name=>path.join(path.dirname(file),name));}catch{return [];}}
export function measureGameFolder(input){
 const root=fs.realpathSync(input);if(!fs.statSync(root).isDirectory()||root===path.parse(root).root||/^(windows|users|program files(?: \(x86\))?|games|jogos|downloads|desktop|common|steamapps)$/i.test(path.basename(root)))throw Error('Escolha a pasta de um único jogo, não a biblioteca ou o disco inteiro.');
 let bytes=0,files=0,entries=0;const stack=[root];while(stack.length){const dir=stack.pop();for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(++entries>200000)throw Error('Pasta muito grande para medir. Escolha somente a pasta deste jogo.');const file=path.join(dir,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())stack.push(file);else if(entry.isFile()){bytes+=fs.statSync(file).size;files++;}}}return {root,bytes,files,at:new Date().toISOString()};
}
export function launchFor(g,config,demoExecutable){
 if(g.demo)return {exe:demoExecutable,args:'--taiga-demo '+g.id};
 const profile=g.profile||'psp';if(!PROFILES[profile])throw Error('Perfil de execução inválido.');
 if(profile==='pc'){if(process.platform==='linux'&&nativeExecutable(g.path))return {exe:g.path,args:g.launch?.args||''};if(!/\.exe$/i.test(g.path))throw Error('Selecione um executável compatível com o sistema.');return {exe:g.path,args:g.launch?.args||''};}
 // Jogos de lojas que exigem o próprio iniciador (Epic gerenciado, Ubisoft, Amazon): abre o link da loja.
 if(profile==='store'){const exe=g.launch?.exe;if(!exe||!fs.existsSync(exe))throw Error('Iniciador da loja não encontrado para '+g.title);const args=String(g.launch?.args||'');if(/[\r\n\0"]/.test(args))throw Error('Link da loja inválido.');
  // Riot Client: argumentos de produto (não é um link). Xbox: shell:AppsFolder\<família>!<app>.
  if(/^riotclientservices\.exe$/i.test(path.basename(exe))&&/^--launch-product=[\w-]+ --launch-patchline=[\w-]+$/.test(args))return {exe,args};
  if(!/^(?:com\.epicgames\.launcher|uplay|amazon-games|goggalaxy|steam|heroic|battlenet|link2ea|origin2):\/\//.test(args)&&!/^shell:AppsFolder\\[\w.-]+_[0-9a-z]{13}![\w.-]+$/.test(args))throw Error('Link da loja inválido.');return {exe,args:'"'+args+'"'};}
 const defaults=config.launchers?.[profile]||{},exe=g.launch?.exe||defaults.exe||(profile==='psp'?config.emulator:'');if(!exe||!fs.existsSync(exe)||!fs.statSync(exe).isFile())throw Error('Configure o executável de '+PROFILES[profile].name+' em Como executar: '+g.title);
 const flatpak=g.launch?.flatpakId?g.launch:(!g.launch?.exe||g.launch.exe===defaults.exe?defaults:{});
 let args=g.launch?.args??defaults.args??PROFILES[profile].args,core=g.launch?.core||defaults.core||(profile==='retroarch'?coreFor(g,exe,flatpak):'');
 if(!/\{(?:game|titleid|stem)\}/.test(args))throw Error('Os argumentos precisam conter {game}.');if(args.includes('{core}')&&(!core||!fs.existsSync(core)))throw Error('Selecione o núcleo do RetroArch para '+g.title);
 const titleId=String(g.discId||'').toUpperCase().replace(/[^A-Z0-9]/g,''),stem=path.basename(g.path,path.extname(g.path)),dir=path.dirname(g.path);
 if(args.includes('{titleid}')&&!/^[A-Z0-9]{9}$/.test(titleId))throw Error('O código do jogo (Title ID) não foi encontrado para '+g.title);
 for(const v of [g.path,exe,core,dir])if(/["\r\n\0]/.test(v))throw Error('Caminho contém caracteres incompatíveis.');args=args.replaceAll('{game}',g.path).replaceAll('{core}',core).replaceAll('{titleid}',titleId).replaceAll('{stem}',stem).replaceAll('{dir}',dir);if(/[\r\n\0]/.test(args))throw Error('Argumentos inválidos.');return {exe,args:flatpakLaunch(flatpak,args,g,core)};
}
