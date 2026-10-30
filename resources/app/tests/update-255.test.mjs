import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {cardSet, cardSvg, seededPick} from '../lib/cards.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cards-'));

test('Cartas: personagens do IGDB (foto e nome) quando o jogo tem', async () => {
 const dir = tmp(); const queries = [];
 const ig = async (q, endpoint = 'games') => { queries.push([endpoint, q]); if (endpoint === 'games') return [{id: 11, name: 'God of War'}]; return [{name: 'Kratos', mug_shot: {image_id: 'abc'}}, {name: 'Zeus', mug_shot: {image_id: 'def'}}, {name: 'Athena', mug_shot: {image_id: 'ghi'}}]; };
 const image = async url => { const f = url.split('/').pop(); fs.writeFileSync(path.join(dir, f), 'x'); return f; };
 const r = await cardSet({id: 'g1', title: 'God of War'}, {igAvailable: () => true, ig, image, achievements: async () => [], artDir: dir});
 assert.equal(r.source, 'igdb'); assert.deepEqual(r.items.map(i => i.name), ['Kratos', 'Zeus', 'Athena']);
 assert.ok(queries.some(([e, q]) => e === 'characters' && /where games = \(11\)/.test(q)));
});

test('Cartas: sem personagens, conquistas do jogo escolhidas ao acaso (sempre as mesmas)', async () => {
 const dir = tmp();
 const list = Array.from({length: 20}, (_, i) => ({title: 'Conquista ' + i, icon: 'https://media.retroachievements.org/Badge/' + i + '.png'}));
 const image = async url => { const f = url.split('/').pop(); fs.writeFileSync(path.join(dir, f), 'x'); return f; };
 const a = await cardSet({id: 'g2', title: 'Jogo'}, {igAvailable: () => false, image, achievements: async () => list, artDir: dir});
 const b = await cardSet({id: 'g2', title: 'Jogo'}, {igAvailable: () => false, image, achievements: async () => list, artDir: dir});
 assert.equal(a.source, 'achievements'); assert.equal(a.items.length, 8);
 assert.deepEqual(a.items.map(i => i.name), b.items.map(i => i.name));
 assert.notDeepEqual(a.items.map(i => i.name), list.slice(0, 8).map(x => x.title), 'ordem embaralhada');
 assert.equal(seededPick([1, 2, 3], 's', 2).length, 2);
});

test('Carta em SVG com a imagem embutida, nome e logo', () => {
 const dir = tmp(), img = path.join(dir, 'a.jpg'); fs.writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
 const svg = cardSvg({image: img, name: 'Kratos & <Zeus>', title: 'God of War'});
 assert.match(svg, /^<svg/); assert.match(svg, /data:image\/jpeg;base64,/); assert.match(svg, /Kratos &amp; &lt;Zeus&gt;/); assert.match(svg, /GOD OF WAR/);
});

test('Cartas: sem personagens e sem conquistas, usa artes do IGDB e depois as imagens que o programa já tem', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cards-'));
 for (const f of ['m1.jpg', 'm2.jpg', 'hero.jpg']) fs.writeFileSync(path.join(dir, f), 'x');
 const ig = async (q, endpoint = 'games') => endpoint === 'characters' ? [] : /^search/.test(q) ? [{id: 5, name: 'Grand Theft Auto: Liberty City Stories', platforms: [38]}, {id: 6, name: 'Grand Theft Auto: Liberty City Stories', platforms: [8]}] : [{id: 5, artworks: [{image_id: 'art1'}], screenshots: [{image_id: 'sc1'}]}];
 const image = async url => { const f = url.split('/').pop(); fs.writeFileSync(path.join(dir, f), 'x'); return f; };
 const r = await cardSet({id: 'gta', title: 'Grand Theft Auto: Liberty City Stories'}, {igAvailable: () => true, ig, image, achievements: async () => [], media: () => [{file: 'm1.jpg'}, {file: 'm2.jpg'}, {file: 'hero.jpg'}], platformIgdb: 38, artDir: dir});
 assert.equal(r.items.length, 5); assert.equal(r.source, 'scenes');
 assert.ok(r.items.some(i => i.file === 'art1.jpg') && r.items.some(i => i.file === 'm1.jpg'));
});
