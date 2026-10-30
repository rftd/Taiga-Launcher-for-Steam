import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

test('Primeiro uso novo: emuladores antes, tela do que falta, contas, lojas e coleções; ajuda e novidades nos 5 idiomas', () => {
 const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
 assert.match(app, /api\('emulators-discover',\{\}\);\}catch\{\}UI\.ob\.step='games'/, 'emuladores procurados antes da etapa de jogos');
 for (const k of ["st==='found'", "st==='accounts'", "data-act=\"ob3-ra\"", "ob3.needEmu", "check('emuCollection'", 'function helpView', 'function newsDialog', "const NEWS={'"+JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version.split('.').slice(0,2).join('.'), 'function newsKey']) assert.ok(app.includes(k), k);
 const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
 assert.match(server, /autoCollection:false/, 'coleção "Taiga Launcher" não é criada sozinha');
 assert.match(server, /route==='\/api\/setup-summary'/);
 for (const l of ['pt-BR', 'en', 'es', 'fr', 'de']) {
  const d = JSON.parse(fs.readFileSync(new URL('../locales/' + l + '.json', import.meta.url), 'utf8'));
  for (const k of ['ob3.ready', 'ob3.raText', 'ob3.accSafe', 'ob3.storesTitle', 'ob3.optEmus', 'help.q.port', 'help.a.port', 'news.title', 'news.next', 'news2.epic.t', 'news2.comments.d', 'news2.page.d', 'news2.fixes.t', 'ach.why.login']) assert.ok(d[k], l + ':' + k);
 }
});

test('Tela de conquistas sem nenhuma conquista explica o motivo', () => {
 const src = fs.readFileSync(new URL('../web/achievement-view.cjs', import.meta.url), 'utf8');
 assert.match(src, /ach\.why\.'\+why/);
 assert.doesNotThrow(() => require('../web/achievement-view.cjs'));
});
