import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createComments, gameCommentKey, safeComment} from '../lib/comments.mjs';

// D1 de mentira (SQLite em memória) com a mesma interface usada pelo Worker.
function fakeD1() {
 const db = new DatabaseSync(':memory:');
 const stmt = (sql, args = []) => ({bind: (...a) => stmt(sql, a), first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({results: db.prepare(sql).all(...args)}), run: async () => { const r = db.prepare(sql).run(...args); return {success: true, meta: {last_row_id: Number(r.lastInsertRowid)}}; }, exec() { db.prepare(sql).run(...args); }});
 return {prepare: sql => stmt(sql), batch: async list => { for (const s of list) s.exec(); return []; }};
}
const AVATAR = 'https://avatars.steamstatic.com/' + 'a'.repeat(40) + '_full.jpg';
let seq = 0;
async function setup({level = 10, isPublic = true, valid = true} = {}) {
 const worker = (await import('../tools/profile-server/worker.js?t=' + (++seq))).default;
 const env = {DB: fakeD1(), STEAM_KEY: 'k', COMMENTS_MIN_LEVEL: '5'}, state = {level, isPublic, valid, steamCalls: 0};
 const realFetch = globalThis.fetch;
 globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.steampowered.com/ISteamUser/GetPlayerSummaries')) { state.steamCalls++; const id = new URL(u).searchParams.get('steamids'); return Response.json({response: {players: [{steamid: id, personaname: 'Jogador\u0007 ' + id.slice(-2), avatarfull: AVATAR, communityvisibilitystate: state.isPublic ? 3 : 1}]}}); }
  if (u.startsWith('https://api.steampowered.com/IPlayerService/GetSteamLevel')) return Response.json({response: {player_level: state.level}});
  if (u === 'https://steamcommunity.com/openid/login' && opts.method === 'POST') { const body = new URLSearchParams(String(opts.body)); assert.equal(body.get('openid.mode'), 'check_authentication'); return new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:' + (state.valid ? 'true' : 'false') + '\n'); }
  return realFetch(url, opts);
 };
 const call = (url, opts = {}) => worker.fetch(new Request(url, opts), env, {waitUntil() {}});
 return {worker, env, state, call, restore: () => { globalThis.fetch = realFetch; }};
}
// O que a página da Steam faria: abre o login do Taiga, vai para a Steam e volta com a resposta assinada.
async function steamSignIn(call, loginUrl, steamid, tamper = {}) {
 const go = await call(loginUrl); assert.equal(go.status, 302);
 const to = new URL(go.headers.get('location')); assert.equal(to.origin + to.pathname, 'https://steamcommunity.com/openid/login');
 const back = new URL(to.searchParams.get('openid.return_to'));
 const claimed = 'https://steamcommunity.com/openid/id/' + steamid;
 const p = {'openid.ns': 'http://specs.openid.net/auth/2.0', 'openid.mode': 'id_res', 'openid.op_endpoint': 'https://steamcommunity.com/openid/login', 'openid.claimed_id': claimed, 'openid.identity': claimed, 'openid.return_to': back.toString(), 'openid.response_nonce': '2026-10-26T00:00:00Zabc', 'openid.assoc_handle': '1234567890', 'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle', 'openid.sig': 'x', ...tamper};
 for (const [k, v] of Object.entries(p)) back.searchParams.set(k, v);
 return call(back.toString());
}

test('Chave do jogo: a mesma em qualquer versão (port, emulador, nome com ® ou região) e sem nada do PC', () => {
 const gow = gameCommentKey({title: 'spartanport', profile: 'pc', path: 'C:\\Users\\Ana\\SpartanPort 1.4\\bin\\spartanport.exe'}, {title: 'God of War III Remastered', platform: 'ps4'});
 assert.equal(gow, 'title:ps4:god-of-war-3-remastered');
 assert.equal(gameCommentKey({title: 'GOW3', profile: 'pc'}, {title: 'God of War® III Remastered', platform: 'PlayStation 4'}), gow, 'versão nova do port lida pelo PARAM.SFO');
 assert.equal(gameCommentKey({title: 'God of War 3 Remastered', platformKey: 'ps4', serial: 'CUSA01715', profile: 'shadps4'}), gow, 'mesmo jogo no emulador, outra região');
 assert.equal(gameCommentKey({title: 'Dragon Ball Z: Budokai Tenkaichi 3 (USA)', platformKey: 'ps2', raId: 1111}), 'title:ps2:dragon-ball-z-budokai-tenkaichi-3');
 assert.equal(gameCommentKey({title: 'bt3', profile: 'pc', raId: 1111}, {title: 'Dragon Ball Z: Budokai Tenkaichi 3', platform: 'ps2'}), 'title:ps2:dragon-ball-z-budokai-tenkaichi-3', 'decomp e emulador juntos');
 assert.equal(gameCommentKey({title: '', serial: 'SLUS-21678', platformKey: 'ps2'}), 'serial:ps2:slus21678');
 assert.doesNotMatch(gow, /users|ana|exe/);
});

