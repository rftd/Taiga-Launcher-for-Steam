import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {discoverEmulators,applyDiscovery,emulatorFile,coreFor} from '../lib/emulator-registry.mjs';
import {resolveFlatpakEmulator,flatpakLaunch} from '../lib/flatpak-emulators.mjs';
import {emulatorAccounts,publicAccounts} from '../lib/emulator-accounts.mjs';
import {splitArguments} from '../lib/launch-engine.mjs';
const setup=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-flatpak-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=(name,body='fixture')=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,body);return f;};return {root,file};};
test('Linux discovery excludes Windows emulators and replaces stale Windows configuration with installed Flatpak',t=>{
 const {root,file}=setup(t),windows=file('Dolphin.exe'),native=file('dolphin-emu'),flatpak=file('bin/flatpak');fs.chmodSync(flatpak,0o755);
 const env={PATH:path.dirname(flatpak)},run=(_exe,args)=>args[0]==='list'?'org.libretro.RetroArch\nnet.rpcs3.RPCS3\nunknown.App':path.join(root,'deployment');
 const result=discoverEmulators([root],{platform:'linux',flatpakOptions:{env,run}});
 assert.deepEqual(result.profiles.dolphin.candidates,[native]);assert.equal(emulatorFile(windows,'linux'),false);assert.equal(emulatorFile(windows,'win32'),true);
 assert.equal(result.profiles.retroarch.selected,'flatpak:org.libretro.RetroArch');
 const config={launchers:{retroarch:{exe:file('retroarch.exe')}}};applyDiscovery(config,result);assert.equal(config.launchers.retroarch.exe,flatpak);assert.equal(config.launchers.retroarch.flatpakId,'org.libretro.RetroArch');
 assert.equal(resolveFlatpakEmulator('/exports/org.libretro.RetroArch.desktop',{platform:'linux',env,run}).profile,'retroarch');assert.equal(resolveFlatpakEmulator('flatpak:unknown.App',{platform:'linux',env,run}),null);
 assert.equal(discoverEmulators([root],{platform:'win32'}).profiles.dolphin.selected,windows);
});
test('RetroArch Flatpak uses its own cores and grants selected game paths for one invocation',t=>{
 const {root,file}=setup(t),core=file('.var/app/org.libretro.RetroArch/config/retroarch/cores/mgba_libretro.so'),game=file('My games/Pokemon.gba');
 assert.equal(coreFor({platformName:'Game Boy Advance'},'/usr/bin/flatpak',{home:root,flatpakId:'org.libretro.RetroArch'}),core);
 const args=splitArguments(flatpakLaunch({flatpakId:'org.libretro.RetroArch'},'-L "'+core+'" "'+game+'"',{path:game,profile:'retroarch'},core));
 assert.equal(args[0],'run');assert.ok(args.includes('--filesystem='+path.dirname(game)+':ro'));assert.ok(args.includes('org.libretro.RetroArch'));assert.equal(args.at(-1),game);
});
test('RetroArch and Dolphin accounts are read from Flatpak and native XDG configuration without exposing tokens',t=>{
 const {root,file}=setup(t),token='FixtureToken123456789';
 file('.var/app/org.libretro.RetroArch/config/retroarch/retroarch.cfg','cheevos_enable = "true"\ncheevos_username = "PlayerRA"\ncheevos_token = "'+token+'"');
 file('.var/app/org.DolphinEmu.dolphin-emu/config/dolphin-emu/RetroAchievements.ini','[Achievements]\nUsername = PlayerDolphin\nApiToken = '+token);
 const env={HOME:root,XDG_CONFIG_HOME:path.join(root,'xdg')};let accounts=emulatorAccounts({},env);assert.equal(accounts.length,2);assert.ok(accounts.some(a=>a.emulator==='RetroArch'));assert.ok(accounts.some(a=>a.emulator==='Dolphin'));assert.ok(!JSON.stringify(publicAccounts(accounts)).includes(token));
 file('xdg/retroarch/retroarch.cfg','cheevos_username = "NativePlayer"\ncheevos_token = "'+token+'"');accounts=emulatorAccounts({},env);assert.equal(accounts.length,3);
});

test('Upstream RetroArch core metadata and retroarchFirst preference also work with Flatpak',async t=>{
 const {retroArchPlatforms,clearRetroArchCache}=await import('../lib/retroarch.mjs');
 const {preferredProfile}=await import('../lib/emulator-registry.mjs');
 const {root,file}=setup(t),exe=file('bin/flatpak');
 file('.var/app/org.libretro.RetroArch/config/retroarch/cores/snes9x_libretro.so');
 file('.var/app/org.libretro.RetroArch/config/retroarch/cores/mgba_libretro.dll');
 file('.var/app/org.libretro.RetroArch/config/retroarch/cores/custom_libretro.so');
 file('.var/app/org.libretro.RetroArch/config/retroarch/info/custom_libretro.info','database = "Sega - Game Gear"');
 const launcher={exe,home:root,env:{HOME:root},platform:'linux',flatpakId:'org.libretro.RetroArch'};
 clearRetroArchCache();t.after(clearRetroArchCache);
 assert.ok(retroArchPlatforms(exe,launcher).includes('Super Nintendo Entertainment System'));
 assert.ok(!retroArchPlatforms(exe,launcher).includes('Game Boy Advance'));
 assert.ok(retroArchPlatforms(exe,launcher).includes('Sega Game Gear'));
 assert.equal(preferredProfile({profile:'snes9x',platformName:'Super Nintendo Entertainment System'},{preferences:{retroarchFirst:true},launchers:{retroarch:launcher}}),'retroarch');
});
