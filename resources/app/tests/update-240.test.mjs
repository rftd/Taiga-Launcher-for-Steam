// 2.4.0: Switch sem atualizações/DLC, novo Epic Games Launcher, rótulo Estado Cloud.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {switchExtra} from '../lib/games.mjs';import {scanEpic} from '../lib/stores.mjs';
test('Switch updates and DLC are not games; the base game is', () => {
 assert.equal(switchExtra('C:/g/Super Smash Bros Ultimate [01006A800016E000][v0].nsp'),false);
 assert.equal(switchExtra('C:/g/SSBU [01006A800016E800][v1].nsp'),true);
 assert.equal(switchExtra('C:/g/SSBU DLC [01006A800016F001].nsp'),true);
 assert.equal(switchExtra('C:/g/Smash.xci'),false);
 assert.equal(switchExtra('C:/g/game.iso'),false);
});
test('New Epic Games Launcher (installations.jsonl) games are found', t => {
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'egl2-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 fs.mkdirSync(path.join(d,'com.epicgames.eglv2'));
 fs.writeFileSync(path.join(d,'com.epicgames.eglv2','installations.jsonl'),JSON.stringify({complete:true,dir:path.join(d,'GTAVEnhanced'),platform:'Windows',namespace:'b0cd',itemId:'122e',artifactId:'8769',version:'1',launchExecutable:'PlayGTAV.exe'})+'\n'+JSON.stringify({complete:false,dir:'x',launchExecutable:'y.exe'})+'\n');
 const list=scanEpic({LOCALAPPDATA:d,PROGRAMDATA:d});
 assert.equal(list.length,1);assert.equal(list[0].title,'GTAV Enhanced');assert.match(list[0].url,/b0cd%3A122e%3A8769\?action=launch/);
});
