// Mais lojas e jogos instalados no Windows (somente leitura dos registros locais).
//  - Xbox / PC Game Pass: pastas XboxGames (arquivo .GamingRoot de cada unidade) e MicrosoftGame.config.
//  - Riot Client: metadados em ProgramData\Riot Games.
//  - Heroic (Epic/GOG/Amazon pelo Heroic): installed.json do Heroic.
//  - EA app, Rockstar, Battle.net e outros jogos instalados: entradas de desinstalação do Windows, aceitas só com
//    prova de que a pasta é de um jogo (motor Unity/Unreal/Godot/GameMaker/Ren'Py/RPG Maker, Steamworks, EOS, Bink…).
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const isFile = f => { try { return fs.statSync(f).isFile(); } catch (e) { return /\.exe$/i.test(String(f)) && (e?.code === 'EPERM' || e?.code === 'EACCES'); } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const readJSON = f => { try { if (fs.statSync(f).size > 16 * 1024 * 1024) return null; return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const readText = (f, max = 2 * 1024 * 1024) => { try { if (fs.statSync(f).size > max) return ''; return fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''); } catch { return ''; } };
const list = d => { try { return fs.readdirSync(d, {withFileTypes: true}); } catch { return []; } };
const xmlAttr = (xml, tag, attr) => String(xml).match(new RegExp('<' + tag + '\\b[^>]*\\b' + attr + '\\s*=\\s*"([^"]*)"', 'i'))?.[1] || '';
const AUX = /^(?:unins\d*|uninstall.*|setup.*|install.*|update.*|patch.*|vc_?redist.*|dxsetup|dotnet.*|crash.*|unitycrashhandler.*|ue4prereq.*|easyanticheat.*|battleye.*|launcher_?helper.*|cefprocess.*|notification.*|report.*|7z.*|python.*)\.exe$/i;

// ── Xbox / PC Game Pass ──
// Nome da família do pacote: Name + "_" + hash do Publisher (SHA-256 em UTF-16LE, 8 bytes em base32 Crockford).
export function packageFamilyName(name, publisher) {
 const hash = createHash('sha256').update(Buffer.from(String(publisher), 'utf16le')).digest().subarray(0, 8);
 let bits = ''; for (const b of hash) bits += b.toString(2).padStart(8, '0'); bits += '0';
 const abc = '0123456789abcdefghjkmnpqrstvwxyz'; let out = '';
 for (let i = 0; i < 65; i += 5) out += abc[parseInt(bits.slice(i, i + 5), 2)];
 return name + '_' + out;
}
// Identidade Xbox de um jogo: PFN e Title ID (decimal, como o Xbox Live usa). Vem dos dados da loja, do endereço
// "shell:AppsFolder\PFN!App" ou do MicrosoftGame.config ao lado do executável (jogos achados como PC comum também).
const identityCache = new Map();
export function xboxIdentity(game) {
 const out = {pfn: String(game?.store?.url || game?.launch?.args || '').match(/AppsFolder\\([^!\\]+)!/i)?.[1] || String(game?.store?.pfn || ''), titleId: /^\d+$/.test(String(game?.store?.titleId || '')) ? String(game.store.titleId) : ''};
 if (out.pfn && out.titleId) return out;
 const exe = String(game?.launch?.exe || game?.path || ''); if (!exe || game?.notInstalled) return out;
 let hit = identityCache.get(exe.toLowerCase());
 if (!hit) {
  hit = {pfn: '', titleId: ''};
  let dir = path.dirname(exe);
  for (let i = 0; i < 5 && dir; i++) {
   const cfg = readText(path.join(dir, 'MicrosoftGame.config'), 512 * 1024);
   if (cfg) { const name = xmlAttr(cfg, 'Identity', 'Name'), pub = xmlAttr(cfg, 'Identity', 'Publisher'); if (name && pub) hit.pfn = packageFamilyName(name, pub); const tid = cfg.match(/<TitleId>\s*(?:0x)?([0-9A-Fa-f]{1,8})\s*<\/TitleId>/i)?.[1]; if (tid) hit.titleId = String(parseInt(tid, 16)); break; }
   const up = path.dirname(dir); if (up === dir) break; dir = up;
  }
  identityCache.set(exe.toLowerCase(), hit); if (identityCache.size > 500) identityCache.delete(identityCache.keys().next().value);
 }
 return {pfn: out.pfn || hit.pfn, titleId: out.titleId || hit.titleId};
}
export function gamingRoots(drives) {
 const out = [];
 for (const d of drives) {
  const marker = path.join(d, '.GamingRoot');
  if (isFile(marker)) { try { const b = fs.readFileSync(marker); const names = b.subarray(b.toString('latin1', 0, 4) === 'RGBX' ? 8 : 0).toString('utf16le').split('\0').map(s => s.trim()).filter(Boolean); for (const n of names) out.push(path.join(d, n)); } catch {} }
  out.push(path.join(d, 'XboxGames'));
 }
 return [...new Set(out)].filter(isDir);
}
export function scanXbox({drives = []} = {}) {
 const out = [];
 for (const root of gamingRoots(drives)) for (const e of list(root)) {
  if (!e.isDirectory()) continue;
  const dir = path.join(root, e.name), content = path.join(dir, 'Content'), cfg = readText(path.join(content, 'MicrosoftGame.config'));
  if (!cfg) continue;
  const name = xmlAttr(cfg, 'Identity', 'Name'), publisher = xmlAttr(cfg, 'Identity', 'Publisher');
  const exeName = xmlAttr(cfg, 'Executable', 'Name'), appId = xmlAttr(cfg, 'Executable', 'Id') || 'Game';
  let title = xmlAttr(cfg, 'ShellVisuals', 'DefaultDisplayName'); if (!title || /^ms-resource:/i.test(title)) title = e.name;
  const exe = exeName ? path.join(content, ...exeName.split(/[\\/]/)) : '';
  if (!name || !publisher || !isFile(exe)) continue;
  const tid = cfg.match(/<TitleId>\s*(?:0x)?([0-9A-Fa-f]{1,8})\s*<\/TitleId>/i)?.[1];
  out.push({store: 'xbox', storeName: 'Xbox', id: name, title, path: exe, root: content, url: 'shell:AppsFolder\\' + packageFamilyName(name, publisher) + '!' + appId, needsLauncher: true, ...(tid ? {titleId: String(parseInt(tid, 16))} : {}), pfn: packageFamilyName(name, publisher)});
 }
 return out;
}

// ── Riot Client ──
export function scanRiot(env = process.env) {
 const base = path.join(env.PROGRAMDATA || env.ProgramData || 'C:\\ProgramData', 'Riot Games');
 const installs = readJSON(path.join(base, 'RiotClientInstalls.json')) || {};
 const client = [installs.rc_default, installs.rc_live, installs.rc_beta].find(p => p && isFile(p));
 const out = [], titles = {valorant: 'VALORANT', league_of_legends: 'League of Legends', lor: 'Legends of Runeterra', bacon: 'Legends of Runeterra', '2xko': '2XKO'};
 for (const e of list(path.join(base, 'Metadata'))) {
  if (!e.isDirectory()) continue;
  const m = e.name.match(/^([\w-]+)\.([\w-]+)$/); if (!m || m[1] === 'riot_client') continue;
  const yaml = readText(path.join(base, 'Metadata', e.name, e.name + '.product_settings.yaml')) || readText(path.join(base, 'Metadata', e.name, e.name + '.yaml'));
  const root = yaml.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/)?.[1]?.trim(); if (!root || !isDir(root)) continue;
  const exe = list(root).filter(f => f.isFile() && /\.exe$/i.test(f.name) && !AUX.test(f.name)).map(f => path.join(root, f.name)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  if (!exe || !client) continue;
  out.push({store: 'riot', storeName: 'Riot Games', id: e.name, title: titles[m[1]] || m[1].replace(/_/g, ' '), path: exe, root, launcherExe: client, url: '--launch-product=' + m[1] + ' --launch-patchline=' + m[2], needsLauncher: true});
 }
 return out;
}

// ── Heroic ──
export function scanHeroic(env = process.env) {
 const base = env.APPDATA ? path.join(env.APPDATA, 'heroic') : ''; if (!base || !isDir(base)) return [];
 const out = [], add = (runner, appName, title, root, exe) => { if (!appName || !root || !isFile(exe)) return; out.push({store: 'heroic', storeName: 'Heroic', id: runner + ':' + appName, title: title || appName, path: exe, root, url: 'heroic://launch/' + runner + '/' + encodeURIComponent(appName), needsLauncher: true}); };
 const legendary = readJSON(path.join(base, 'legendaryConfig', 'legendary', 'installed.json')) || {};
 for (const [k, v] of Object.entries(legendary)) if (v && v.install_path && v.executable && !v.is_dlc) add('legendary', v.app_name || k, v.title, v.install_path, path.join(v.install_path, ...String(v.executable).split(/[\\/]/)));
 const gog = readJSON(path.join(base, 'gog_store', 'installed.json'));
 for (const v of Array.isArray(gog?.installed) ? gog.installed : []) {
  if (!v?.install_path || v.platform === 'linux' || v.platform === 'osx') continue;
  const info = list(v.install_path).find(f => /^goggame-\d+\.info$/i.test(f.name)); const data = info ? readJSON(path.join(v.install_path, info.name)) : null;
  const task = (data?.playTasks || []).find(t => t.isPrimary && t.path) || (data?.playTasks || []).find(t => t.path);
  if (task) add('gog', v.appName, data.name, v.install_path, path.join(v.install_path, ...String(task.path).split(/[\\/]/)));
 }
 const nile = readJSON(path.join(base, 'nile_config', 'nile', 'installed.json'));
 for (const v of Array.isArray(nile) ? nile : []) { const fuel = v?.path ? readJSON(path.join(v.path, 'fuel.json')) : null, cmd = fuel?.Main?.Command; if (cmd) add('nile', v.id, v.title || path.basename(v.path), v.path, path.join(v.path, ...String(cmd).split(/[\\/]/))); }
 return out;
}

// ── Prova de que uma pasta instalada é um jogo ──
export function gameEvidence(root, {maxDepth = 3} = {}) {
 const found = new Set(); let dirs = 0;
 const walk = (dir, depth) => {
  if (depth > maxDepth || ++dirs > 400) return;
  for (const e of list(dir)) {
   const n = e.name.toLowerCase(), p = path.join(dir, e.name);
   if (e.isDirectory()) {
    if (/_data$/.test(n) && (isFile(path.join(p, 'globalgamemanagers')) || isFile(path.join(p, 'data.unity3d')))) found.add('unity');
    else if (n === 'renpy') found.add('renpy');
    else if (n === 'paks' && path.basename(dir).toLowerCase() === 'content') found.add('unreal');
    else if (n === 'www' && (isFile(path.join(p, 'js', 'rpg_core.js')) || isFile(path.join(p, 'js', 'rmmz_core.js')))) found.add('rpgmaker');
    if (!/^(redist|_commonredist|directx|vcredist|support|__installer|installers?)$/i.test(n)) walk(p, depth + 1);
    continue;
   }
   if (n === 'unityplayer.dll' || n === 'gameassembly.dll') found.add('unity');
   else if (/-win64-shipping\.exe$|-wingdk-shipping\.exe$/.test(n)) found.add('unreal');
   else if (n.endsWith('.pck') && depth === 0) found.add('godot');
   else if (n === 'data.win' || n === 'options.ini' && isFile(path.join(dir, 'data.win'))) found.add('gamemaker');
   else if (n === 'steam_api.dll' || n === 'steam_api64.dll') found.add('steamworks');
   else if (/^eossdk-win(32|64)-shipping\.dll$/.test(n)) found.add('eos');
   else if (/^bink2?w(32|64)\.dll$/.test(n)) found.add('bink');
   else if (/^fmod(studio)?(64)?\.dll$/.test(n)) found.add('fmod');
   else if (n === 'rgss3a' || /^rgss\d+[a-z]?\.dll$/.test(n) || n === 'game.rgss3a') found.add('rpgmaker');
  }
 };
 walk(root, 0);
 return [...found];
}
const NOT_GAMES = /^(microsoft|google|mozilla|adobe|nvidia|intel|advanced micro devices|amd|oracle|python software|node\.js|the git development|valve|logitech|razer|corsair|asus|realtek|epic games, inc\.|gog sp\. z o\.o\.|ubisoft|electronic arts launcher)\b/i;
function mainExe(root, icon) {
 const ic = String(icon || '').replace(/^"|"$/g, '').replace(/,\s*-?\d+$/, '');
 if (/\.exe$/i.test(ic) && isFile(ic) && !AUX.test(path.basename(ic)) && ic.toLowerCase().startsWith(root.toLowerCase())) return ic;
 const exes = list(root).filter(e => e.isFile() && /\.exe$/i.test(e.name) && !AUX.test(e.name)).map(e => path.join(root, e.name));
 return exes.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0] || '';
}
// Entradas de desinstalação do Windows → jogos (EA app, Rockstar, Battle.net e jogos sem loja).
export async function scanInstalledGames({regQuery, skipRoots = [], includeLoose = false} = {}) {
 if (typeof regQuery !== 'function') return [];
 const keys = ['HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'];
 const entries = []; for (const k of keys) entries.push(...await regQuery(k));
 const skip = skipRoots.map(r => String(r).toLowerCase().replace(/[\\/]+$/, '')), out = [], seen = new Set();
 for (const entry of entries) {
  const v = entry.values || {}, name = String(v.DisplayName || '').trim(), root = String(v.InstallLocation || '').replace(/^"|"$/g, '').replace(/[\\/]+$/, '');
  if (!name || !root || !isDir(root) || v.SystemComponent === '0x1' || /\bsteamapps\b/i.test(root)) continue;
  const lower = root.toLowerCase(); if (seen.has(lower) || skip.some(s => lower === s || lower.startsWith(s + '\\') || s.startsWith(lower + '\\'))) continue;
  const publisher = String(v.Publisher || '');
  const ea = /electronic arts/i.test(publisher) || isDir(path.join(root, '__Installer')), rockstar = /rockstar games/i.test(publisher), blizzard = /blizzard/i.test(publisher);
  if (!ea && !rockstar && !blizzard && NOT_GAMES.test(publisher)) continue;
  const evidence = gameEvidence(root);
  // 1.6.0: só jogos de loja (EA, Rockstar, Battle.net). Programas "com cara de jogo" ficaram de fora, davam muito
  // falso positivo; jogos de PC sem loja entram pela Pasta de atalhos.
  if (!(ea || rockstar || blizzard) && !includeLoose) continue;
  if (!evidence.length && !(ea || rockstar || blizzard)) continue;
  if ((ea || rockstar || blizzard) && /launcher|app$|^ea app|^origin|battle\.net|social club/i.test(name)) continue;
  const exe = mainExe(root, v.DisplayIcon); if (!exe) continue;
  seen.add(lower);
  const store = ea ? ['ea', 'EA app'] : rockstar ? ['rockstar', 'Rockstar Games'] : blizzard ? ['battlenet', 'Battle.net'] : ['windows', 'Instalado no Windows'];
  out.push({store: store[0], storeName: store[1], id: path.basename(entry.key || name), title: name.replace(/\s*\((?:x64|64-bit|32-bit)\)\s*$/i, ''), path: exe, root, needsLauncher: false, evidence});
 }
 return out;
}
