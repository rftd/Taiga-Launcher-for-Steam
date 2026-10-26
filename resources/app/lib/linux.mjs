import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

export function steamCandidates({home=os.homedir(),env=process.env}={}){
 const data=env.XDG_DATA_HOME||path.join(home,'.local/share');
 return [path.join(home,'.steam/steam'),path.join(data,'Steam'),path.join(home,'.steam/root'),path.join(home,'.var/app/com.valvesoftware.Steam/.local/share/Steam')];
}
export function detectSteam(options){return steamCandidates(options).find(dir=>{try{return fs.statSync(path.join(dir,'config')).isDirectory()&&fs.statSync(path.join(dir,'steamapps')).isDirectory();}catch{return false;}})||'';}
export function steamInstalled(dir){if(!dir)return false;try{return ['steam.sh','steam.exe'].some(name=>fs.existsSync(path.join(dir,name)))||(fs.statSync(path.join(dir,'config')).isDirectory()&&fs.statSync(path.join(dir,'steamapps')).isDirectory());}catch{return false;}}
export function flatpakSteam(dir){return path.resolve(dir).split(path.sep).includes('com.valvesoftware.Steam');}
export function steamCommand(dir,args=[]){
 if(flatpakSteam(dir))return {exe:'flatpak',args:['run','com.valvesoftware.Steam',...args]};
 const local=path.join(dir,'steam.sh');
 return {exe:fs.existsSync(local)?local:'steam',args};
}
export function hostLaunch(exe,args,dir,dataDir){
 if(!flatpakSteam(dir))return {exe,args};
 if(/["\r\n\0]/.test(exe))throw Error('Caminho contém caracteres incompatíveis.');
 if(dataDir&&/["\r\n\0]/.test(dataDir))throw Error('Caminho contém caracteres incompatíveis.');
 return {exe:'/usr/bin/flatpak-spawn',args:'--host '+(dataDir?'"--env=TAIGA_DATA='+dataDir+'" ':'')+'"'+exe+'" '+args};
}
export function processes({proc='/proc',uid=process.getuid?.()}={}){
 const rows=[];let names;try{names=fs.readdirSync(proc);}catch{return rows;}
 for(const name of names){if(!/^\d+$/.test(name))continue;try{
  const base=path.join(proc,name);if(uid!==undefined&&fs.statSync(base).uid!==uid)continue;
  const comm=fs.readFileSync(path.join(base,'comm'),'utf8').trim();
  // Read command lines only for Steam, never for unrelated user processes.
  if(comm==='steam'||comm==='steamwebhelper')rows.push({pid:Number(name),name:comm,args:fs.readFileSync(path.join(base,'cmdline'),'utf8').split('\0').filter(Boolean)});
 }catch{}}
 return rows;
}
export function startSteam(dir,port=8080){const cmd=steamCommand(dir,['-cef-enable-debugging','-devtools-port',String(port)]);const child=spawn(cmd.exe,cmd.args,{detached:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}
export function desktopEntry(executable,{hidden=false}={}){
 if(/[\r\n\0]/.test(executable))throw Error('Caminho inválido.');
 // Desktop Entry Exec quoting has two levels: string escapes, then argument escapes.
 const quoted='"'+executable.replace(/[\\"`$]/g,c=>'\\'+c).replace(/\\/g,'\\\\').replace(/%/g,'%%')+'"';
 return '[Desktop Entry]\nType=Application\nName=Taiga Launcher\nExec='+quoted+(hidden?' --hidden':'')+'\nTerminal=false\nCategories=Game;\n';
}
export function applyStartup(on,executable,{home=os.homedir(),env=process.env}={}){
 const file=path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'autostart','taiga-launcher.desktop');
 if(on){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,desktopEntry(executable,{hidden:true}),{mode:0o600});}
 else fs.rmSync(file,{force:true});
}
export function nativeExecutable(file){try{
 const st=fs.statSync(file);if(!st.isFile()||!(st.mode&0o111))return false;
 const fd=fs.openSync(file,'r');try{const b=Buffer.alloc(4);fs.readSync(fd,b,0,4,0);return b.equals(Buffer.from([0x7f,0x45,0x4c,0x46]))||b.subarray(0,2).toString()==='#!';}finally{fs.closeSync(fd);}
 }catch{return false;}}
