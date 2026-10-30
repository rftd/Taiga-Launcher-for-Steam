import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';
import {createCommunity} from '../lib/community.mjs';
import {SteamInjector, isSteamWebTarget} from '../lib/steam-inject.mjs';

test('Port sem desbloqueio próprio (Tenkaichi 3): lista do RetroAchievements com conquistas marcadas no programa', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bt3m-')); fs.writeFileSync(path.join(d, 'bt3.exe'), 'x');
 const list = [{id: 101, title: 'A', unlocked: true, date: '2026-01-01'}, {id: 202, title: 'B', unlocked: false}, {id: 303, title: 'C', unlocked: false}];
 const m = new AchievementProviderManager({config: () => ({}), dir: d, providers: {retro: {gamesList: async () => ({1111: 'Dragon Ball Z: Budokai Tenkaichi 3'})}, achievements: async () => ({status: 'ok', achievements: list.map(a => ({...a})), total: 3, unlocked: 1})}, account: () => null});
 const game = {id: 'bt3', uuid: '0f8fad5b-d9cb-469f-a165-70867728950e', title: 'bt3', profile: 'pc', path: path.join(d, 'bt3.exe'), platformKey: 'ps2'};
 let r = await m.read(game);
 assert.equal(r.manualAllowed, true);
 assert.equal(r.achievements.filter(a => a.unlocked).length, 1);
 assert.ok(m.portStore.record(game.uuid, 202, 1761400000, {manual: true}), 'ID grande do RetroAchievements aceito');
 r = await m.read(game);
 const b = r.achievements.find(a => a.id === 202);
 assert.equal(b.unlocked, true); assert.equal(b.manual, true); assert.equal(b.date, 1761400000);
 assert.equal(r.achievements.find(a => a.id === 101).manual, undefined, 'a feita no emulador continua como estava');
});

test('Perfil: a lista sai na hora, sem esperar miniaturas (feitas depois, uma por vez)', async () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'comm-')), art = path.join(d, 'art'); fs.mkdirSync(art);
 fs.writeFileSync(path.join(art, 'abc123.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
 let thumbs = 0;
 const games = Array.from({length: 50}, (_, i) => ({id: 'g' + i, uuid: 'u' + i, title: 'Jogo ' + i, bindings: {a: 3000000000 + i}}));
 const ach = {achievements: [{title: 'X', unlocked: true, date: new Date().toISOString(), icon: '/art/abc123.png'}]};
 const c = createCommunity({games: () => games, account: () => 'a', steamId: () => '1', steamAppIdOf: () => null, virtualAppIdOf: () => 1, playtimeOf: () => ({}), achievementsOf: async () => ach, cachedAchievementsOf: () => ach, artDir: art,
  imageThumb: async bytes => { thumbs++; await new Promise(r => setTimeout(r, 30)); return bytes; }});
 const t0 = Date.now(); const first = await c.games();
 assert.ok(Date.now() - t0 < 200, 'não espera as miniaturas');
 assert.equal(first.games.length, 50);
 await new Promise(r => setTimeout(r, 300));
 assert.equal(thumbs, 1, 'a mesma imagem vira miniatura uma vez só');
 assert.ok(fs.readdirSync(path.join(d, 'cache', 'community-thumbs')).length >= 1, 'miniatura guardada no disco');
});

test('Loja e Comunidade no cliente: anexa antes e registra o script do perfil (só roda no perfil)', async () => {
 assert.equal(isSteamWebTarget({type: 'page', url: 'https://store.steampowered.com/app/10'}), true);
 assert.equal(isSteamWebTarget({type: 'page', url: 'https://steamloopback.host/index.html'}), false);
 const sent = [];
 const inj = new SteamInjector({scripts: async () => ({community: 'window.X=1;'}), onCall: async () => ''});
 inj.ws = {readyState: 1, send: raw => { const m = JSON.parse(raw); sent.push(m); setImmediate(() => inj.onMessage(JSON.stringify({id: m.id, result: m.method === 'Target.attachToTarget' ? {sessionId: 's1'} : {}}))); }};
 await inj.handleTarget({targetId: 't1', type: 'page', url: 'https://store.steampowered.com/', title: 'Loja'});
 const add = sent.find(m => m.method === 'Page.addScriptToEvaluateOnNewDocument');
 assert.ok(add, 'script registrado antes de chegar no perfil');
 assert.match(add.params.source, /^if\(\/\^https:\\\/\\\/steamcommunity/);
 assert.ok(sent.some(m => m.method === 'Runtime.addBinding'));
 assert.equal(await inj.ensure('t1'), true, 'na Loja nada é injetado');
 assert.ok(!sent.some(m => m.method === 'Runtime.evaluate' && /window\.X=1/.test(m.params.expression || '')));
 for (const t of inj.checks.values()) clearTimeout(t);
});

test('Muitos pedidos de recarga seguidos viram poucas recargas', async () => {
 const inj = new SteamInjector({scripts: async () => ({})});
 let n = 0; inj.reloadNow = async () => { n++; await new Promise(r => setTimeout(r, 20)); };
 await Promise.all(Array.from({length: 20}, () => inj.reload()));
 assert.ok(n <= 2, 'recargas: ' + n);
});
