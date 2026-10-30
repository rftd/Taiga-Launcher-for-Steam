import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {portProfile} from '../lib/port-profiles.mjs';
import {parsePortTrophyLines, portLogFiles} from '../lib/port-trophies.mjs';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';

test('Ports conhecidos são reconhecidos pelo programa', () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ports-'));
 const mk = (rel, files = []) => { const dir = path.join(d, rel); fs.mkdirSync(dir, {recursive: true}); for (const f of files) fs.writeFileSync(path.join(dir, f), 'x'); return dir; };
 assert.equal(portProfile({path: path.join(mk('Tenkaichi3Decomp-v0.1.38.7', ['bt3.exe']), 'bt3.exe')})?.id, 'tenkaichi3decomp');
 assert.equal(portProfile({path: path.join(mk('MM', ['Zelda64Recompiled.exe']), 'Zelda64Recompiled.exe')})?.id, 'zelda64recomp');
 assert.equal(portProfile({path: path.join(mk('SoH', ['soh.exe', 'oot.o2r']), 'soh.exe')})?.id, 'shipwright');
 assert.equal(portProfile({path: path.join(mk('sm64', ['sm64.us.f3dex2e.exe']), 'sm64.us.f3dex2e.exe')})?.id, 'sm64ex');
 assert.equal(portProfile({path: path.join(mk('OpenGOAL/jak2', ['gk.exe']), 'gk.exe')})?.id, 'opengoal-jak2');
 assert.equal(portProfile({path: path.join(mk('bb', ['probe.exe', 'bbport.ini']), 'probe.exe')})?.id, 'bloodborne-port');
 assert.equal(portProfile({path: path.join(mk('Outro', ['game.exe']), 'game.exe')}), null);
});

test('Bloodborne PC: trophies.log ("id horário") entra como desbloqueio', () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-'));
 fs.mkdirSync(path.join(d, 'user')); fs.writeFileSync(path.join(d, 'probe.exe'), 'x'); fs.writeFileSync(path.join(d, 'user', 'trophies.log'), '3 1761400000\n12 1761400100\n');
 assert.deepEqual(parsePortTrophyLines('3 1761400000\n12 1761400100\nlixo\n', {trophyLog: true}), [3, 12]);
 assert.deepEqual(parsePortTrophyLines('3 1761400000\n'), [], 'fora do trophies.log a linha não vale');
 assert.ok(portLogFiles(path.join(d, 'probe.exe')).some(f => /trophies\.log$/.test(f)));
});

test('Tenkaichi 3 decomp: conquistas do RetroAchievements do PS2, mesmo com o nome também no Wii', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bt3-')); fs.writeFileSync(path.join(d, 'bt3.exe'), 'x');
 const lists = {21: {1111: 'Dragon Ball Z: Budokai Tenkaichi 3'}, 19: {2222: 'Dragon Ball Z: Budokai Tenkaichi 3'}};
 const m = new AchievementProviderManager({config: () => ({}), dir: d, providers: {retro: {gamesList: async id => lists[id] || {}}, achievements: async g => ({status: 'ok', achievements: [{id: 1, unlocked: true}], total: 1, unlocked: 1})}, account: () => null});
 const game = {id: 'bt3', title: 'bt3', profile: 'pc', path: path.join(d, 'bt3.exe')};
 const r = await m.read(game);
 assert.equal(game.raId, 1111); assert.equal(r.provider, 'retroachievements'); assert.match(r.source, /Tenkaichi3Decomp/);
});
