import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommunity} from '../lib/community.mjs';

test('Perfil da Comunidade: a lista de jogos responde na hora, sem esperar conquistas', async () => {
 const games = Array.from({length: 50}, (_, i) => ({uuid: 'u' + i, title: 'Jogo ' + i, bindings: {1: 3000000000 + i}, notInstalled: i % 2 === 0}));
 let asked = 0;
 const c = createCommunity({games: () => games, account: () => '1', steamId: () => '7', steamAppIdOf: () => null, virtualAppIdOf: () => 1, playtimeOf: () => null,
  achievementsOf: () => { asked++; return new Promise(r => setTimeout(() => r({achievements: []}), 3000)); }, cachedAchievementsOf: () => null, artDir: '/tmp'});
 const t = Date.now(); const r = await c.games();
 assert.ok(Date.now() - t < 500, 'respondeu em ' + (Date.now() - t) + ' ms');
 assert.equal(r.games.length, 50);
 await new Promise(res => setTimeout(res, 50));
 assert.ok(asked > 0 && asked <= 3, 'busca em segundo plano, 3 por vez (pedidos: ' + asked + ')');
});
