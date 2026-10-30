import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildActivity, createGameExtras, pickSimilar, unlockSeconds} from '../lib/game-extras.mjs';
import {SessionStore} from '../lib/launch-engine.mjs';

test('Linha do tempo: só conquistas por dia (sem marcos, sessões nem primeira vez)', () => {
 const day = 86400, base = 1790000000;
 const ach = [
  {title: 'A', unlocked: true, date: base, icon: '/art/a.png'}, {title: 'B', unlocked: true, date: String((base + 60) * 1000), icon: ''},
  {title: 'C', unlocked: true, date: new Date((base + 2 * day) * 1000).toISOString()}, {title: 'D', unlocked: false},
 ];
 const sessions = [{startedAt: new Date((base - day) * 1000).toISOString(), seconds: 3600}, {startedAt: new Date((base - day + 4000) * 1000).toISOString(), seconds: 1200}, {startedAt: new Date(base * 1000).toISOString(), seconds: 30}];
 const a = buildActivity({achievements: ach, sessions, iconUrl: u => u ? 'X' + u : ''});
 const kinds = a.map(x => x.kind + (x.type ? ':' + x.type : ''));
 assert.deepEqual(kinds, ['achievements', 'achievements']);
 assert.equal(a[1].count, 2); assert.equal(a[1].progress, 2); assert.equal(a[1].total, 4); assert.equal(a[1].items[1].icon, 'X/art/a.png');
 assert.equal(a[0].progress, 3);
 const all = buildActivity({achievements: ach.map(x => ({...x, unlocked: true, date: x.date || base + 3 * day}))});
 assert.ok(all.every(x => x.kind === 'achievements'), 'sem marcos de metade/todas');
 assert.equal(unlockSeconds('2026-01-01 10:00:00'), Date.parse('2026-01-01T10:00:00Z') / 1000);
});

test('Trailers, capturas e jogos parecidos: busca uma vez, guarda 30 dias, responde na hora', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gx-'));
 let queries = 0; const downloaded = [];
 const ig = async q => { queries++; if (q.startsWith('search')) return [{id: 77, name: 'Dragon Ball Z: Budokai Tenkaichi 3', platforms: [8]}];
  return [{videos: [{video_id: 'dQw4w9WgXcQ', name: 'Trailer'}, {video_id: 'bad"id'}], screenshots: [{image_id: 'scr8ab1'}, {image_id: '../x'}], similar_games: [{name: 'Budokai 3', url: 'https://www.igdb.com/games/budokai-3', cover: {image_id: 'co2xyz'}, first_release_date: 1070000000}, {name: 'Sem capa'}]}]; };
 const gx = createGameExtras({cacheDir: dir, ig, image: async url => { downloaded.push(url); return 'f' + downloaded.length + '.jpg'; }});
 const g = {uuid: 'u1', title: 'Dragon Ball Z: Budokai Tenkaichi 3'};
 let saved = 0;
 const first = gx.get(g, {title: g.title, onResolved: () => saved++});
 assert.equal(first.pending, true, 'responde na hora, sem esperar o IGDB');
 const r = await gx.wait(g, {title: g.title, onResolved: () => saved++});
 assert.equal(g.igdbId, 77); assert.ok(saved >= 1);
 assert.deepEqual(r.videos, [], 'só imagens (sem trailers)');
 assert.deepEqual(downloaded, ['https://images.igdb.com/igdb/image/upload/t_screenshot_big/scr8ab1.jpg', 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2xyz.jpg']);
 assert.equal(r.similar.length, 1); assert.equal(r.similar[0].year, 2003);
 const q = queries; gx.get(g, {title: g.title}); assert.equal(queries, q, 'depois fica guardado');
});

test('Histórico de sessões do jogo lido da pasta session-history', () => {
 const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sh-')); fs.mkdirSync(path.join(d, 'session-history'));
 const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
 fs.writeFileSync(path.join(d, 'session-history', '1f8fad5b-d9cb-469f-a165-70867728950e.json'), JSON.stringify({id: '1f8fad5b-d9cb-469f-a165-70867728950e', uuid, account: 'a', seconds: 120, startedAt: '2026-10-01T10:00:00Z'}));
 fs.writeFileSync(path.join(d, 'session-history', '2f8fad5b-d9cb-469f-a165-70867728950e.json'), JSON.stringify({id: '2f8fad5b-d9cb-469f-a165-70867728950e', uuid: '3f8fad5b-d9cb-469f-a165-70867728950e', account: 'a', seconds: 50, startedAt: '2026-10-01T10:00:00Z'}));
 const s = new SessionStore(d);
 assert.equal(s.history(uuid, 'a').length, 1);
 assert.equal(s.history(uuid, 'b').length, 0);
});

test('Se você gosta deste jogo: franquia primeiro, sem remasters nem coletâneas, completa com parecidos', () => {
 const t = y => Date.UTC(y, 0, 1) / 1000, cover = {image_id: 'abcdef12'};
 const family = [['God of War', 2005, 900], ['God of War II', 2007, 700], ['God of War III Remastered', 2015, 300], ['God of War: Chains of Olympus', 2008, 250], ['God of War: Ghost of Sparta', 2010, 260], ['God of War: Ascension', 2013, 400], ['God of War Ragnarök', 2022, 2000], ['God of War Collection', 2009, 150]].map(([name, y, r], i) => ({id: i + 10, name, first_release_date: t(y), total_rating_count: r, cover}));
 const picked = pickSimilar({self: {id: 1, name: 'God of War III', year: 2010, platforms: [9]}, family, similar: []});
 assert.equal(picked.length, 4);
 assert.ok(picked.every(x => x.family && !/Remastered|Collection/.test(x.name)));
 assert.equal(picked[0].name, 'God of War: Ghost of Sparta');
 const similar = [{id: 99, name: 'Bayonetta', first_release_date: t(2009), platforms: [9], cover, total_rating_count: 900}, {id: 98, name: 'Hades', first_release_date: t(2020), platforms: [6], cover, total_rating_count: 3000}];
 assert.deepEqual(pickSimilar({self: {id: 1, name: 'Okami', year: 2006, platforms: [9]}, similar}).map(x => x.name), ['Bayonetta', 'Hades']);
 assert.equal(pickSimilar({self: {id: 1, name: 'X', year: 2006}, family: family.slice(0, 2), similar}).length, 4);
});
