// RetroArch: descobre quais núcleos (cores) estão instalados e para quais plataformas cada um serve.
// Funciona com o RetroArch normal, o portátil e o da Steam (cores baixados como DLC na pasta cores).
//  - Pastas lidas do retroarch.cfg (libretro_directory e libretro_info_path; ":\" = pasta do RetroArch).
//  - Plataforma de cada núcleo pelo arquivo .info oficial (campo database, os mesmos nomes do libretro);
//    sem .info, pela lista de núcleos conhecidos.
// Tudo em cache curto: a página de jogos pergunta isso para cada jogo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {flatpakCoreDirectories} from './flatpak-emulators.mjs';
import {PLATFORMS} from './platforms.mjs';

// Núcleos preferidos de cada plataforma (os primeiros ganham quando há mais de um instalado).
export const CORE_FILES = {'Nintendo Entertainment System': ['mesen', 'nestopia', 'fceumm', 'quicknes'], 'Family Computer Disk System': ['mesen', 'nestopia', 'fceumm'], 'Super Nintendo Entertainment System': ['snes9x', 'bsnes', 'bsnes_hd_beta', 'mesen-s', 'snes9x2010', 'bsnes_mercury_balanced', 'bsnes2014_balanced'], 'Game Boy': ['gambatte', 'sameboy', 'mgba', 'gearboy', 'tgbdual'], 'Game Boy Color': ['gambatte', 'sameboy', 'mgba', 'gearboy', 'tgbdual'], 'Game Boy Advance': ['mgba', 'vbam', 'vba_next', 'gpsp', 'mednafen_gba'], 'Sega Mega Drive/Genesis': ['genesis_plus_gx', 'genesis_plus_gx_wide', 'picodrive', 'blastem'], 'Sega Master System': ['genesis_plus_gx', 'picodrive', 'smsplus', 'gearsystem'], 'Sega Master System/Mark III': ['genesis_plus_gx', 'picodrive', 'smsplus', 'gearsystem'], 'Sega Game Gear': ['genesis_plus_gx', 'gearsystem', 'picodrive'], 'SG-1000': ['genesis_plus_gx', 'gearsystem', 'bluemsx'], 'Sega CD': ['genesis_plus_gx', 'picodrive'], 'Sega 32X': ['picodrive'], 'Sega Saturn': ['mednafen_saturn', 'kronos', 'yabasanshiro', 'yabause'], 'Dreamcast': ['flycast'], 'Nintendo 64': ['mupen64plus_next', 'parallel_n64', 'mupen64plus_next_gles3'], 'Nintendo DS': ['melondsds', 'melonds', 'desmume', 'desmume2015'], 'Nintendo 3DS': ['citra', 'azahar'], 'Nintendo GameCube': ['dolphin'], 'Wii': ['dolphin'], 'Virtual Boy': ['mednafen_vb'], 'Pokémon mini': ['pokemini'], 'PlayStation': ['swanstation', 'pcsx_rearmed', 'mednafen_psx_hw', 'mednafen_psx'], 'PlayStation Portable': ['ppsspp'], 'PlayStation 2': ['pcsx2', 'lrps2'], 'TurboGrafx-16/PC Engine': ['mednafen_pce_fast', 'mednafen_pce', 'mednafen_supergrafx', 'geargrafx'], 'Turbografx-16/PC Engine CD': ['mednafen_pce_fast', 'mednafen_pce', 'geargrafx'], 'PC-FX': ['mednafen_pcfx'], 'Atari 2600': ['stella', 'stella2014', 'stella2023'], 'Atari 7800': ['prosystem'], 'Atari Lynx': ['handy', 'mednafen_lynx'], 'Atari Jaguar': ['virtualjaguar'], 'Neo Geo Pocket': ['mednafen_ngp', 'race'], 'Neo Geo Pocket Color': ['mednafen_ngp', 'race'], 'Neo Geo CD': ['neocd'], 'WonderSwan': ['mednafen_wswan'], 'WonderSwan Color': ['mednafen_wswan'], 'ColecoVision': ['gearcoleco', 'bluemsx'], 'Intellivision': ['freeintv'], 'MSX': ['bluemsx', 'fmsx'], '3DO Interactive Multiplayer': ['opera'], 'Arcade': ['fbneo', 'mame', 'mame2003_plus', 'mame2010', 'fbalpha2012'], 'DOS': ['dosbox_pure', 'dosbox_core']};

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

