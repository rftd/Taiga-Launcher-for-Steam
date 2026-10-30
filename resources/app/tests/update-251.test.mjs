import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProgress, failureCode} from '../lib/legendary.mjs';
import {wikidataSteamByStore, epicSlug, steamIdFromStore} from '../lib/store-steam-id.mjs';
import {epicLibrary} from '../lib/store-library.mjs';

test('Falha do Legendary: o motivo real ("! Failure") vira um código traduzível', () => {
 const st = {};
 parseProgress(' ! Failure: Not enough available disk space! 12.30 GiB < 85.00 GiB', st);
 parseProgress('[cli] CRITICAL: Installation cannot proceed, exiting.', st);
 assert.equal(st.errorCode, 'disk'); assert.deepEqual(st.errorValues, {free: '12.30', need: '85.00'});
 assert.ok(!st.lastError, 'a frase genérica não esconde o motivo');
 assert.equal(failureCode('This game requires installation via Uplay and does not ship executable game files.').errorCode, 'uplay');
 assert.equal(failureCode('Install path "D:\\Jogos" does not exist, make sure').errorCode, 'path');
});

test('Epic → Steam pela Wikidata: slug da Epic (P6278) e productId da Microsoft Store (P5885)', async () => {
 const seen = [];
 const fake = async (url, opts = {}) => {
  seen.push(url);
  if (/launcher\.store\.epicgames\.com\/graphql/.test(url)) { assert.match(JSON.parse(opts.body).query, /catalogNs\(namespace: "lsws"\)/); return {ok: true, json: async () => ({data: {Catalog: {catalogNs: {mappings: [{pageSlug: 'lego-star-wars-the-skywalker-saga', pageType: 'productHome'}]}}}})}; }
  if (/haswbstatement%3AP6278%3Dlego-star-wars-the-skywalker-saga/.test(url)) return {ok: true, json: async () => ({query: {search: [{title: 'Q55286018'}]}})};
  if (/haswbstatement/.test(url)) return {ok: true, json: async () => ({query: {search: []}})};
  if (/wbgetentities/.test(url)) return {ok: true, json: async () => ({entities: {Q55286018: {labels: {en: {value: 'LEGO Star Wars: The Skywalker Saga'}}, claims: {P1733: [{mainsnak: {datavalue: {value: '920210'}}}]}}}})};
  throw Error('inesperado ' + url);
 };
 assert.equal(await epicSlug('lsws', fake), 'lego-star-wars-the-skywalker-saga');
 const g = {title: 'LEGO® Star Wars™: A Saga Skywalker', store: {name: 'epic', id: 'cat', namespace: 'lsws', appName: 'Hydra'}};
 const r = await steamIdFromStore(g, {}, {fetchImpl: fake});
 assert.equal(r.appId, 920210); assert.equal(r.source, 'wikidata');
 assert.equal(g.store.slug, 'lego-star-wars-the-skywalker-saga', 'slug guardado para a próxima vez');
 const none = await wikidataSteamByStore('xbox', ['9NOPE0000000'], fake);
 assert.equal(none, null);
});

test('Biblioteca Epic em português guarda também o nome em inglês (usado para achar na Steam)', async () => {
 const fake = async url => ({ok: true, json: async () => /assets\/Windows/.test(url) ? [{appName: 'Sq', namespace: 'ss', catalogItemId: 'c1'}] : /locale=pt-BR/.test(url) ? {c1: {title: 'Esquadrão Suicida: Mate a Liga da Justiça', keyImages: []}} : {c1: {title: 'Suicide Squad: Kill the Justice League™', keyImages: []}}});
 const [g] = await epicLibrary({accessToken: 't'}, {fetchImpl: fake, language: 'pt-BR'});
 assert.equal(g.title, 'Esquadrão Suicida: Mate a Liga da Justiça');
 assert.equal(g.titleEn, 'Suicide Squad: Kill the Justice League');
});
