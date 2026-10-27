import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
const LANGS = ['pt-BR', 'en', 'es', 'fr', 'de'];

function makeLnk(target) {
  const header = Buffer.alloc(0x4C); header.writeUInt32LE(0x4C, 0); header.writeUInt32LE(0x02, 0x14);
  const base = Buffer.from(target + '\0', 'latin1'), suffix = Buffer.from('\0', 'latin1');
  const info = Buffer.alloc(0x1C); const size = 0x1C + base.length + suffix.length;
  info.writeUInt32LE(size, 0); info.writeUInt32LE(0x1C, 4); info.writeUInt32LE(1, 8); info.writeUInt32LE(0, 12);
  info.writeUInt32LE(0x1C, 16); info.writeUInt32LE(0, 20); info.writeUInt32LE(0x1C + base.length, 24);
  return Buffer.concat([header, info, base, suffix]);
}

test('1.8.0: .lnk shortcuts resolve to the emulator program', async () => {
  const {lnkTarget} = await import('../lib/lnk.mjs');
  assert.equal(lnkTarget(makeLnk('C:\\Emus\\PCSX2\\pcsx2-qt.exe')), 'C:\\Emus\\PCSX2\\pcsx2-qt.exe');
  assert.equal(lnkTarget(Buffer.from('not a link')), '');
});

test('1.8.0: Emulators tab, add by folder or shortcut, list games and folders', async () => {
  const {createApp} = await import('../server.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emu-')), data = path.join(dir, 'data'); fs.mkdirSync(data);
  const pcsx2 = path.join(dir, 'Emus', 'PCSX2'); fs.mkdirSync(path.join(pcsx2, 'bios'), {recursive: true}); fs.writeFileSync(path.join(pcsx2, process.platform==='win32'?'pcsx2-qt.exe':'pcsx2-qt'), 'MZ');
  const ppsspp = path.join(dir, 'Emus', 'PPSSPP'); fs.mkdirSync(ppsspp, {recursive: true}); fs.writeFileSync(path.join(ppsspp, process.platform==='win32'?'PPSSPPWindows64.exe':'PPSSPPSDL'), 'MZ');
  fs.writeFileSync(path.join(dir, 'PPSSPP.lnk'), makeLnk(path.join(ppsspp, process.platform==='win32'?'PPSSPPWindows64.exe':'PPSSPPSDL')));
  const empty = path.join(dir, 'Nada'); fs.mkdirSync(empty); fs.writeFileSync(path.join(empty, 'notepad.exe'), 'MZ');
  const port = 48000 + Math.floor(Math.random() * 900);
  const a = createApp({dataDir: data, port}); await new Promise(r => a.server.listen(port, '127.0.0.1', r));
  const token = JSON.parse(fs.readFileSync(path.join(data, 'config.json'))).adminToken;
  const api = async (r, b) => { const res = await fetch(`http://127.0.0.1:${port}/api/${r}`, {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(b || {})}); return {status: res.status, body: await res.json()}; };
  try {
    const byFolder = await api('emulator-add', {path: pcsx2});
    assert.equal(byFolder.body.profile, 'ps2', JSON.stringify(byFolder.body));
    assert.ok(Array.isArray(byFolder.body.folders));
    const byLink = await api('emulator-add', {path: path.join(dir, 'PPSSPP.lnk')});
    assert.equal(byLink.body.profile, 'psp', JSON.stringify(byLink.body));
    const bad = await api('emulator-add', {path: empty});
    assert.ok(bad.body.error);
    const list = await api('emulators', {});
    const names = list.body.items.map(e => e.profile).sort();
    assert.deepEqual(names, ['ps2', 'psp']);
    for (const e of list.body.items) { assert.equal(typeof e.games, 'number'); assert.ok(Array.isArray(e.folders)); assert.equal(e.found, true); }
  } finally { a.server.close(); }
});

test('1.8.0: covers, Steam, libretro, then Wikipedia (portrait only), retried in the background', () => {
  const prov = fs.readFileSync(new URL('../lib/providers.mjs', import.meta.url), 'utf8'), server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const fc = prov.slice(prov.indexOf('async findCover(game)'), prov.indexOf('// Artes sem chave para o que faltou'));
  assert.ok(fc.indexOf('steamArtwork') < fc.indexOf('libretroArt') && fc.indexOf('libretroArt') < fc.indexOf('wikipedia.org'));
  assert.match(fc, /img\.height>img\.width\*1\.15/);
  assert.match(prov, /if\(!game\.art\?\.cover\)await this\.findCover\(game\);/);
  assert.match(server, /coverCheckedAt/);
  assert.match(app, /class="art-gen"/);
  assert.match(app, /data-act="edit" data-id="\$\{g\.id\}">\$\{I\.pen\}\$\{T\('card\.pickCover'\)\}/);
});

