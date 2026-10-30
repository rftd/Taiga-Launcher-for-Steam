import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {portProfile} from '../lib/port-profiles.mjs';
import {parseTrophiesDat, parseTrophyTexts, portTrophyTexts, portUserDirs, parsePs3recompTrophies, parseDcpProgress, rtcToUnix, portProgressFiles, readProgressFile, portLogFiles, PortLogWatcher} from '../lib/port-trophies.mjs';
import {LaunchEngine, portCaptureFile} from '../lib/launch-engine.mjs';

const tmp = p => fs.mkdtempSync(path.join(os.tmpdir(), p));
const put = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data); return file; };

test('SpartanPort novo: trophies.dat (bits) e trophy_texts.txt', () => {
 const b = Buffer.alloc(16); b.writeUInt32LE((1 << 0) | (1 << 5), 0); b.writeUInt32LE(1 << 2, 4);
 assert.deepEqual(parseTrophiesDat(b), [0, 5, 34]);
 const t = parseTrophyTexts('@title=Troféus\n0=Platina | Ganhe todos\n7=Fúria\n');
 assert.equal(t.get(0).title, 'Platina'); assert.equal(t.get(0).description, 'Ganhe todos'); assert.equal(t.get(7).description, ''); assert.equal(t.size, 2);
 const d = tmp('sp-');
 const exe = put(path.join(d, 'bin', 'spartanport.exe'), 'x');
 put(path.join(d, 'settings.json'), JSON.stringify({user_dir: 'saves'}));
 put(path.join(d, 'saves', 'trophy_texts.txt'), '1=Primeiro | Desc\n');
 assert.ok(portUserDirs(exe).includes(path.join(d, 'saves')), 'user_dir relativo vale a partir da pasta do settings.json (pacote com bin/)');
 assert.equal(portTrophyTexts(exe).get(1).title, 'Primeiro');
 assert.equal(portProfile({path: exe})?.id, 'spartanport');
});

test('ps3recomp: gamedata/trophies/<NPWR>.json com CellRtcTick e segundos antigos', () => {
 const unix = 1761400000, tick = (unix + 62135596800) * 1e6;
 assert.equal(rtcToUnix(tick), unix); assert.equal(rtcToUnix(unix), unix); assert.equal(rtcToUnix(0), 0);
 assert.deepEqual(parsePs3recompTrophies(`{"trophies":[{"id":3,"timestamp":${tick}},{"id":9,"timestamp":${unix}}]}`), [{id: 3, at: unix}, {id: 9, at: unix}]);
 assert.deepEqual(parsePs3recompTrophies('{"trophies":['), []);
 const d = tmp('ps3r-');
 const exe = put(path.join(d, 'yakuza', 'build_release', 'yakuza_recomp.exe'), 'x');
 put(path.join(d, 'gamedata', 'trophies', 'NPWR01234_00.json'), `{"trophies":[{"id":1,"timestamp":${tick}}]}`);
 const files = portProgressFiles(exe);
 assert.equal(files.length, 1); assert.equal(files[0].kind, 'ps3recomp');
 assert.deepEqual(readProgressFile(files[0].file).map(t => t.id), [1]);
 assert.equal(portProfile({path: exe})?.id, 'yakuza-dead-souls');
 assert.equal(portProfile({path: put(path.join(d, 'des', 'des_boot.exe'), 'x')})?.id, 'demons-souls-recomp');
});

test("Dragon's Crown Pro: user/trophy/<NPWR>/progress_user0.txt", () => {
 assert.deepEqual(parseDcpProgress('DCP-TROPHIES 1\nnpcommid NPWR12345_00\nunlocked 4 1761400000\nunlocked 10 1761400500\n'), [{id: 4, at: 1761400000}, {id: 10, at: 1761400500}]);
 assert.deepEqual(parseDcpProgress('outra coisa\nunlocked 4 1\n'), []);
 const d = tmp('dcp-');
 const exe = put(path.join(d, 'dragons_crown_pro.exe'), 'x');
 put(path.join(d, 'user', 'trophy', 'NPWR12345_00', 'progress_user0.txt'), 'DCP-TROPHIES 1\nnpcommid NPWR12345_00\nunlocked 2 1761400000\n');
 const files = portProgressFiles(exe);
 assert.equal(files[0].kind, 'dcp');
 assert.deepEqual(readProgressFile(files[0].file), [{id: 2, at: 1761400000}]);
 assert.ok(portLogFiles(exe).includes(files[0].file));
});

