import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHousekeeping} from '../lib/housekeeping.mjs';
import {updateScript} from '../lib/updater.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hk-'));
const put = (f, data = 'x', ageDays = 0) => { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, data); if (ageDays) { const t = new Date(Date.now() - ageDays * 864e5); fs.utimesSync(f, t, t); } };

test('Limpeza: atualizações instaladas, backups velhos, imagens órfãs antigas e miniaturas; o que é usado fica', async () => {
 const d = tmp();
 put(path.join(d, 'updates', 'taiga-launcher-3.0.3.zip'), 'old');
 put(path.join(d, 'updates', 'taiga-launcher-3.1.0.zip'), 'cur');
 put(path.join(d, 'updates', 'taiga-launcher-3.2.0.zip'), 'next');
 for (let i = 0; i < 9; i++) { const dir = path.join(d, 'backups', 'artwork', '123', (1700000000000 + i) + '-abc'); put(path.join(dir, '0.bak'), 'b'); put(path.join(dir, 'manifest.json'), JSON.stringify({status: 'committed'})); }
 for (let i = 0; i < 20; i++) put(path.join(d, 'backups', '123', (1700000000000 + i) + '-shortcuts.vdf'), 'v');
 const used = 'a'.repeat(24) + '.png', inCache = 'b'.repeat(64) + '.png', orphan = 'c'.repeat(24) + '.jpg', fresh = 'd'.repeat(24) + '.png';
 put(path.join(d, 'art', used), 'u', 10); put(path.join(d, 'art', inCache), 'i', 10); put(path.join(d, 'art', orphan), 'o', 10); put(path.join(d, 'art', fresh), 'f');
 put(path.join(d, 'art', 'legado.png'), 'l', 10);
 put(path.join(d, 'cache', 'achievement-x.json'), JSON.stringify({data: {achievements: [{icon: '/art/' + inCache}]}}));
 put(path.join(d, 'cache', 'community-thumbs', 'velha'), 't', 40); put(path.join(d, 'cache', 'community-thumbs', 'nova'), 't');
 const hk = createHousekeeping({dataDir: d, version: '3.1.0', games: () => [{id: 'g', art: {cover: used}}]});
 const r = await hk.run();
 const has = (...p) => fs.existsSync(path.join(d, ...p));
 assert.ok(!has('updates', 'taiga-launcher-3.0.3.zip') && !has('updates', 'taiga-launcher-3.1.0.zip') && has('updates', 'taiga-launcher-3.2.0.zip'));
 assert.equal(fs.readdirSync(path.join(d, 'backups', 'artwork', '123')).length, 5);
 assert.equal(fs.readdirSync(path.join(d, 'backups', '123')).length, 15);
 assert.ok(has('art', used) && has('art', inCache) && has('art', fresh) && has('art', 'legado.png'));
 assert.ok(!has('art', orphan));
 assert.ok(!has('cache', 'community-thumbs', 'velha') && has('cache', 'community-thumbs', 'nova'));
 assert.ok(r.files >= 10 && r.bytes > 0);
 assert.ok(hk.usage().total > 0);
 fs.rmSync(d, {recursive: true, force: true});
});

test('Limpeza: sem a lista de jogos nenhuma imagem é apagada', async () => {
 const d = tmp(), name = 'e'.repeat(24) + '.png';
 put(path.join(d, 'art', name), 'x', 30);
 await createHousekeeping({dataDir: d, version: '3.1.0', games: () => []}).run();
 assert.ok(fs.existsSync(path.join(d, 'art', name)));
 fs.rmSync(d, {recursive: true, force: true});
});

test('Atualização apaga o pacote baixado depois de instalar; janela de apoio e armazenamento nos 5 idiomas', () => {
 assert.match(updateScript({zip: 'C:\\x.zip', installDir: 'C:\\T', pid: 1}), /Remove-Item -LiteralPath \$zip/);
 const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
 for (const k of ['function supportDialog', 'function supportDue', "case 'supd-done'", "case 'storage-clean'", 'canUnload()']) assert.ok(app.includes(k), k);
 assert.match(app, /if\(newsDialog\(\)\)return;.{0,120}if\(supportDue\(\)\)supportDialog\(\);/, 'novidades antes; apoio só sem novidades');
 for (const l of ['pt-BR', 'en', 'es', 'fr', 'de']) {
  const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
  for (const k of ['supd.title', 'supd.text', 'supd.servers.t', 'supd.updates.d', 'supd.thanks.t', 'supd.done', 'supd.later', 'supd.thanksToast', 'stor.title', 'stor.hint', 'stor.button', 'stor.freed', 'stor.nothing']) assert.ok(d[k], l + ':' + k);
  assert.ok(d['stor.hint'].includes('{size}') && d['stor.freed'].includes('{size}'), l);
 }
 const main = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
 assert.match(main, /const imageCompress=/); assert.match(main, /loadURL\('about:blank'\)/);
});
