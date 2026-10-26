import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {steamCandidates,detectSteam,steamCommand,hostLaunch,desktopEntry,applyStartup,nativeExecutable,processes} from '../lib/linux.mjs';
import {inspectGame,scanGames,launchFor} from '../lib/games.mjs';
import {coreFor,discoverEmulators} from '../lib/emulator-registry.mjs';
import {LaunchEngine} from '../lib/launch-engine.mjs';
import {windowsPath,parseVDF,shortcutInfo} from '../lib/vdf.mjs';
import {createApp} from '../server.mjs';

const temp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-linux-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
const write=(dir,name,text,mode=0o600)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text,{mode});return file;};
test('Linux Steam discovery uses native/XDG and Flatpak data roots, with correct launch commands',t=>{
 const home=temp(t),env={XDG_DATA_HOME:path.join(home,'data')},dirs=steamCandidates({home,env});
 const native=dirs[1];fs.mkdirSync(path.join(native,'config'),{recursive:true});fs.mkdirSync(path.join(native,'steamapps'));
 assert.equal(detectSteam({home,env}),native);
 write(native,'steam.sh','#!/bin/sh\n',0o700);assert.deepEqual(steamCommand(native,['-shutdown']),{exe:path.join(native,'steam.sh'),args:['-shutdown']});
 fs.rmSync(native,{recursive:true});const flatpak=dirs.at(-1);fs.mkdirSync(path.join(flatpak,'config'),{recursive:true});fs.mkdirSync(path.join(flatpak,'steamapps'));
 assert.equal(detectSteam({home,env}),flatpak);assert.deepEqual(steamCommand(flatpak,['-shutdown']),{exe:'flatpak',args:['run','com.valvesoftware.Steam','-shutdown']});
 assert.deepEqual(hostLaunch('/opt/Taiga Launcher/taiga','--taiga-launch uuid',flatpak),{exe:'/usr/bin/flatpak-spawn',args:'--host "/opt/Taiga Launcher/taiga" --taiga-launch uuid'});
 assert.throws(()=>hostLaunch('/bad"path','',flatpak));
});
test('Linux autostart follows XDG and quotes paths rather than interpolating shell commands',t=>{
 const home=temp(t),env={XDG_CONFIG_HOME:path.join(home,'config')},exe='/opt/Taiga $Launcher/taiga%20';
 applyStartup(true,exe,{home,env});const file=path.join(env.XDG_CONFIG_HOME,'autostart/taiga-launcher.desktop');
 assert.equal(fs.readFileSync(file,'utf8'),desktopEntry(exe,{hidden:true}));assert.match(fs.readFileSync(file,'utf8'),/%%20/);
 assert.throws(()=>desktopEntry('/bad\npath'));applyStartup(false,exe,{home,env});assert.equal(fs.existsSync(file),false);
});
test('Linux imports and launches native executables, detects symlink emulators and keeps path case',{skip:process.platform!=='linux'},async t=>{
 const dir=temp(t),game=write(dir,'Celeste','#!/bin/sh\nsleep 0.05\n',0o700);
 assert.equal(nativeExecutable(game),true);assert.ok(scanGames(dir).includes(game));const info=inspectGame(game);assert.equal(info.platformKey,'linux');assert.equal(info.profile,'pc');assert.equal(launchFor(info,{}).exe,game);
 const other=write(dir,'celeste','#!/bin/sh\nexit 0\n',0o700);assert.notEqual(inspectGame(other).id,info.id);assert.notEqual(windowsPath(game),windowsPath(other));
 assert.equal(windowsPath('C:\\Games\\Game.exe'),windowsPath('c:/games/game.exe'));
 const plain=write(dir,'not-a-game','hello',0o700);assert.equal(nativeExecutable(plain),false);assert.ok(!scanGames(dir).includes(plain));
 fs.symlinkSync(game,path.join(dir,'PPSSPPSDL'));assert.equal(discoverEmulators([dir]).profiles.psp.selected,path.join(dir,'PPSSPPSDL'));
 const engine=new LaunchEngine({dir:path.join(dir,'data'),interval:20,grace:30});const result=await engine.run({...info,uuid:crypto.randomUUID()},{account:'1'},{command:launchFor(info,{})});assert.equal(result.exitCode,0);assert.equal(result.status,'ended');
});
test('Linux process inspection tolerates disappearing processes',t=>{assert.deepEqual(processes({proc:temp(t)}),[]);});
test('Linux service imports a native game and writes idempotent native/Flatpak Steam shortcuts',{skip:process.platform!=='linux'},async t=>{
 const root=temp(t),game=write(root,'games/Celeste','#!/bin/sh\nexit 0\n',0o700);
 for(const flatpak of [false,true]){
  const steam=path.join(root,flatpak?'.var/app/com.valvesoftware.Steam/.local/share/Steam':'Steam'),dataDir=path.join(root,flatpak?'flatpak-data':'native-data');
  write(steam,'steam.sh','#!/bin/sh\n',0o700);write(steam,'config/loginusers.vdf','"users" { "76561197960265729" { "PersonaName" "Test" "MostRecent" "1" } }');fs.mkdirSync(path.join(steam,'userdata/1/config'),{recursive:true});
  write(dataDir,'config.json',JSON.stringify({language:'en',steamDir:steam,account:'1',roots:[],adminToken:'admin',readToken:'reader',preferences:{watchFolders:false}}));
  const launcher='/opt/Taiga Launcher/taiga',port=flatpak?49631:49630;const {server}=createApp({dataDir,launcherExecutable:launcher,port});await new Promise(r=>server.listen(port,'127.0.0.1',r));
  const api=async(route,body)=>{const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await res.json();assert.equal(res.status,200,JSON.stringify(json));return json;};
  try{
   const scan=await api('scan',{paths:[game]}),added=await api('import-confirm',{scanId:scan.scanId,items:scan.items});assert.equal(added.addedIds.length,1);
   const state=await api('state');assert.equal(state.settings.readiness.steam,true);assert.equal(state.games[0].platformKey,'linux');
   const sync=()=>api('sync',{ids:added.addedIds,installIntegration:false});await sync();await sync();
   const shortcuts=shortcutInfo(parseVDF(fs.readFileSync(path.join(steam,'userdata/1/config/shortcuts.vdf'))));assert.equal(shortcuts.length,1);
   assert.equal(shortcuts[0].exe,'"'+(flatpak?'/usr/bin/flatpak-spawn':launcher)+'"');assert.match(shortcuts[0].options,/--taiga-launch [a-f0-9-]+/);if(flatpak)assert.match(shortcuts[0].options,/^--host "--env=TAIGA_DATA=.*" "\/opt\/Taiga Launcher\/taiga"/);
  }finally{await new Promise(r=>server.close(r));}
 }
});

test('Native RetroArch discovers Linux cores in XDG locations',{skip:process.platform!=='linux'},t=>{
 const home=temp(t),env={XDG_CONFIG_HOME:path.join(home,'config')};const core=write(env.XDG_CONFIG_HOME,'retroarch/cores/mgba_libretro.so','fixture');
 assert.equal(coreFor({platformName:'Game Boy Advance'},'/usr/bin/retroarch',{home,env}),core);
});