test('1.8.0: collection, light issue dot, 2-line titles, sort, recently played, drag and drop', () => {
  assert.match(app, /function cardIssue\(g\)/);
  assert.match(app, /class="cv-issue" title=/);
  assert.match(css, /\.shell \.card-t\{-webkit-line-clamp:2/);
  assert.match(app, /data-act="sort-menu"/);
  for (const k of ['recent', 'name', 'platform', 'played']) assert.ok(app.includes(`'${k}'`));
  assert.match(app, /T\('lib\.played'\)/);
  assert.match(app, /document\.addEventListener\('drop'/);
  assert.match(app, /taigaDesktop/);
  const preload = fs.readFileSync(new URL('../desktop/preload.cjs', import.meta.url), 'utf8'), main = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  assert.match(preload, /webUtils\.getPathForFile/);
  assert.match(main, /preload:path\.join\(__dirname,'preload\.cjs'\)/);
  assert.match(main, /extensions:\['exe','lnk'\]/);
});

test('1.8.0: Accounts as cards with official logos; toggles not all white; texts in 5 languages', async () => {
  const {BRAND_DIRECT} = await import('../lib/brand-icons.mjs');
  assert.match(BRAND_DIRECT.epic[0], /Epic_Games_logo/);
  assert.match(BRAND_DIRECT.ra[0], /static\.retroachievements\.org\/assets\/images\/favicon\.webp/);
  assert.match(app, /function accountCard\(kind\)/);
  assert.match(css, /\.sw input:checked \+ span::after\{background:var\(--bg\)/);
  assert.match(app, /function emulatorsView\(\)/);
  assert.match(app, /it\('emulators'/);
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['card.pickCover', 'card.needAccount', 'sort.label', 'sort.played', 'lib.played', 'drop.hint', 'drop.none', 'emu.lead', 'emu.scan', 'emu.viewGames', 'emu.addFolder', 'emu.tip', 'emu.open', 'acc.auto', 'acc.waiting']) assert.ok(d[k], `${l}:${k}`);
  }
});

test('1.8.1: first-run tour, accounts intro, new Add games dialog, emulator-only search', () => {
  const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const ob = app.slice(app.indexOf('function renderOnboarding(){'), app.indexOf('async function pickSetting('));
  for (const step of ["st==='steam'", "st==='games'", "st==='found'", 'ILL.emus']) assert.ok(ob.includes(step), step);
  assert.match(app, /function renderLanguagePicker\(\)\{const cur=state\.settings\?\.language,languages=\[\.\.\.\(globalThis\.TaigaLocales\?\.languages\|\|\[\]\)\][^;]*;\$\('#app'\)\.innerHTML=obShell\(ILL\.globe/);
  assert.match(app, /case 'ob2-auto':case 'ob2-retry':task\(async\(\)=>\{if\(UI\.discoverPromise\)await UI\.discoverPromise\.catch\(\(\)=>\{\}\);const res=await importGames\('discover',null,\{background:true,stores:false,quiet:true,sweep:'home'\}\)/);
  assert.match(app, /if\(UI\.view==='accounts'&&!introSeen\('accounts'\)\)accountsIntro\(\)/);
  assert.match(app, /class="sheet add3s"/);
  assert.match(app, /case 'emu-scan':\{const profile=t\.dataset\.profile;bgSearch\(\{stores:false,profile\}\)/);
  assert.match(server, /if\(body\.profile&&REGISTRY_PROFILES\[body\.profile\]\)/);
  assert.ok(!app.includes('acc-games-n'), 'no game count on account cards');
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['ob2.title', 'ob2.gamesTitle', 'ob2.gamesLead', 'ob2.autoNote', 'ob2.found', 'ob2.emusTitle', 'accIntro.title', 'accIntro.text', 'add.dropTip', 'emu.addFile', 'emu.scanHint']) assert.ok(d[k], `${l}:${k}`);
  }
});

test('1.8.3: account picker collapsed, in-app Steam picker, quick search covers user folders, lighter identify dialog', () => {
  const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(app, /UI\.ob\.allAcc\?accounts:accounts\.filter\(a=>a\.id===chosen\)/);
  assert.match(app, /function steamPickDialog\(onboard\)/);
  assert.match(app, /class="ob2-path"/);
  assert.match(server, /body\.sweep==='home'\?\{drives:\[\]\}/);
  assert.match(app, /sweep:'home'/);
  assert.match(app, /<details class="id-more"/);
  assert.ok(!app.includes('emu-tip'));
  const sb = app.slice(app.indexOf('<nav class="sb-nav">'));
  assert.ok(sb.indexOf("it('accounts'") < sb.indexOf("it('emulators'"));
});

test('1.8.4: PC games step, Steam question before identifying a PC game, "Select the game" title, language screen stays until setup', () => {
  assert.match(app, /else if\(st==='pc'\)/);
  assert.match(app, /const dots=\['steam','games','pc','emus'\]/);
  assert.ok(!app.includes("T('ob2.step2')"));
  assert.match(app, /function steamAsk\(g\)/);
  assert.match(app, /renderSteamStrip\(g\)/);
  assert.match(app, /api\('steam-link',\{id:gg\.id,appId:q\.steamPick\.appId\}\)/);
  assert.match(app, /T\('id\.selectTitle'\)/);
  assert.match(app, /await reload\(\);if\(!ready\(\)\)\{await api\('detect',\{\}\);await reload\(\);UI\.languagePicker=false;/);
});
