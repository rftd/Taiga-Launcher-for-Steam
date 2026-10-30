import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {emulatorGameFolders,discoverGameFolders} from '../lib/discover.mjs';
import {discoverEmulators,applyDiscovery,defaultDiscoveryRoots} from '../lib/emulator-registry.mjs';
import {discoverFlatpakEmulators} from '../lib/flatpak-emulators.mjs';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';
import {raLogCandidates} from '../lib/ra-log.mjs';
const setup=t=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-find-linux-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const put=(rel,text='fixture')=>{const f=path.join(home,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);return f;};return {home,put,env:{HOME:home,PATH:'',XDG_CONFIG_HOME:path.join(home,'.config')}};};
test('Linux discovers game folders from Flatpak playlists, Dolphin, RPCS3 and HOME without USERPROFILE',t=>{
 const {home,put,env}=setup(t),rom=put('library/My PSP/Game.iso'),gc=put('library/GameCube/Game.rvz'),ps3=put('library/PS3/Game/PS3_GAME/USRDIR/EBOOT.BIN');
 put('.var/app/org.libretro.RetroArch/config/retroarch/playlists/PSP.lpl',JSON.stringify({items:[{path:rom}]}));
 put('.var/app/org.DolphinEmu.dolphin-emu/config/dolphin-emu/Dolphin.ini','[General]\nISOPath0 = '+path.dirname(gc));
 put('.var/app/net.rpcs3.RPCS3/config/rpcs3/games.yml','BLUS12345: "'+path.dirname(path.dirname(path.dirname(ps3)))+'"');
 put('Emulation/roms/SNES/game.sfc');put('roms/NES/game.nes');
 const found=emulatorGameFolders({env});assert.ok(found.some(f=>f.source==='RetroArch'&&f.path===path.dirname(rom)));assert.ok(found.some(f=>f.source==='Dolphin'&&f.path===path.dirname(gc)));assert.ok(found.some(f=>f.source==='RPCS3'));
 const result=discoverGameFolders({}, {env,platform:'linux'});assert.ok(result.paths.includes(path.join(home,'Emulation/roms')));assert.ok(result.paths.includes(path.join(home,'roms')));assert.ok(result.paths.includes(path.dirname(rom)));
 assert.ok(raLogCandidates({},env).includes(path.join(home,'.var/app/org.libretro.RetroArch/config/retroarch/logs/retroarch.log')));
});
test('Versioned Linux AppImages are discovered without accepting Windows executables',t=>{
 const {home,put}=setup(t),rpcs=put('RPCS3/rpcs3-v0.0.39-12345_linux64.AppImage'),pcsx=put('PCSX2/pcsx2-v2.4.0-linux-appimage-x64-Qt.AppImage');put('Windows/rpcs3.exe');
 const r=discoverEmulators([home],{platform:'linux',flatpakOptions:{platform:'win32'}});assert.equal(r.profiles.ps3.selected,rpcs);assert.equal(r.profiles.ps2.selected,pcsx);
});
test('Flatpak discovery checks exported desktop entries when list fails, without executing their contents',t=>{
 const {home,put,env}=setup(t),exe=put('bin/flatpak');fs.chmodSync(exe,0o755);env.PATH=path.dirname(exe);
 put('.local/share/applications/org.libretro.RetroArch.desktop','[Desktop Entry]\nExec=do-not-execute');
 const calls=[],run=(cmd,args)=>{calls.push(args);if(args[0]==='list')throw Error('list unavailable');if(args.at(-1)==='org.libretro.RetroArch')return path.join(home,'deployment');throw Error('not installed');};
 const list=discoverFlatpakEmulators({platform:'linux',env,run});assert.equal(list[0].flatpakId,'org.libretro.RetroArch');assert.ok(calls.every(a=>a[0]==='list'||a[0]==='info'));
});
test('A failed achievement lookup can retry immediately, and unmapped RetroAchievements games report their source',async t=>{
 const {home}=setup(t);let fail=true,calls=0;
 const m=new AchievementProviderManager({config:()=>({}),dir:home,providers:{retro:{gamesList:async()=>{calls++;if(fail)throw Error('Temporary RA failure');return {42:'Super Mario World'};}}}});
 const g={id:'game',profile:'retroarch',title:'Super Mario World',platformKey:'snes'};
 await assert.rejects(()=>m.resolveRaId(g),/Temporary RA failure/);assert.equal(g.raLookupAt,undefined);fail=false;assert.equal(await m.resolveRaId(g),42);assert.equal(calls,2);
 const missing={id:'missing',profile:'retroarch',title:'No exact match',platformKey:'snes'};const r=await m.read(missing);assert.equal(r.status,'unmapped');assert.equal(r.provider,'retroachievements');
});

