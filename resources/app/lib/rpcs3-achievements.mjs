import os from 'node:os';
import fs from 'node:fs';import path from 'node:path';import {digest} from './files.mjs';import {titleKey} from './metadata.mjs';
const present=f=>{try{return fs.statSync(f).isFile();}catch{return false;}};
const read=(f,max=8*1024*1024)=>{if(fs.statSync(f).size>max)throw Error('Arquivo de troféus muito grande.');return fs.readFileSync(f);};
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp<=0x10ffff?String.fromCodePoint(cp):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').trim();
export function parseTrophyXML(bytes){const xml=bytes.toString('utf8'),tag=(body,name)=>decode(body.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)</'+name+'>','i'))?.[1]);if(!/<trophyconf\b/i.test(xml))throw Error('Definições de troféus inválidas.');const achievements=[],ids=new Set();for(const m of xml.matchAll(/<trophy\b([^>]*)>([\s\S]*?)<\/trophy>/gi)){const attrs=Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1],a[2]]));if(!/^\d+$/.test(attrs.id||'')||ids.has(attrs.id))continue;ids.add(attrs.id);achievements.push({id:attrs.id,title:tag(m[2],'name'),description:tag(m[2],'detail'),grade:attrs.ttype||'B',hidden:/^(yes|1|true)$/i.test(attrs.hidden||'')});if(achievements.length>4096)throw Error('Número de troféus inválido.');}return {title:tag(xml,'title-name'),achievements};}
export function parseTrophyProgress(bytes){if(bytes.length<48||bytes.readUInt32BE(0)!==0x818f54ad)throw Error('TROPUSR.DAT inválido.');const tables=bytes.readUInt32BE(8);if(tables>32||48+tables*32>bytes.length)throw Error('Índice de troféus inválido.');const result=new Map();for(let n=0;n<tables;n++){const h=48+n*32,type=bytes.readUInt32BE(h),size=bytes.readUInt32BE(h+4),count=bytes.readUInt32BE(h+12),offset=Number(bytes.readBigUInt64BE(h+16)),stride=size+16;if(type!==6)continue;if(!Number.isSafeInteger(offset)||count>4096||stride<48||stride>4096||offset+count*stride>bytes.length)throw Error('Tabela de progresso truncada.');for(let i=0;i<count;i++){const at=offset+i*stride,id=String(bytes.readUInt32BE(at+16)),state=bytes.readUInt32BE(at+20),tick=bytes.readBigUInt64BE(at+40);result.set(id,{unlocked:state===1,date:tick?tick.toString():null});}}return result;}
const list=folder=>{try{return fs.readdirSync(folder).slice(0,2000);}catch{return [];}};
const setName=/^NPWR\d+_\d+$/i;
export function rpcs3Roots(game,config,{env=process.env,home=env.HOME||env.USERPROFILE||os.homedir(),platform=process.platform}={}){
 const explicit=game.achievementSettings?.path||config.rpcs3Root;
 if(explicit)return [present(explicit)?path.dirname(explicit):explicit];
 const roots=[];
 for(const exe of [game.launch?.exe,config.launchers?.ps3?.exe].filter(Boolean)){const base=path.dirname(exe);roots.push(path.join(base,'portable'),base);}
 if(platform==='linux')roots.push(path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'rpcs3'),path.join(home,'.var/app/net.rpcs3.RPCS3/config/rpcs3'));
 if(platform==='win32'&&env.RPCS3_CONFIG_DIR)roots.unshift(env.RPCS3_CONFIG_DIR);
 return [...new Set(roots)];
}
function gameTrophySets(game){
 const roots=new Set([game.gameRoot].filter(Boolean));
 if(game.path){let base=path.dirname(game.path);for(let i=0;i<3;i++){roots.add(base);base=path.dirname(base);}}
 const result=new Set();
 for(const root of roots)for(const suffix of ['TROPDIR','PS3_GAME/TROPDIR']){
  const base=path.join(root,suffix);
  for(const name of list(base)){
   if(setName.test(name)&&present(path.join(base,name,'TROPHY.TRP')))result.add(name.toUpperCase());
   else if(/^NPWR\d+_\d+\.TRP$/i.test(name))result.add(name.replace(/\.TRP$/i,'').toUpperCase());
  }
 }
 return result;
}
export function readRPCS3(game,config,dir,options={}){
 const opts=game.achievementSettings||{},language=config.language||'pt-BR',roots=rpcs3Roots(game,config,options),folders=new Set();
 const addFolder=folder=>{if(present(path.join(folder,'TROPCONF.SFM')))try{folders.add(fs.realpathSync(folder));}catch{}};
 const addSets=base=>{for(const name of list(base))if(setName.test(name))addFolder(path.join(base,name));};
 for(const root of roots){
  addFolder(root);addSets(root);addSets(path.join(root,'trophy'));
  const hdds=[path.join(root,'dev_hdd0'),root];
  for(const vfs of [path.join(root,'config/vfs.yml'),path.join(root,'vfs.yml')])if(present(vfs)){
   const text=read(vfs,1024*1024).toString(),raw=text.match(/^(?:["']?\/dev_hdd0\/?["']?|dev_hdd0)\s*:\s*(.+)$/m)?.[1]?.trim();
   if(!raw)continue;
   const quoted=/^["']/.test(raw),end=quoted?raw.indexOf(raw[0],1):-1;if(quoted&&end<1)continue;
   const value=quoted?raw.slice(1,end):raw.replace(/\s+#.*$/,'').trim(),expanded=value.replace(/\$\(EmulatorDir\)/g,root+path.sep);
   if(expanded)hdds.push(path.isAbsolute(expanded)?expanded:path.resolve(path.dirname(vfs),expanded));
  }
  for(const hdd of hdds)addSets(path.join(hdd,'home',String(config.rpcs3User||'00000001'),'trophy'));
 }
 const sets=[];for(const folder of folders)try{const def=parseTrophyXML(read(path.join(folder,'TROPCONF.SFM')));sets.push({folder,...def});}catch{}
 const gameSets=gameTrophySets(game);
 let matches=opts.trophySet?sets.filter(s=>path.basename(s.folder).toUpperCase()===opts.trophySet.toUpperCase()):gameSets.size?sets.filter(s=>gameSets.has(path.basename(s.folder).toUpperCase())):sets.filter(s=>{const names=new Set([game.internalTitle,game.title].filter(Boolean).map(titleKey));if(names.has(titleKey(s.title)))return true;for(const name of list(s.folder))if(/^TROP_\d{2}\.SFM$/i.test(name))try{if(names.has(titleKey(parseTrophyXML(read(path.join(s.folder,name))).title)))return true;}catch{}return false;});if(opts.path&&present(path.join(roots[0],'TROPCONF.SFM')))matches=sets.filter(s=>s.folder===fs.realpathSync(roots[0]));
 if(matches.length!==1)return {status:matches.length?'ambiguous':'unmapped',provider:'rpcs3',source:'RPCS3',achievements:[],total:0,unlocked:0,candidates:sets.map(s=>({id:path.basename(s.folder),name:s.title}))};
 const chosen=matches[0],index={'pt-BR':17,en:1,es:3,fr:2,de:4}[language],localized=path.join(chosen.folder,'TROP_'+String(index).padStart(2,'0')+'.SFM');let schema=chosen,sourceLanguage='en';if(present(localized)){schema=parseTrophyXML(read(localized));sourceLanguage=language;}
 const progressFile=path.join(chosen.folder,'TROPUSR.DAT'),progress=present(progressFile)?parseTrophyProgress(read(progressFile)):new Map();const achievements=schema.achievements.map(a=>{const file=path.join(chosen.folder,'TROP'+String(a.id).padStart(3,'0')+'.PNG');let icon='';if(present(file)){const bytes=read(file,4*1024*1024);if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){const name=digest(bytes)+'.png',dest=path.join(dir,'art',name);fs.mkdirSync(path.dirname(dest),{recursive:true});if(!present(dest))fs.writeFileSync(dest,bytes);icon='/art/'+name;}}return {...a,...(progress.get(String(Number(a.id)))||{unlocked:false,date:null}),icon};});return {status:'ok',provider:'rpcs3',source:'RPCS3',sourceLanguage,progressKnown:present(progressFile),achievements,total:achievements.length,unlocked:achievements.filter(a=>a.unlocked).length,trophySet:path.basename(chosen.folder)};
}
