import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectGame} from '../lib/games.mjs';
import {xboxPackageItems} from '../lib/stores.mjs';

test('exe protegido do Xbox (EPERM ao abrir) entra como jogo de PC sem ler o arquivo', () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xbox-')), content = path.join(dir, 'Balatro', 'Content'); fs.mkdirSync(content, {recursive: true});
 const exe = path.join(content, 'love.exe'); fs.writeFileSync(exe, Buffer.alloc(4096, 1));
 const open = fs.openSync, read = fs.readFileSync, real = fs.realpathSync;
 const deny = f => { if (String(f).toLowerCase() === exe.toLowerCase()) { const e = Error('EPERM: operation not permitted, open'); e.code = 'EPERM'; throw e; } };
 fs.openSync = (f, ...a) => { deny(f); return open(f, ...a); };
 fs.readFileSync = (f, ...a) => { deny(f); return read(f, ...a); };
 fs.realpathSync = (f, ...a) => { deny(f); return real(f, ...a); };
 try { const g = inspectGame(exe); assert.equal(g.title, 'Balatro'); assert.equal(g.profile, 'pc'); assert.equal(g.bytes, 4096); }
 finally { fs.openSync = open; fs.readFileSync = read; fs.realpathSync = real; fs.rmSync(dir, {recursive: true, force: true}); }
});

test('pacotes do Windows viram jogos do Xbox abertos pelo AppsFolder', () => {
 const [g] = xboxPackageItems([{name: 'PlayStack.Balatro', pfn: 'PlayStack.Balatro_abc123', loc: 'C:\\XboxGames\\Balatro\\Content', id: 'Game', exe: 'love.exe', title: 'ms-resource:Title'}]);
 assert.equal(g.title, 'Balatro'); assert.equal(g.store, 'xbox');
 assert.equal(g.url, 'shell:AppsFolder\\PlayStack.Balatro_abc123!Game');
});
