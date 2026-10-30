// "Enviar para outro PC": gera um .zip com o programa inteiro (pronto para extrair e abrir), já com as chaves de API
// deste PC em resources/app/chaves.json. Os dados do usuário (jogos, contas, logins) ficam de fora: estão em
// %LOCALAPPDATA%\TaigaSteamPSP, não na pasta do programa.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {promisify} from 'node:util';

const deflate = promisify(zlib.deflateRaw);
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0; let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const dosTime = d => { const t = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2), day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); return {t, day}; };

// Escreve um .zip (deflate, nomes UTF-8). entries: [{name, file}|{name, data}]
export async function writeZip(out, entries, {onProgress = () => {}} = {}) {
 fs.mkdirSync(path.dirname(out), {recursive: true});
 const tmp = out + '.part', fd = fs.openSync(tmp, 'w'), central = [];
 let offset = 0, done = 0;
 const write = b => { fs.writeSync(fd, b); offset += b.length; };
 try {
  for (const e of entries) {
   const data = e.data ? Buffer.from(e.data) : fs.readFileSync(e.file);
   const stat = e.file ? fs.statSync(e.file) : null, {t, day} = dosTime(stat?.mtime || new Date());
   let body = await deflate(data, {level: 6}), method = 8;
   if (body.length >= data.length) { body = data; method = 0; }
   if (offset > 0xFFFFFFF0 || data.length > 0xFFFFFFF0) throw Error('Pacote grande demais para .zip.');
   const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8'), crc = crc32(data), local = Buffer.alloc(30);
   local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8); local.writeUInt16LE(t, 10); local.writeUInt16LE(day, 12);
   local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
   const at = offset; write(local); write(name); write(body);
   const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(method, 10); c.writeUInt16LE(t, 12); c.writeUInt16LE(day, 14);
   c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(at, 42);
   central.push(Buffer.concat([c, name]));
   onProgress(++done, entries.length);
  }
  const start = offset; for (const c of central) write(c);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length, 8); end.writeUInt16LE(central.length, 10); end.writeUInt32LE(offset - start, 12); end.writeUInt32LE(start, 16); write(end);
 } finally { fs.closeSync(fd); }
 fs.renameSync(tmp, out);
 return {file: out, entries: entries.length, bytes: offset};
}

// Arquivos da instalação que vão no pacote. Fica de fora o que é só de desenvolvimento ou pessoal.
const SKIP = [/^\.git(\/|$)/, /^docs\//, /^dist\//, /^node_modules\//, /^\.gitignore$/, /^third_party\//, /^tools\//, /^resources\/app\/tests\//, /^resources\/app\/tools\//, /^resources\/app\/chaves\.json$/, /^resources\/app\/REVISAO-[\d.]+\.md$/, /^resources\/app\/LEIA-ME[^/]*$/i, /(^|\/)README[^/]*$/i, /^MANUAL\.md$/i, /^resources\/app\/Iniciar\.bat$/i, /(^|\/)\.(github|vscode|idea)(\/|$)/i, /\.part$/, /(^|\/)Thumbs\.db$/i, /(^|\/)desktop\.ini$/i,
 // Compiladores de shader do WebGPU (o programa não usa WebGPU): 27 MB a menos no pacote.
 /^dxcompiler\.dll$/i, /^dxil\.dll$/i];
export function packageFiles(installDir) {
 const out = [];
 const walk = (dir, rel) => {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
   const r = rel ? rel + '/' + e.name : e.name;
   if (SKIP.some(re => re.test(r + (e.isDirectory() ? '/' : '')))) continue;
   if (e.isDirectory()) walk(path.join(dir, e.name), r); else if (e.isFile()) out.push({rel: r, file: path.join(dir, e.name)});
  }
 };
 walk(installDir, '');
 return out;
}

export async function buildPortablePackage({installDir, out, keys = {}, version = '', exeName = 'Taiga Launcher.exe', onProgress} = {}) {
 if (!installDir || !fs.existsSync(path.join(installDir, 'resources', 'app', 'server.mjs'))) throw Error('Pasta do programa não encontrada. Gere o pacote pelo Taiga Launcher instalado.');
 const root = 'Taiga Launcher/';
 const entries = packageFiles(installDir).map(f => ({name: root + ([exeName.toLowerCase(), 'taigapsp.exe'].includes(f.rel.toLowerCase()) ? 'Taiga Launcher.exe' : f.rel), file: f.file}));
 const filled = Object.fromEntries(Object.entries({sgdbKey: keys.sgdbKey, igdbId: keys.igdbId, igdbSecret: keys.igdbSecret}).filter(([, v]) => v));
 if (Object.keys(filled).length) entries.push({name: root + 'resources/app/chaves.json', data: JSON.stringify(filled, null, 2) + '\n'});
 const r = await writeZip(out, entries, {onProgress});
 return {...r, keys: Object.keys(filled)};
}