test('Dados do servidor são conferidos antes de chegar à Steam', () => {
 assert.equal(safeComment({id: 'abc', steamid: '76561198000000001', at: 1, body: 'x'}), null);
 const c = safeComment({id: '42', steamid: '76561198000000001', at: 5, body: 'oi\u0000<img src=x onerror=alert(1)>', name: 'N\u202eome', avatar: 'javascript:alert(1)', extra: 'x'});
 assert.equal(c.avatar, 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg');
 assert.equal(c.name, 'Nome'); assert.equal(c.body, 'oi<img src=x onerror=alert(1)>', 'texto vai como texto (a página nunca usa como HTML)');
 assert.equal('extra' in c, false);
});

test('Login pela Steam, comentar, listar, limites, denunciar e apagar (Worker + programa)', async () => {
 const w = await setup({level: 3});
 try {
  const config = {}; let saved = 0;
  const api = createComments({server: () => 'https://w.test', config: () => config, saveConfig: () => { saved++; }, fetchImpl: (url, opts) => w.call(url, opts)});
  const {url} = await api.startLogin();
  assert.match(url, /^https:\/\/w\.test\/v1\/auth\/steam\?id=[0-9a-f]{32}$/);
  assert.equal(api.state().pending, true);
  const page = await steamSignIn(w.call, url, '76561198000000001');
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  for (let i = 0; i < 40 && !api.state().loggedIn; i++) await new Promise(r => setTimeout(r, 100));
  assert.equal(api.state().loggedIn, true); assert.ok(saved >= 1);
  assert.match(config.commentsAuth.token, /^[0-9a-f]{64}$/);
  assert.equal(api.state().me.name, 'Jogador 01', 'nome sem caracteres de controle');
  // A sessão fica guardada só como hash no servidor.
  const row = await w.env.DB.prepare('SELECT k AS token FROM cs').first();
  assert.notEqual(row.token, config.commentsAuth.token);

  await assert.rejects(api.post('ra:1111', 'Muito bom!'), e => e.code === 'low_level' && e.minLevel === 5);
  w.state.level = 12; await w.env.DB.prepare('UPDATE cu SET t = 0').run();
  const {item} = await api.post('ra:1111', 'Muito bom!\n\n\n\nRecomendo');
  assert.equal(item.body, 'Muito bom!\n\nRecomendo');
  await assert.rejects(api.post('ra:1111', 'Outro'), e => e.code === 'slow_down');
  await w.env.DB.prepare('UPDATE cm SET t = t - 60').run();
  await assert.rejects(api.post('ra:1111', 'veja em https://exemplo.com'), e => e.code === 'no_links');
  await assert.rejects(api.post('ra:1111', 'baixe em site.xyz'), e => e.code === 'no_links');
  await assert.rejects(api.post('ra:1111', 'x'.repeat(501)), e => e.code === 'too_long');

  const list = await api.list('ra:1111');
  assert.equal(list.items.length, 1); assert.equal(list.total, 1); assert.equal(list.items[0].name, 'Jogador 01');
  assert.equal((await api.list('ra:2222')).items.length, 0, 'cada jogo tem os seus');

  await assert.rejects(api.report(item.id), e => e.code === 'own');
  await assert.rejects(api.like(item.id), e => e.code === 'own', 'não curte o próprio comentário');
  assert.deepEqual(await api.remove(item.id), {ok: true});
  assert.equal((await api.list('ra:1111')).items.length, 0);

  await api.logout();
  assert.equal(config.commentsAuth, null);
  assert.equal(await w.env.DB.prepare('SELECT k AS token FROM cs').first(), null, 'sessão apagada no servidor');
  await assert.rejects(api.post('ra:1111', 'oi'), e => e.code === 'login');
 } finally { w.restore(); }
});

test('Três denúncias escondem o comentário; perfil privado não comenta', async () => {
 const w = await setup({level: 20});
 try {
  const users = [];
  for (const sid of ['76561198000000011', '76561198000000012', '76561198000000013', '76561198000000014']) {
   const config = {}; const api = createComments({server: () => 'https://w.test', config: () => config, saveConfig() {}, fetchImpl: (url, opts) => w.call(url, opts)});
   const {url} = await api.startLogin(); await steamSignIn(w.call, url, sid);
   for (let i = 0; i < 40 && !api.state().loggedIn; i++) await new Promise(r => setTimeout(r, 100));
   assert.equal(api.state().loggedIn, true); users.push(api);
  }
  const {item} = await users[0].post('igdb:9', 'Comentário');
  await new Promise(r => setTimeout(r, 5));
  await users[1].post('igdb:9', 'Outro');
  assert.deepEqual(await users[2].like(item.id), {ok: true, likes: 1, liked: true});
  assert.equal((await users[3].like(item.id)).likes, 2);
  assert.equal((await users[3].like(item.id, false)).likes, 1, 'descurtir');
  const pop = await users[2].list('igdb:9', {sort: 'popular'});
  assert.equal(pop.items[0].id, item.id, 'mais curtido primeiro'); assert.equal(pop.items[0].liked, true); assert.equal(pop.items[1].liked, false);
  assert.equal((await users[2].list('igdb:9')).items[0].body, 'Outro', 'recentes primeiro');
  assert.equal((await users[2].list('igdb:9', {offset: 1})).items.length, 1);
  await users[1].report(item.id); await users[2].report(item.id);
  assert.equal((await users[0].list('igdb:9')).items.length, 2);
  assert.equal((await users[3].report(item.id)).hidden, true);
  // (users[0] guardou a lista por 20 s; quem ainda não tinha lido vê o resultado na hora.)
  assert.equal((await users[1].list('igdb:9')).items.length, 1);
  w.state.isPublic = false; await w.env.DB.prepare('UPDATE cu SET t = 0').run();
  await assert.rejects(users[1].post('igdb:9', 'oi'), e => e.code === 'private_profile');
 } finally { w.restore(); }
});

test('Login falso não entra: a Steam precisa confirmar, e o endereço de volta não pode ser trocado', async () => {
 const w = await setup({valid: false});
 try {
  const config = {}; const api = createComments({server: () => 'https://w.test', config: () => config, saveConfig() {}, fetchImpl: (url, opts) => w.call(url, opts)});
  const a = await api.startLogin();
  assert.equal((await steamSignIn(w.call, a.url, '76561198000000001')).status, 400, 'Steam disse que não é válido');
  w.state.valid = true;
  const b = await api.startLogin();
  assert.equal((await steamSignIn(w.call, b.url, '76561198000000001', {'openid.op_endpoint': 'https://evil.example/openid/login'})).status, 400);
  assert.equal((await steamSignIn(w.call, b.url, '76561198000000001', {'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000002'})).status, 400, 'identidade diferente da assinada');
  await new Promise(r => setTimeout(r, 2300));
  assert.equal(api.state().loggedIn, false);
  assert.equal(await w.env.DB.prepare('SELECT k AS token FROM cs').first(), null);
  // Sem o segredo do programa, ninguém pega a sessão de outro login.
  const poll = await w.call('https://w.test/v1/auth/poll', {method: 'POST', body: JSON.stringify({id: b.url.slice(-32), verifier: 'f'.repeat(64)})});
  assert.equal(poll.status, 410);
  await api.logout();
 } finally { w.restore(); }
});

test('Moderação só com a chave de administrador', async () => {
 const w = await setup();
 try {
  w.env.ADMIN_KEY = 'x'.repeat(32);
  assert.equal((await w.call('https://w.test/v1/admin/comments')).status, 401);
  assert.equal((await w.call('https://w.test/v1/admin/comments', {headers: {'x-admin-key': 'y'.repeat(32)}})).status, 401);
  assert.equal((await w.call('https://w.test/v1/admin/comments', {headers: {'x-admin-key': 'x'.repeat(32)}})).status, 200);
  const page = await w.call('https://w.test/v1/admin');
  assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/);
 } finally { w.restore(); }
});

