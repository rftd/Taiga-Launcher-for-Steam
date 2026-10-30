import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {editionBase} from '../lib/title-match.mjs';
import {steamAppByName} from '../lib/identify.mjs';
import {wikidataSteamByName, pickSteamId} from '../lib/store-steam-id.mjs';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';

test('Nome sem o sufixo de edição da loja, sem cortar nomes que são o próprio jogo', () => {
 assert.equal(editionBase('Rise of the Tomb Raider: 20 Year Celebration'), 'Rise of the Tomb Raider');
 assert.equal(editionBase('The Witcher 3: Wild Hunt - Complete Edition'), 'The Witcher 3: Wild Hunt');
 assert.equal(editionBase('Tomb Raider GOTY'), 'Tomb Raider');
 assert.equal(editionBase('LEGO® Star Wars™: The Skywalker Saga'), 'LEGO Star Wars: The Skywalker Saga');
 assert.equal(editionBase('Mass Effect Legendary Edition'), 'Mass Effect Legendary Edition');
 assert.equal(editionBase('Alan Wake Remastered'), 'Alan Wake Remastered');
});

test('Jogo da Epic com nome de edição acha o jogo base na Steam', async () => {
 const steamLink = {search: async q => ({items: /^Rise of the Tomb Raider$/i.test(q) ? [{appId: 391220, name: 'Rise of the Tomb Raider'}, {appId: 203160, name: 'Tomb Raider'}] : []})};
 const r = await steamAppByName({title: 'Rise of the Tomb Raider: 20 Year Celebration', storeName: 'Rise of the Tomb Raider: 20 Year Celebration', store: {name: 'epic'}, path: 'C:\\x\\ROTTR.exe'}, steamLink);
 assert.equal(r.confident, true); assert.equal(r.appId, 391220);
 // Fora de loja (só o nome do arquivo), o nome de edição sozinho não basta.
 const loose = await steamAppByName({title: 'Rise of the Tomb Raider: 20 Year Celebration', path: 'C:\\x\\ROTTR.exe'}, steamLink);
 assert.equal(loose.confident, false);
});

test('Wikidata pelo nome: item de videogame com o mesmo rótulo; vários AppIDs escolhem o preferido', async () => {
 const fake = async url => {
  if (/list=search/.test(url)) return {ok: true, json: async () => ({query: {search: /Rise\+of\+the\+Tomb\+Raider%22/.test(url) ? [{title: 'Q19595624'}, {title: 'Q999'}] : []}})};
  if (/wbgetentities/.test(url)) return {ok: true, json: async () => ({entities: {
   Q19595624: {id: 'Q19595624', labels: {en: {value: 'Rise of the Tomb Raider'}}, claims: {P1733: [{rank: 'preferred', mainsnak: {datavalue: {value: '391220'}}}, {rank: 'normal', mainsnak: {datavalue: {value: '417810'}}}]}},
   Q999: {id: 'Q999', labels: {en: {value: 'Rise of the Tomb Raider: Baba Yaga'}}, claims: {P1733: [{mainsnak: {datavalue: {value: '1'}}}]}}}})};
  throw Error('inesperado ' + url);
 };
 const r = await wikidataSteamByName(['Rise of the Tomb Raider: 20 Year Celebration'], fake);
 assert.equal(r.appId, 391220); assert.equal(r.qid, 'Q19595624');
 const steamFake = async url => ({ok: true, json: async () => /appids=10/.test(url) ? {10: {success: true, data: {type: 'game'}}} : {20: {success: true, data: {type: 'dlc'}}}});
 assert.equal(await pickSteamId({claims: {P1733: [{mainsnak: {datavalue: {value: '10'}}}, {mainsnak: {datavalue: {value: '20'}}}]}}, steamFake), 10);
});

test('Port EXE com RetroAchievements escolhido: o jogo é achado pelo nome no console do jogo', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ra-port-'));
 const retro = {gamesList: async id => id === 21 ? {2756: 'Gran Turismo 4', 9: '~Hack~ Gran Turismo 4 Plus', 3: 'Gran Turismo 3: A-Spec'} : {}, credentials: () => null};
 let saved = 0;
 const m = new AchievementProviderManager({config: () => ({}), dir, providers: {retro, achievements: async g => ({status: 'ok', achievements: [{id: 1}], total: 1, unlocked: 0, raId: g.raId})}, account: () => null, onGameChange: () => saved++});
 const game = {id: 'g', title: 'Gran Turismo 4', profile: 'pc', path: path.join(dir, 'gt4.exe'), platformName: 'PlayStation 2', achievementSettings: {provider: 'retroachievements'}};
 const r = await m.read(game);
 assert.equal(game.raId, 2756); assert.equal(saved, 1); assert.equal(r.provider, 'retroachievements'); assert.equal(r.raId, 2756);
 fs.rmSync(dir, {recursive: true, force: true});
});
