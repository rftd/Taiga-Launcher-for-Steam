// Troféus locais de emuladores PlayStation além do RPCS3:
// - Vita3K (PS Vita): ux0/user/<id>/trophy/conf/<NPWR>/TROPCONF.SFM + data/<NPWR>/TROPUSR.DAT
// - shadPS4 (PS4): user/trophy/<NPWR>/Xml/TROP*.XML + user/home/<id>/trophy/<NPWR>.xml
// Os arquivos são somente lidos. Nada é desbloqueado ou alterado.
import fs from 'node:fs';
import path from 'node:path';
import {digest} from './files.mjs';
import {parseTrophyXML} from './rpcs3-achievements.mjs';

const present = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const dir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const read = (f, max = 8 * 1024 * 1024) => { if (fs.statSync(f).size > max) throw Error('Arquivo de troféus muito grande.'); return fs.readFileSync(f); };
const list = d => { try { return fs.readdirSync(d); } catch { return []; } };
// Ticks RTC (microssegundos desde 0001-01-01) ou segundos Unix -> segundos Unix.
export function trophyTime(value) {
 const n = Number(value);
 if (!Number.isFinite(n) || n <= 0) return null;
 if (n > 1e15) return Math.round(n / 1e6 - 62135596800);
 if (n > 1e11) return Math.round(n / 1000);
 return n;
}
function icon(dataDir, file) {
 if (!present(file)) return '';
 const bytes = read(file, 4 * 1024 * 1024);
 if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '';
 const name = digest(bytes) + '.png', dest = path.join(dataDir, 'art', name);
 fs.mkdirSync(path.dirname(dest), {recursive: true});
 if (!present(dest)) fs.writeFileSync(dest, bytes);
 return '/art/' + name;
}
// Arquivo de idioma preferido: Vita/PS3 usam TROP_XX.SFM; PS4 usa TROP_XX.XML.
const VITA_LANG = {'pt-BR': 17, en: 1, es: 3, fr: 2, de: 4};
function localizedDefinitions(folder, language, ext) {
 const index = VITA_LANG[language] ?? 1;
 for (const name of [`TROP_${String(index).padStart(2, '0')}.${ext}`, `TROP.${ext}`, `TROPCONF.${ext}`]) {
  const file = path.join(folder, name);
  if (!present(file)) continue;
  try { const def = parseTrophyXML(read(file)); if (def.achievements.some(a => a.title)) return {def, language: name.startsWith('TROP_') && index !== 1 ? language : 'en'}; } catch {}
 }
 return null;
}
// --- Vita3K ---
export function parseVita3KProgress(bytes) {
 if (bytes.length < 4 + 16 + 16 + 12 || bytes.readUInt32LE(0) !== 0x12d5819a) throw Error('TROPUSR.DAT do Vita3K inválido.');
 const unlocked = new Set(), times = new Map();
 for (let id = 0; id < 128; id++) if (bytes.readUInt32LE(4 + (id >> 5) * 4) & (1 << (id & 31))) unlocked.add(id);
 const tsBase = 4 + 16 + 16 + 12 + 16 * 4;
 for (const id of unlocked) if (tsBase + id * 8 + 8 <= bytes.length) times.set(id, Number(bytes.readBigUInt64LE(tsBase + id * 8)));
 return {unlocked, times};
}
export function vita3kRoots(config = {}, env = process.env) {
 const roots = [], add = p => { if (p) roots.push(p); };
 add(config.vita3kRoot);
 const exe = config.launchers?.vita3k?.exe;
 if (exe) {
  add(path.dirname(exe));
  for (const cfg of [path.join(path.dirname(exe), 'config.yml')]) if (present(cfg)) { const m = fs.readFileSync(cfg, 'utf8').match(/^pref-path:\s*['"]?([^'"\r\n]+)/m); if (m) add(m[1].trim()); }
 }
 const appdata = env.APPDATA;
 if (appdata) { add(path.join(appdata, 'Vita3K', 'Vita3K')); const cfg = path.join(appdata, 'Vita3K', 'Vita3K', 'config.yml'); if (present(cfg)) { const m = fs.readFileSync(cfg, 'utf8').match(/^pref-path:\s*['"]?([^'"\r\n]+)/m); if (m) add(m[1].trim()); } }
 return [...new Set(roots.map(r => path.resolve(r)))];
}
// Conjunto de troféus do jogo instalado: sce_sys/trophy/<NPWR>/TROPHY.TRP.
function vitaSetsForGame(game) {
 const base = game.gameRoot || (game.path ? path.dirname(game.path) : '');
 return list(path.join(base, 'sce_sys', 'trophy')).filter(n => /^NPWR\d{5}_\d{2}$/i.test(n));
}
export function readVita3K(game, config, dataDir) {
 const language = config.language || 'pt-BR', opts = game.achievementSettings || {};
 const wanted = opts.trophySet ? [opts.trophySet] : vitaSetsForGame(game);
 const candidates = [];
 for (const root of vita3kRoots(config)) for (const user of list(path.join(root, 'ux0', 'user'))) {
  const conf = path.join(root, 'ux0', 'user', user, 'trophy', 'conf');
  for (const set of list(conf)) if (!wanted.length || wanted.includes(set)) candidates.push({set, folder: path.join(conf, set), progress: path.join(root, 'ux0', 'user', user, 'trophy', 'data', set, 'TROPUSR.DAT')});
 }
 if (!wanted.length || !candidates.length) return {status: 'unmapped', provider: 'vita3k', source: 'Vita3K', achievements: [], total: 0, unlocked: 0, candidates: candidates.map(c => ({id: c.set, name: c.set}))};
 const chosen = candidates.sort((a, b) => (present(b.progress) ? 1 : 0) - (present(a.progress) ? 1 : 0))[0];
 const defs = localizedDefinitions(chosen.folder, language, 'SFM');
 if (!defs) return {status: 'unmapped', provider: 'vita3k', source: 'Vita3K', achievements: [], total: 0, unlocked: 0};
 let progress = {unlocked: new Set(), times: new Map()}, known = false;
 if (present(chosen.progress)) try { progress = parseVita3KProgress(read(chosen.progress)); known = true; } catch {}
 const achievements = defs.def.achievements.map(a => { const id = Number(a.id); return {...a, unlocked: progress.unlocked.has(id), date: progress.unlocked.has(id) ? trophyTime(progress.times.get(id)) : null, icon: icon(dataDir, path.join(chosen.folder, 'TROP' + String(id).padStart(3, '0') + '.PNG'))}; });
 return {status: 'ok', provider: 'vita3k', source: 'Vita3K', sourceLanguage: defs.language, progressKnown: known, achievements, total: achievements.length, unlocked: achievements.filter(a => a.unlocked).length, trophySet: chosen.set};
}
// --- shadPS4 ---
export function shadps4Roots(config = {}, env = process.env) {
 const roots = [], add = p => { if (p) roots.push(p); };
 add(config.shadps4Root);
 const exe = config.launchers?.shadps4?.exe;
 if (exe) add(path.join(path.dirname(exe), 'user'));
 if (env.APPDATA) add(path.join(env.APPDATA, 'shadPS4'));
 return [...new Set(roots.map(r => path.resolve(r)))].filter(dir);
}
// npbind.dat do jogo contém o identificador NPWR do conjunto de troféus.
function ps4SetsForGame(game) {
 const base = game.gameRoot || (game.path ? path.dirname(game.path) : '');
 const out = new Set();
 for (const file of [path.join(base, 'sce_sys', 'npbind.dat'), path.join(base, 'sce_sys', 'trophy2', 'npbind.dat')]) if (present(file)) for (const m of read(file, 1024 * 1024).toString('latin1').matchAll(/NPWR\d{5}_\d{2}/g)) out.add(m[0]);
 return [...out];
}
export function parsePS4Unlocks(xml) {
 const out = new Map();
 for (const m of String(xml).matchAll(/<trophy\b([^>]*)>/gi)) {
  const attrs = Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(a => [a[1], a[2]]));
  if (/^\d+$/.test(attrs.id || '') && attrs.unlockstate === 'true') out.set(Number(attrs.id), trophyTime(attrs.timestamp));
 }
 return out;
}
export function readShadPS4(game, config, dataDir) {
 const language = config.language || 'pt-BR', opts = game.achievementSettings || {}, PS4_LANG = {'pt-BR': 17, en: 1, es: 3, fr: 2, de: 4};
 const wanted = opts.trophySet ? [opts.trophySet] : ps4SetsForGame(game);
 for (const root of shadps4Roots(config)) {
  // Versões novas do shadPS4 guardam os troféus por jogo: user/game_data/<CUSA...>/TrophyFiles/trophy00/Xml.
  const tid = String(game.discId || game.serial || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/[A-Z]{4}\d{5}/)?.[0] || String(game.path || '').toUpperCase().match(/\b(CUSA|PPSA)\d{5}\b/)?.[0] || '';
  const spots = wanted.map(set => ({set, folder: path.join(root, 'trophy', set, 'Xml'), icons: path.join(root, 'trophy', set, 'Icons')}));
  if (tid) for (const base of [path.join(root, 'game_data', tid, 'TrophyFiles'), path.join(root, 'user', 'game_data', tid, 'TrophyFiles')]) for (const t of list(base)) { const name = t.name || t; spots.push({set: wanted[0] || tid, folder: path.join(base, name, 'Xml'), icons: path.join(base, name, 'Icons')}); }
  for (const {set, folder, icons: iconsDir} of spots) {
   if (!dir(folder)) continue;
   let def = null, sourceLanguage = 'en';
   for (const name of [`TROP_${String(PS4_LANG[language] ?? 1).padStart(2, '0')}.XML`, 'TROP.XML']) { const f = path.join(folder, name); if (present(f)) try { def = parseTrophyXML(read(f)); if (name.startsWith('TROP_') && language !== 'en') sourceLanguage = language; break; } catch {} }
   if (!def) continue;
   // Progresso por usuário (versões novas) ou no próprio XML (versões antigas).
   const master = path.join(folder, 'TROP.XML');
   let unlocks = present(master) ? parsePS4Unlocks(read(master).toString('utf8')) : new Map(), known = unlocks.size > 0;
   for (const user of list(path.join(root, 'home'))) { const f = path.join(root, 'home', user, 'trophy', set + '.xml'); if (present(f)) { unlocks = parsePS4Unlocks(read(f).toString('utf8')); known = true; break; } }
   const icons = iconsDir;
   const achievements = def.achievements.map(a => { const id = Number(a.id); return {...a, unlocked: unlocks.has(id), date: unlocks.get(id) || null, icon: icon(dataDir, path.join(icons, 'TROP' + String(id).padStart(3, '0') + '.PNG'))}; });
   return {status: 'ok', provider: 'shadps4', source: 'shadPS4', sourceLanguage, progressKnown: known, achievements, total: achievements.length, unlocked: achievements.filter(a => a.unlocked).length, trophySet: set};
  }
 }
 return {status: 'unmapped', provider: 'shadps4', source: 'shadPS4', achievements: [], total: 0, unlocked: 0, candidates: wanted.map(id => ({id, name: id}))};
}