// retroarch.cfg / .info: linhas 'chave = "valor"'.
export function parseRetroArchCfg(text) {
 const out = {};
 for (const line of String(text || '').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) out[m[1]] = m[2];
 }
 return out;
}
const readCfg = file => { try { const st = fs.statSync(file); if (!st.isFile() || st.size > 2 * 1024 * 1024) return {}; return parseRetroArchCfg(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
// ":\cores" (Windows) ou ":/cores" = relativo à pasta do RetroArch; "default" = padrão.
function cfgDir(value, base) {
 const v = String(value || '').trim();
 if (!v || /^default$/i.test(v)) return '';
 if (/^:[\\/]/.test(v)) return path.join(base, v.slice(2));
 if (v.startsWith('~')) return path.join(process.env.USERPROFILE || process.env.HOME || '', v.slice(1));
 return path.isAbsolute(v) ? v : path.join(base, v);
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const BY_DB = new Map();
for (const p of PLATFORMS) if (p.libretro) BY_DB.set(norm(p.libretro), p.name);
// Plataformas de uma linha "database" do .info (ex.: "Sega - Mega Drive - Genesis|Sega - Game Gear").
export function platformsForDatabase(db) {
 const out = new Set();
 for (const part of String(db || '').split('|')) {
  const n = norm(part);
  if (!n) continue;
  if (BY_DB.has(n)) out.add(BY_DB.get(n));
  else if (/^(fbneo|fb alpha|mame|neo geo|cave|cps|naomi|atomiswave)\b/.test(n)) out.add('Arcade');
  else if (/\bdos\b/.test(n)) out.add('DOS');
 }
 return [...out];
}
const KNOWN = new Map();
for (const [platform, cores] of Object.entries(CORE_FILES)) for (const c of cores) { if (!KNOWN.has(c)) KNOWN.set(c, new Set()); KNOWN.get(c).add(platform); }

const cache = new Map();
// Núcleos instalados de um RetroArch: {coresDir, systemDir, cores:[{name,file,platforms,display}], byPlatform:Map}.
export function retroArchCores(exe, {env = process.env, ttl = 15000, home = env.HOME || env.USERPROFILE || os.homedir(), flatpakId = '', flatpakLocation = '', platform = process.platform} = {}) {
 if (!exe) return {cores: [], byPlatform: new Map(), dirs: []};
 const key = JSON.stringify([exe,home,env.XDG_CONFIG_HOME,flatpakId,flatpakLocation,platform]), hit = cache.get(key);
 if (hit && Date.now() - hit.checked < ttl) return hit.value;
 const base = path.dirname(exe);
 // Configuração: a da pasta do RetroArch (portátil e Steam); a do %APPDATA% só se não houver.
 const local = path.join(base, 'retroarch.cfg'), roaming = env.APPDATA ? path.join(env.APPDATA, 'RetroArch', 'retroarch.cfg') : '';
 const linux=platform==='linux'&&!/\.exe$/i.test(exe),flatpak=flatpakId==='org.libretro.RetroArch',xdg=env.XDG_CONFIG_HOME||path.join(home,'.config');
 const configFiles=flatpak?[path.join(home,'.var/app/org.libretro.RetroArch/config/retroarch/retroarch.cfg')]:[local,...(linux?[path.join(xdg,'retroarch/retroarch.cfg')]:[]),roaming];
 const cfgFile = configFiles.find(f=>f&&isFile(f))||'';
 const dirs = [...new Set([cfgDir(readCfg(cfgFile).libretro_directory, base), ...(flatpak?flatpakCoreDirectories({home,env,flatpakLocation}):[path.join(base,'cores'),...(linux?[path.join(xdg,'retroarch/cores'),path.join(env.XDG_DATA_HOME||path.join(home,'.local/share'),'libretro/cores'),'/usr/lib/libretro','/usr/lib/x86_64-linux-gnu/libretro','/usr/lib/aarch64-linux-gnu/libretro']:[])])].filter(d => d && isDir(d)))];
 const sig = [cfgFile, mtime(cfgFile), ...dirs.map(d => d + ':' + mtime(d))].join('|');
 if (hit && hit.sig === sig) { hit.checked = Date.now(); return hit.value; }
 const cfg = readCfg(cfgFile);
 const infoDirs = [...new Set([cfgDir(cfg.libretro_info_path, base), path.join(base, 'info'), ...(cfgFile?[path.join(path.dirname(cfgFile),'info')]:[]), ...(flatpak?[path.join(home,'.var/app/org.libretro.RetroArch/config/retroarch/info'),...(flatpakLocation?[path.join(flatpakLocation,'files/share/libretro/info')]:[])]:linux?['/usr/share/libretro/info']:[]), ...dirs].filter(d => d && isDir(d)))];
 const cores = [], seen = new Set();
 for (const dir of dirs) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch { continue; }
  for (const file of names) {
   const m = file.match(/^(.+)_libretro\.(dll|so|dylib)$/i);
   if (!m || linux&&m[2]!=='so' || seen.has(m[1].toLowerCase())) continue;
   seen.add(m[1].toLowerCase());
   const name = m[1].toLowerCase();
   let info = {};
   for (const d of infoDirs) { const f = path.join(d, m[1] + '_libretro.info'); if (isFile(f)) { info = readCfg(f); break; } }
   const fromInfo = platformsForDatabase(info.database);
   const platforms = [...new Set([...fromInfo, ...(KNOWN.get(name) || [])])];
   cores.push({name, file: path.join(dir, file), platforms, display: info.display_name || info.corename || m[1]});
  }
 }
 const byPlatform = new Map();
 for (const c of cores) for (const p of c.platforms) { if (!byPlatform.has(p)) byPlatform.set(p, []); byPlatform.get(p).push(c); }
 for (const [p, list] of byPlatform) {
  const order = CORE_FILES[p] || [];
  const rank = c => { const i = order.indexOf(c.name); return i < 0 ? 100 : i; };
  list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
 }
 const value = {cores, byPlatform, dirs, system: cfgDir(cfg.system_directory, base) || path.join(base, 'system')};
 cache.set(key, {checked: Date.now(), sig, value});
 return value;
}
// Melhor núcleo instalado para a plataforma do jogo ('' se nenhum).
export function retroArchCoreFor(platformName, exe, opts) {
 if (!platformName || !exe) return '';
 const list = retroArchCores(exe, opts).byPlatform.get(platformName) || [];
 return list[0]?.file || '';
}
export function retroArchPlatforms(exe, opts) { return [...retroArchCores(exe, opts).byPlatform.keys()]; }
export function clearRetroArchCache() { cache.clear(); }