test('Logs: out/logs e data/logs (só os run-*.log mais novos) e saída capturada', () => {
 const d = tmp('logs-');
 const exe = put(path.join(d, 'tlg-play.exe'), 'x');
 for (let i = 0; i < 6; i++) { const f = put(path.join(d, 'out', 'logs', `run-${i}.log`), 'x'); const t = new Date(Date.now() - (10 - i) * 60000); fs.utimesSync(f, t, t); }
 put(path.join(d, 'out', 'last_run.log'), 'x');
 put(path.join(d, 'data', 'logs', 'run-a.log'), 'x');
 const files = portLogFiles(exe, {extra: [path.join(d, 'cap.log')]});
 assert.equal(files[0], path.join(d, 'cap.log'));
 assert.ok(files.includes(path.join(d, 'out', 'last_run.log')));
 assert.ok(files.includes(path.join(d, 'out', 'logs', 'run-5.log')));
 assert.ok(!files.includes(path.join(d, 'out', 'logs', 'run-0.log')), 'run-*.log antigos ficam de fora');
 assert.equal(files.filter(f => /run-/.test(f)).length, 3);
});

test('Observador: troféus novos nos arquivos de progresso, sem repetir e ignorando JSON pela metade', () => {
 const d = tmp('watch-');
 const file = put(path.join(d, 'gamedata', 'trophies', 'NPWR00881.json'), '{"trophies":[{"id":1,"timestamp":0}]}');
 const got = [];
 const w = new PortLogWatcher({games: () => [{game: {id: 'g'}, file}], onUnlock: (g, id, o) => got.push([id, o.live])});
 w.tick();
 assert.deepEqual(got, [[1, false]], 'primeira leitura: entra no progresso sem aviso');
 fs.writeFileSync(file, '{"trophies":[{"id":1'); const t1 = new Date(Date.now() + 2000); fs.utimesSync(file, t1, t1); w.tick();
 assert.equal(got.length, 1);
 fs.writeFileSync(file, '{"trophies":[{"id":1,"timestamp":0},{"id":4,"timestamp":0}]}'); const t2 = new Date(Date.now() + 4000); fs.utimesSync(file, t2, t2); w.tick();
 assert.deepEqual(got, [[1, false], [4, true]]);
});

test('Abrir um port com troféus: a saída do jogo vai para port-logs/<uuid>.log', async () => {
 const d = tmp('cap-'), data = path.join(d, 'data'); fs.mkdirSync(data);
 const exe = put(path.join(d, 'bb', 'probe.exe'), 'x'); put(path.join(d, 'bb', 'bbport.ini'), '');
 let opts = null;
 const spawnProcess = (file, args, o) => { opts = o; const c = new EventEmitter(); c.pid = 99999; setImmediate(() => { c.emit('spawn'); setTimeout(() => c.emit('exit', 0), 5); }); return c; };
 const engine = new LaunchEngine({dir: data, snapshot: async () => [], spawnProcess, interval: 10, grace: 10});
 const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e';
 await engine.run({uuid, id: 'g', title: 'Bloodborne', path: exe, profile: 'pc'}, {account: 'a'}, {command: {exe, args: ''}});
 assert.ok(Array.isArray(opts.stdio), 'stdout redirecionado');
 assert.ok(fs.existsSync(portCaptureFile(data, uuid)));
 const other = put(path.join(d, 'x', 'jogo.exe'), 'x');
 await engine.run({uuid: '1f8fad5b-d9cb-469f-a165-70867728950e', id: 'h', title: 'Outro', path: other, profile: 'pc'}, {account: 'a'}, {command: {exe: other, args: ''}});
 assert.equal(opts.stdio, 'ignore', 'jogos comuns continuam sem captura');
});