test('Banco de cache cheio: o Worker apaga as respostas mais antigas e continua; comentários podem ter banco próprio', async () => {
 const worker = (await import('../tools/profile-server/worker.js?t=full')).default;
 const cache = fakeD1(); await cache.prepare('CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, status INTEGER NOT NULL, at INTEGER NOT NULL)').run();
 for (let i = 0; i < 8; i++) await cache.prepare('INSERT INTO cache VALUES (?, ?, 200, ?)').bind('old' + i, '[1]', i).run();
 let fullOnce = true; const realPrepare = cache.prepare;
 cache.prepare = sql => { const st = realPrepare(sql); if (!/^INSERT INTO cache/.test(sql)) return st; return {bind: (...a) => { const b = st.bind(...a); return {...b, run: async () => { if (fullOnce) { fullOnce = false; throw Error('D1_ERROR: Exceeded maximum DB size'); } return b.run(); }}; }}; };
 const waits = []; const realFetch = globalThis.fetch, realCaches = globalThis.caches;
 globalThis.caches = {default: {match: async () => null, put: async () => {}}};
 globalThis.fetch = async () => Response.json({success: true, data: [{id: 1}]});
 try {
  const res = await worker.fetch(new Request('https://w.test/v1/sgdb/search/autocomplete/x'), {DB: cache, SGDB_KEY: 'k', CACHE_SAVE_RATE: '1'}, {waitUntil: p => waits.push(p)});
  assert.equal(res.status, 200); await Promise.all(waits);
  const n = (await cache.prepare('SELECT COUNT(*) AS n FROM cache').first()).n;
  assert.equal(n, 1, 'apagou um lote das mais antigas (sem contar a tabela inteira) e gravou a nova');
  assert.ok(await cache.prepare("SELECT 1 FROM cache WHERE k <> 'old0' AND v = '{\"success\":true,\"data\":[{\"id\":1}]}'").first(), 'a resposta nova ficou salva');
  assert.equal(await cache.prepare("SELECT 1 FROM cache WHERE k = 'old0'").first(), null, 'as mais antigas saem primeiro');
  const own = fakeD1();
  const h = await (await worker.fetch(new Request('https://w.test/v1/health'), {DB: cache, COMMENTS_DB: own, STEAM_KEY: 'k'}, {waitUntil() {}})).json();
  assert.equal(h.commentsDb, 'own'); assert.equal(h.commentsMinLevel, 3, 'nível mínimo padrão: 3');
  await worker.fetch(new Request('https://w.test/v1/comments?game=ra:1'), {DB: cache, COMMENTS_DB: own, STEAM_KEY: 'k'}, {waitUntil() {}});
  assert.ok(await own.prepare("SELECT name FROM sqlite_master WHERE name = 'cm'").first(), 'tabelas dos comentários no banco próprio');
  assert.equal(await cache.prepare("SELECT name FROM sqlite_master WHERE name = 'cm'").first(), null);
 } finally { globalThis.fetch = realFetch; globalThis.caches = realCaches; }
});

