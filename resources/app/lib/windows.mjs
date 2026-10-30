import fs from 'node:fs';
import path from 'node:path';
import * as linux from './linux.mjs';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
export async function ps(code){if(process.platform!=='win32')throw Error('Esta operação requer Windows.');const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{windowsHide:true,maxBuffer:4*1024*1024});return stdout.trim();}
export async function detectSteam(){if(process.platform==='linux')return linux.detectSteam();try{return await ps("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam').SteamPath");}catch{return '';}}
export async function steamLocation(selected){if(process.platform==='linux'){if(fs.existsSync(selected)&&fs.statSync(selected).isDirectory())return selected;if(['steam','steam.sh'].includes(path.basename(selected)))return await detectSteam()||path.dirname(selected);throw Error('Selecione a pasta de dados da Steam ou steam.sh.');}let target=selected;if(path.extname(selected).toLowerCase()==='.lnk'){const literal=selected.replaceAll("'","''");target=await ps("(New-Object -ComObject WScript.Shell).CreateShortcut('"+literal+"').TargetPath");}if(fs.existsSync(target)&&fs.statSync(target).isDirectory())return target;if(path.basename(target).toLowerCase()!=='steam.exe')throw Error('Selecione a pasta da Steam, steam.exe ou um atalho para steam.exe.');return path.dirname(target);}
// Steam aberta? Pelo tasklist (leve) em vez de um PowerShell inteiro; a resposta vale 3 s e pedidos juntos dividem a
// mesma consulta. fresh: consulta agora (usado ao fechar/abrir a Steam).
let runCache={at:0,value:false},runPending=null;
export async function processRunning(image){if(process.platform!=='win32')return false;try{const {stdout}=await run('tasklist.exe',['/FI','IMAGENAME eq '+image,'/FO','CSV','/NH'],{windowsHide:true,timeout:10000});return String(stdout).toLowerCase().includes('"'+image.toLowerCase()+'"');}catch{return (await ps("if(Get-Process "+image.replace(/\.exe$/i,'')+" -ErrorAction SilentlyContinue){'yes'}else{'no'}").catch(()=>'no'))==='yes';}}
export async function running({fresh=false}={}){if(process.platform==='linux')return linux.processes().some(p=>p.name==='steam');if(process.platform!=='win32')return false;if(!fresh&&Date.now()-runCache.at<3000)return runCache.value;if(runPending)return runPending;runPending=processRunning('steam.exe').then(v=>{runCache={at:Date.now(),value:v};return v;}).finally(()=>{runPending=null;});return runPending;}
export async function stopSteam(dir){
 if(!await running({fresh:true}))return;
 const command=process.platform==='linux'?linux.steamCommand(dir,['-shutdown']):{exe:path.join(dir,'steam.exe'),args:['-shutdown']};
 await run(command.exe,command.args,{windowsHide:true,timeout:15000}).catch(()=>{});
 const deadline=Date.now()+45000;while(Date.now()<deadline){if(!await running({fresh:true})){
  // A porta de depuração pertence ao steamwebhelper: espera ele fechar também, senão a Steam nova não consegue abri-la.
  if(process.platform==='linux')return;
  const helperDeadline=Date.now()+12000;while(Date.now()<helperDeadline&&await processRunning('steamwebhelper.exe'))await new Promise(r=>setTimeout(r,500));
  return;}await new Promise(r=>setTimeout(r,500));}
 throw Error('A Steam ainda está aberta. Encerre normalmente pelo menu Steam > Sair e tente novamente.');
}
// A Steam é aberta com a depuração do CEF para o injetor do Taiga Launcher (mesmos argumentos do SFP).
export function startSteam(dir,port=8080){if(process.platform==='linux')return linux.startSteam(dir,port);const p=spawn(path.join(dir,'steam.exe'),['-cef-enable-debugging','-devtools-port',String(port)],{detached:true,stdio:'ignore',windowsHide:true});p.on('error',()=>{});p.unref();}
// Linha de comando da Steam em execução (para saber se já está com a integração ativa).
export async function steamCommandLine(){if(process.platform==='linux')return linux.processes().find(p=>p.name==='steam')?.args.join(' ')||'';if(process.platform!=='win32')return null;try{return await ps("(Get-CimInstance Win32_Process -Filter \"name='steam.exe'\" | Select-Object -First 1 -ExpandProperty CommandLine)")||'';}catch{return null;}}
// Inicialização com o Windows: acrescenta os argumentos da integração à entrada "Steam" de HKCU\...\Run.
const RUN_KEY='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
export async function steamAutostart(dir,{enable=null,port=8080}={}){
 if(process.platform!=='win32')return {available:false,enabled:false};
 let current='';try{const {stdout}=await run('reg.exe',['query',RUN_KEY,'/v','Steam'],{windowsHide:true});current=(stdout.match(/Steam\s+REG_SZ\s+(.+)/)||[])[1]?.trim()||'';}catch{}
 const has=/-cef-enable-debugging/i.test(current);
 if(enable===null)return {available:!!current,enabled:has};
 if(!current)throw Error('A Steam não está configurada para iniciar com o Windows. Ative em Steam > Configurações > Interface.');
 let next=current.replace(/\s+-cef-enable-debugging/ig,'').replace(/\s+-devtools-port\s+\d+/ig,'');if(enable)next+=' -cef-enable-debugging -devtools-port '+Number(port);
 await run('reg.exe',['add',RUN_KEY,'/v','Steam','/t','REG_SZ','/d',next,'/f'],{windowsHide:true});
 return {available:true,enabled:!!enable};
}
export async function pick(kind){
 if(kind==='steam-folder')kind='folder';else if(kind==='steam-file')kind='steam';
 if(!['game','folder','emulator','launcher','core','steam','scripts','art'].includes(kind))throw Error('Seleção inválida');
 if(process.platform!=='win32')throw Error('O seletor de arquivos requer Windows.');
 const {stdout}=await run('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(here,'../windows/pick.ps1'),kind],{windowsHide:true,maxBuffer:1024*1024});
 return JSON.parse(stdout.replace(/^\uFEFF/,'').trim()||'[]');
}
export function accounts(dir){const file=path.join(dir,'config','loginusers.vdf');if(!fs.existsSync(file))return [];
 const text=fs.readFileSync(file,'utf8'),list=[];
 for(const m of text.matchAll(/"(\d{17})"\s*\{([^}]+)\}/g)){
 const id=String(BigInt(m[1])-76561197960265728n),name=m[2].match(/"PersonaName"\s+"([^"]*)"/i)?.[1]||id;
 list.push({id,steamId:m[1],name,avatar:avatarFile(dir,m[1])?'/api/avatar?id='+id:null,recent:/"MostRecent"\s+"1"/.test(m[2])});
 }return list;
}
export async function activeAccount(dir){if(process.platform==='linux'){return accounts(dir||await detectSteam()).find(a=>a.recent)?.id||null;}try{const id=await ps("(Get-ItemProperty 'HKCU:\\Software\\Valve\\Steam\\ActiveProcess' -ErrorAction Stop).ActiveUser");return /^\d+$/.test(id)&&id!=='0'?id:null;}catch{return null;}}

export function avatarFile(dir,steamId){if(!/^\d{17}$/.test(steamId))return null;for(const base of ['config/avatarcache','appcache/avatarcache'])for(const ext of ['png','jpg','jpeg']){const file=path.join(dir,base,steamId+'.'+ext);try{const stat=fs.statSync(file);if(stat.isFile()&&stat.size<4*1024*1024)return file;}catch{}}return null;}
// Conta Epic do jogo aberto pelo launcher da Epic: ele recebe "-epicuserid=<id>" na linha de comando.
export async function epicUserFromProcesses(){if(process.platform!=='win32')return null;try{const out=await ps("Get-CimInstance Win32_Process -Filter \"CommandLine like '%-epicuserid=%'\" | Select-Object -First 5 -ExpandProperty CommandLine");const m=String(out||'').match(/-epicuserid=([0-9a-f]{32})\b/i);return m?m[1].toLowerCase():null;}catch{return null;}}

export function steamInstalled(dir){if(process.platform==='linux')return linux.steamInstalled(dir);try{return fs.statSync(path.join(dir,'steam.exe')).isFile();}catch{return false;}}