test('Automatic discovery endpoint finds ROMs from a Flatpak playlist without manual folder selection',{skip:process.platform!=='linux'},async t=>{
 const {home,put}=setup(t),{iso}=await import('./fixtures.mjs'),{createApp}=await import('../server.mjs');
 const rom=put('library/PSP/Patapon.iso',iso());put('.var/app/org.libretro.RetroArch/config/retroarch/playlists/PSP.lpl',JSON.stringify({items:[{path:rom}]}));
 const before={HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE,XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME};process.env.HOME=home;delete process.env.USERPROFILE;process.env.XDG_CONFIG_HOME=path.join(home,'.config');
 t.after(()=>{for(const [k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const native=put('Games/Native Game/game','#!/bin/sh\nexit 0\n');fs.chmodSync(native,0o755);
 const data=path.join(home,'taiga');put('taiga/config.json',JSON.stringify({adminToken:'fixture-admin',readToken:'fixture-read',language:'en',roots:[],preferences:{watchFolders:false}}));
 const {createServer}=await import('node:net');const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const app=createApp({dataDir:data,port});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
 const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/discover',{method:'POST',headers:{Authorization:'Bearer fixture-admin','Content-Type':'application/json'},body:JSON.stringify({stores:false,sweep:false})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));assert.ok(value.items.some(g=>g.path===rom),JSON.stringify(value));assert.ok(value.items.some(g=>g.path===native),JSON.stringify(value));
});

test('Achievement errors remain visible and escape markup',async()=>{
 const {default:view}=await import('../web/achievement-view.cjs');const html=view.rows({status:'unavailable',provider:'retroachievements',achievements:[],message:'RA <network> failed'},{T:key=>key,language:'en'});assert.match(html,/RA &lt;network&gt; failed/);assert.ok(!html.includes('<network>'));
});

test('Installed Dolphin Flatpak is configured even when the unrelated native directory scan hits its limit',t=>{
 const {home,put,env}=setup(t),exe=put('bin/flatpak');fs.chmodSync(exe,0o755);env.PATH=path.dirname(exe);
 put('large/one');put('large/two');const run=(_cmd,args)=>args[0]==='list'?'org.DolphinEmu.dolphin-emu':path.join(home,'deployment');
 const result=discoverEmulators([home],{platform:'linux',limit:1,flatpakOptions:{env,run}});
 assert.equal(result.limited,true);assert.equal(result.profiles.dolphin.selected,'flatpak:org.DolphinEmu.dolphin-emu');
 const config={launchers:{dolphin:{exe:put('.local/share/applications/org.DolphinEmu.dolphin-emu.desktop')}}};assert.ok(applyDiscovery(config,result).includes('dolphin'));assert.equal(config.launchers.dolphin.exe,exe);assert.equal(config.launchers.dolphin.flatpakId,'org.DolphinEmu.dolphin-emu');
});

test('Linux emulator discovery avoids rescanning the system tree for configured Flatpak launchers',{skip:process.platform!=='linux'},t=>{
 const {home,env}=setup(t);const roots=defaultDiscoveryRoots({launchers:{dolphin:{exe:'/usr/bin/flatpak',flatpakId:'org.DolphinEmu.dolphin-emu'},ps3:{exe:'/usr/bin/rpcs3'}}},{env,home,appRoot:home});assert.ok(!roots.includes('/usr'));assert.ok(roots.includes('/usr/bin'));
});
