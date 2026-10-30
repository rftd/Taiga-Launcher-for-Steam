import {windowsPath} from './vdf.mjs';
import fs from 'node:fs';import path from 'node:path';
const exists=file=>{try{return fs.statSync(file).isFile();}catch{return false;}};
export function relocationMatches(game,item){if(game.demo||game.notInstalled||exists(game.path)||(game.profile||'psp')!==item.profile||game.bytes!==item.bytes)return false;if(game.fingerprint)return game.fingerprint===item.fingerprint&&(item.fingerprintKind==='full'||path.basename(game.path).toLowerCase()===path.basename(item.path).toLowerCase());return !!game.discId&&game.discId===item.discId;}
export function reconcile(games,items){const moved=[],changed=[],pending=[];
 for(const item of items){const existing=games.find(g=>!g.demo&&windowsPath(g.path)===windowsPath(item.path));if(existing){const different=existing.bytes!==item.bytes||existing.mtime!==item.mtime||existing.fingerprint&&existing.fingerprint!==item.fingerprint;existing.fingerprint=item.fingerprint;existing.fingerprintKind=item.fingerprintKind;if(different){existing.bytes=item.bytes;existing.mtime=item.mtime;existing.discId=item.discId;changed.push(existing.id);}continue;}pending.push(item);}
 const matches=new Map(pending.map(item=>[item,games.filter(g=>relocationMatches(g,item))])),counts=new Map();for(const list of matches.values())for(const g of list)counts.set(g,(counts.get(g)||0)+1);const added=[];
 for(const item of pending){const list=matches.get(item);if(list.length===1&&counts.get(list[0])===1){const g=list[0];moved.push({id:g.id,title:g.title,from:g.path,to:item.path});g.path=item.path;delete g.installedBytes;delete g.gameRoot;g.mtime=item.mtime;g.fingerprint=item.fingerprint;g.fingerprintKind=item.fingerprintKind;continue;}added.push(item);}
 return {items:added,moved,changedIds:changed};
}
export function inventoryCandidates(files,games){return files.filter(file=>{const g=games.find(g=>!g.demo&&windowsPath(g.path)===windowsPath(file));if(!g||!g.fingerprint)return true;try{const stat=fs.statSync(file);return stat.size!==g.bytes||stat.mtimeMs!==g.mtime;}catch{return true;}});}
// Mesmo jogo já na coleção, mesmo vindo de outro caminho. Só regras que provam a identidade:
//  - mesmo código do disco/cartucho (lido do cabeçalho: PARAM.SFO do PSP, SYSTEM.CNF do PS1/PS2, etc.) na mesma plataforma;
//  - arquivo idêntico (impressão digital completa igual);
//  - mesmo arquivo por outro caminho (atalho, letra de unidade, maiúsculas/minúsculas, caminho real);
//  - mesmo jogo da mesma loja (Epic, GOG, Xbox...) ou o mesmo AppID da Steam num jogo de PC.
// Versões diferentes (outra região = outro código) continuam permitidas.
const real=file=>{try{return windowsPath(fs.realpathSync.native(file));}catch{return windowsPath(file);}};
const serialKey=v=>String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const platformKeyOf=g=>g.platformKey||g.profile||'';
// Port de PC (ex.: God of War III do SpartanPort) e a pasta do jogo de console que ele usa (o dump do PS4): é o mesmo
// jogo. A versão de emulador vira parte do port em vez de um segundo jogo na coleção.
const inside=(file,dir)=>{const f=real(file),d=real(dir).replace(/[\\/]+$/,'');return !!d&&(f===d||f.startsWith(d+'\\')||f.startsWith(d+'/'));};
export function portTwinOf(games,item,portOf){
 if(!portOf||['pc','store','custom'].includes(item.profile||'psp')||!item.path)return null;
 const code=serialKey(item.serial||item.discId);
 for(const g of games){if(g===item||g.demo||g.native||g.hidden||!['pc','custom'].includes(g.profile))continue;let port=null;try{port=portOf(g);}catch{}if(!port)continue;
  if((port.dump&&inside(item.path,port.dump))||(code.length>=9&&serialKey(port.code)===code))return {game:g,port};}
 return null;
}
export function duplicateOf(games,item,{steamAppIdOf=g=>Number(g.steamLink?.appId||g.metadataSteamAppId||0)||null,portOf=null}={}){
 {const twin=portTwinOf(games,item,portOf);if(twin)return {game:twin.game,reason:'port'};}
 const p=real(item.path),serial=item.platformSource==='header'?serialKey(item.serial||item.discId):'';
 for(const g of games){
  if(g.demo||g.native||!g.path)continue;
  if(windowsPath(g.path)===windowsPath(item.path))return {game:g,reason:'path'};
  if(real(g.path)===p)return {game:g,reason:'path'};
  if(serial&&serial.length>=6&&platformKeyOf(g)===platformKeyOf(item)&&(serialKey(g.serial)===serial||serialKey(g.discId)===serial))return {game:g,reason:'serial'};
  // Executáveis do Windows iguais não são o mesmo jogo (muitos jogos Unity/Godot usam o mesmo .exe).
  if(item.fingerprint&&item.fingerprintKind==='full'&&g.fingerprintKind==='full'&&g.fingerprint===item.fingerprint&&g.bytes===item.bytes&&(g.profile||'psp')===(item.profile||'psp')&&!['pc','store','custom'].includes(item.profile||'psp'))return {game:g,reason:'identical'};
  if(item.store?.name&&item.store.id&&g.store?.name===item.store.name&&String(g.store.id)===String(item.store.id))return {game:g,reason:'store'};
  const sid=Number(item.steamAppId)||0;if(sid&&['pc','store','custom'].includes(g.profile)&&steamAppIdOf(g)===sid)return {game:g,reason:'steam'};
 }
 return null;
}
