import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';
import {SteamInjector} from '../lib/steam-inject.mjs';
import {SessionStore} from '../lib/launch-engine.mjs';
import {createNglBackend} from '../lib/ngl/backend.mjs';

test('Página do jogo pedindo conquistas a cada 5 s: com o jogo fechado, reaproveita a última leitura', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ach-'));
 let reads = 0, running = false;
 const m = new AchievementProviderManager({isRunning: () => running, config: () => ({}), dir: d, providers: {achievements: async () => { reads++; return {status: 'ok', achievements: [{id: 1, title: 'A', unlocked: false}]}; }}, account: () => null});
 const game = {id: 'x', uuid: '0f8fad5b-d9cb-469f-a165-70867728950e', title: 'Jogo', profile: 'psp', path: path.join(d, 'jogo.iso'), raId: 5};
 await m.get(game); await m.get(game); await m.get(game);
 assert.equal(reads, 1, 'leituras com o jogo fechado: ' + reads);
 await m.get(game, {quiet: true}); assert.equal(reads, 2, 'pedido explícito (marcar conquista) lê de novo');
 running = true; await m.get(game); assert.equal(reads, 3, 'jogo aberto: sempre lê');
});

test('Sem informação de jogo aberto (uso antigo), nada muda: lê sempre', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ach2-'));
 let reads = 0;
 const m = new AchievementProviderManager({config: () => ({}), dir: d, providers: {achievements: async () => { reads++; return {status: 'ok', achievements: [{id: 1, title: 'A', unlocked: false}]}; }}, account: () => null});
 const game = {id: 'x', uuid: '1f8fad5b-d9cb-469f-a165-70867728950e', title: 'Jogo', profile: 'psp', path: path.join(d, 'jogo.iso'), raId: 5};
 await m.get(game); await m.get(game);
 assert.equal(reads, 2);
});

test('Páginas da Loja/Comunidade anexadas não recebem recargas nem avisos de conquista', async () => {
 const sent = [];
 const inj = new SteamInjector({scripts: async () => ({community: 'x'}), onCall: async () => ''});
 inj.ws = {readyState: 1, send: raw => { const m = JSON.parse(raw); sent.push(m); setImmediate(() => inj.onMessage(JSON.stringify({id: m.id, result: m.method === 'Target.attachToTarget' ? {sessionId: 's1'} : {}}))); }};
 await inj.handleTarget({targetId: 't1', type: 'page', url: 'https://store.steampowered.com/', title: 'Loja'});
 await inj.ensure('t1');
 for (const t of inj.checks.values()) clearTimeout(t);
 const before = sent.length;
 await inj.reloadNow();
 assert.equal(sent.length, before, 'recarga não mexe na Loja');
 assert.equal(await inj.notify({title: 'x'}), false);
 assert.equal(sent.length, before, 'aviso não vai para a Loja');
 assert.deepEqual(inj.status().windows, []);
 assert.ok(Array.isArray(inj.status().callStats));
});

test('Tempo de jogo: playtime.json só é lido de novo quando muda', () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-'));
 fs.writeFileSync(path.join(d, 'playtime.json'), JSON.stringify({totals: {'u|local': {seconds: 60, sessions: 1}}, processed: []}));
 const s = new SessionStore(d); let reads = 0; const orig = s.readIndex.bind(s); s.readIndex = () => { reads++; return orig(); };
 s.snapshot(); s.cache = null; s.snapshot(); s.cache = null; s.snapshot();
 assert.equal(reads, 1);
 const t = new Date(Date.now() + 5000); fs.writeFileSync(path.join(d, 'playtime.json'), JSON.stringify({totals: {'u|local': {seconds: 120, sessions: 2}}, processed: []})); fs.utimesSync(path.join(d, 'playtime.json'), t, t);
 s.cache = null; assert.equal(s.snapshot().get('u|local').seconds, 120); assert.equal(reads, 2);
});

test('Lista de atalhos para a Steam: o shortcuts.vdf não é lido de novo sem mudar', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ngl-')), steam = path.join(d, 'steam'), cfg = path.join(steam, 'userdata', '1', 'config');
 fs.mkdirSync(cfg, {recursive: true}); fs.writeFileSync(path.join(cfg, 'shortcuts.vdf'), Buffer.from([0x00, 0x73, 0x68, 0x6f, 0x72, 0x74, 0x63, 0x75, 0x74, 0x73, 0x00, 0x08, 0x08]));
 let version = 1, gamesCalls = 0;
 const games = [{id: 'a', uuid: 'u', title: 'Jogo A', path: 'C:\\a.exe', bindings: {1: 3000000001}}];
 const b = createNglBackend({dataDir: d, dataVersion: () => version, config: () => ({steamDir: steam, account: '1', language: 'pt-BR'}), games: () => { gamesCalls++; return games; }});
 const one = JSON.parse(await b.call('list_shortcuts', {}));
 assert.equal(one.shortcuts.length, 1);
 const callsAfterFirst = gamesCalls;
 await b.call('list_shortcuts', {});
 assert.equal(gamesCalls - callsAfterFirst, 1, 'segunda vez: só confere a versão, não remonta a lista');
 games.push({id: 'b', uuid: 'v', title: 'Jogo B', path: 'C:\\b.exe', bindings: {1: 3000000002}}); version++;
 assert.equal(JSON.parse(await b.call('list_shortcuts', {})).shortcuts.length, 2);
});