test('Idioma: cada um vê os comentários no idioma do programa, conta os de outros idiomas e pode ver todos', async () => {
 const w = await setup({level: 20});
 try {
  const make = async sid => { const config = {}; const api = createComments({server: () => 'https://w.test', config: () => config, saveConfig() {}, fetchImpl: (url, opts) => w.call(url, opts)}); const {url} = await api.startLogin(); await steamSignIn(w.call, url, sid); for (let i = 0; i < 40 && !api.state().loggedIn; i++) await new Promise(r => setTimeout(r, 100)); return api; };
  const pt = await make('76561198000000021'), en = await make('76561198000000022');
  await pt.post('ra:7', 'Jogo muito bom', 'pt');
  await en.post('ra:7', 'Great game', 'en');
  // Comentário antigo, de antes do idioma: aparece para todos.
  await w.env.DB.prepare("INSERT INTO cm (g, u, b, t) VALUES ((SELECT id FROM cgm WHERE k = 'ra:7'), 1, 'antigo', 1)").run();
  const mine = await pt.list('ra:7', {lang: 'pt'});
  assert.deepEqual(mine.items.map(c => c.body).sort(), ['Jogo muito bom', 'antigo']);
  assert.equal(mine.total, 2); assert.equal(mine.others, 1);
  assert.equal(mine.items.find(c => c.body === 'Jogo muito bom').lang, 'pt');
  const all = await pt.list('ra:7', {lang: 'pt', all: true});
  assert.equal(all.items.length, 3); assert.equal(all.items.find(c => c.body === 'Great game').lang, 'en');
  assert.deepEqual(pt.seenComment(all.items.find(c => c.lang === 'en').id), {body: 'Great game', lang: 'en'}, 'tradução só do que o servidor mandou');
  const health = await (await w.call('https://w.test/v1/health')).json();
  assert.equal(health.commentsCheck, 'ok');
 } finally { w.restore(); }
});
