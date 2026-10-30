import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const FLATPAK_EMULATORS={
 'org.libretro.RetroArch':'retroarch',
 'net.rpcs3.RPCS3':'ps3',
 'org.ppsspp.PPSSPP':'psp',
 'net.pcsx2.PCSX2':'ps2',
 'org.duckstation.DuckStation':'ps1',
 'org.DolphinEmu.dolphin-emu':'dolphin',
 'io.mgba.mGBA':'mgba',
 'net.kuribo64.melonDS':'melonds',
 'org.flycast.Flycast':'flycast',
};
function command(env){
 for(const dir of String(env.PATH||'').split(path.delimiter).filter(Boolean)){
  const file=path.join(dir,'flatpak');try{if(!fs.statSync(file).isFile())continue;fs.accessSync(file,fs.constants.X_OK);return file;}catch{}
 }
 return '';
}
const query=(run,exe,args,env)=>String(run(exe,args,{encoding:'utf8',timeout:4000,maxBuffer:1024*1024,env,stdio:['ignore','pipe','pipe']})).trim();
function settings(id,exe,location){return {candidate:'flatpak:'+id,profile:FLATPAK_EMULATORS[id],exe,flatpakId:id,flatpakLocation:location};}
export function discoverFlatpakEmulators({env=process.env,platform=process.platform,run=execFileSync}={}){
 if(platform!=='linux')return [];
 const exe=command(env);if(!exe)return [];
 let ids=[];try{ids=query(run,exe,['list','--app','--columns=application'],env).split(/\r?\n/).map(id=>id.trim());}catch{}
 const home=env.HOME||env.USERPROFILE||os.homedir();
 const dirs=[path.join(env.XDG_DATA_HOME||path.join(home,'.local/share'),'applications'),path.join(home,'.local/share/flatpak/exports/share/applications'),'/var/lib/flatpak/exports/share/applications',...String(env.XDG_DATA_DIRS||'').split(path.delimiter).filter(Boolean).map(d=>path.join(d,'applications'))];
 const exported=new Set();for(const dir of dirs)try{for(const name of fs.readdirSync(dir))if(name.endsWith('.desktop')&&FLATPAK_EMULATORS[name.slice(0,-8)])exported.add(name.slice(0,-8));}catch{}
 for(const id of exported)if(!ids.includes(id))try{query(run,exe,['info','--show-location',id],env);ids.push(id);}catch{}
 return [...new Set(ids)].filter(id=>FLATPAK_EMULATORS[id]).map(id=>{
  let location='';try{location=query(run,exe,['info','--show-location',id],env);}catch{}
  return settings(id,exe,location);
 });
}
export function resolveFlatpakEmulator(candidate,{env=process.env,platform=process.platform,run=execFileSync}={}){
 if(platform!=='linux')return null;
 const id=candidate.startsWith('flatpak:')?candidate.slice(8):path.basename(candidate).replace(/\.desktop$/,'');
 if(!FLATPAK_EMULATORS[id])return null;
 const exe=command(env);if(!exe)return null;
 try{return settings(id,exe,query(run,exe,['info','--show-location',id],env));}catch{return null;}
}
export function flatpakCoreDirectories({home=os.homedir(),env=process.env,flatpakLocation=''}={}){
 const app=path.join(home,'.var/app/org.libretro.RetroArch');
 const dirs=[path.join(app,'config/retroarch/cores'),path.join(app,'data/retroarch/cores')];
 try{const cfg=fs.readFileSync(path.join(app,'config/retroarch/retroarch.cfg'),'utf8');const value=cfg.match(/^libretro_directory\s*=\s*"([^"\r\n]+)"/m)?.[1];if(value&&value!=='default')dirs.unshift(value.startsWith('~/')?path.join(home,value.slice(2)):value);}catch{}
 if(flatpakLocation)dirs.push(path.join(flatpakLocation,'files/lib/libretro'));
 return dirs.filter(dir=>path.isAbsolute(dir));
}
export function flatpakLaunch(launcher,args,game,core){
 if(!launcher.flatpakId)return args;
 if(!FLATPAK_EMULATORS[launcher.flatpakId])throw Error('Perfil de execução inválido.');
 const directory=game.gameRoot||(game.profile==='ps3'?path.dirname(path.dirname(game.path)):path.dirname(game.path));
 const paths=[directory===path.parse(directory).root?game.path:directory,...(core?[path.dirname(core)]:[])];
 for(const file of paths)if(/["\r\n\0]/.test(file))throw Error('Caminho contém caracteres incompatíveis.');
 return 'run '+[...new Set(paths)].map(file=>'"--filesystem='+file+':ro"').join(' ')+' '+launcher.flatpakId+' '+args;
}
