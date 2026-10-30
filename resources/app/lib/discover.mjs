// Busca automática de jogos: descobre onde os jogos já estão sem o usuário escolher pastas.
// Rotas estudadas em frontends (EmulationStation/RetroBat, EmuDeck, LaunchBox, Playnite) e nos próprios
// emuladores: cada emulador guarda as pastas de jogos que o usuário já configurou nele. A busca usa
// primeiro essas pastas (certeza de serem jogos de emulador) e depois pastas de ROMs comuns.
// Só pastas são devolvidas; a identificação e a decisão de importar sozinho ficam com o fluxo de importação.
import fs from 'node:fs';
import path from 'node:path';

const ROM_FOLDERS = ['Roms', 'ROMs', 'roms', 'ROMS', 'Emulation\\roms', 'Emulation\\ROMs', 'RetroBat\\roms', 'Jogos\\Roms', 'Games\\Roms', 'Games\\ROMs', 'Emuladores\\Roms', 'Emuladores\\Jogos', 'Emulators\\Roms', 'Emulators\\Games', 'ISOs', 'Isos', 'PS2\\ISOs', 'PSP\\ISO', 'Jogos PSP', 'Jogos PS2', 'Jogos PS1'];
const HOME_FOLDERS = ['Roms', 'ROMs', 'roms', 'Emulation\\roms', 'Documents\\Roms', 'Documents\\ROMs', 'Documents\\ISOs', 'Documentos\\Roms', 'Games\\Roms', 'Jogos\\Roms'];
// Pastas comuns de jogos de PC instalados fora de lojas: cada subpasta é tratada como um jogo separado.
const PC_FOLDERS = ['Games', 'Jogos', 'Juegos', 'Spiele', 'Jeux'];
const SKIP = /^(windows|program files( \(x86\))?|programdata|\$recycle\.bin|system volume information|steamlibrary|steamapps|appdata|recovery|perflogs|msocache)$/i;

const defaults = {
 exists: p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } },
 file: p => { try { return fs.statSync(p).isFile(); } catch { return false; } },
 read: p => { try { const st = fs.statSync(p); if (!st.isFile() || st.size > 8 * 1024 * 1024) return ''; return fs.readFileSync(p, 'utf8'); } catch { return ''; } },
 list: p => { try { return fs.readdirSync(p, {withFileTypes: true}).map(d => ({name: d.name, dir: d.isDirectory()})); } catch { return []; } },
};

// INI simples (PCSX2, DuckStation, PPSSPP, Dolphin, Citra/Azahar).
export function iniSections(text) {
 const out = {}; let cur = '';
 for (const raw of String(text || '').split(/\r?\n/)) {
  const line = raw.trim(); if (!line || line[0] === ';' || line[0] === '#') continue;
  const sec = line.match(/^\[(.+)\]$/); if (sec) { cur = sec[1].trim().toLowerCase(); out[cur] ||= []; continue; }
  const i = line.indexOf('='); if (i < 1) continue;
  (out[cur] ||= []).push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
 }
 return out;
}
const unquote = s => String(s || '').trim().replace(/^"(.*)"$/, '$1').replace(/\\\\/g, '\\');
const fileDir = p => { const clean = String(p || '').split('#')[0]; return clean ? (/^[a-z]:[\\/]|^\\\\/i.test(clean)?path.win32:path.posix).dirname(clean) : ''; };

// Pastas de jogos configuradas em cada emulador. `dirs` traz as pastas onde o emulador foi encontrado.
export function emulatorGameFolders({launchers = {}, emulator = '', env = process.env, io = defaults} = {}) {
 const out = [], add = (p, source) => { p = unquote(p); if (p && /^(?:[a-z]:[\\/]|\\\\|\/)/i.test(p)) out.push({path: p.replace(/\//g, path.sep === '\\' ? '\\' : '/'), source}); };
 const home=env.HOME||env.USERPROFILE||'',xdg=env.XDG_CONFIG_HOME||path.join(home,'.config'),data=env.XDG_DATA_HOME||path.join(home,'.local/share'),flat=path.join(home,'.var/app');
 const docs = home ? path.join(home, 'Documents') : '';
 const exeDir = key => launchers[key]?.exe ? path.dirname(launchers[key].exe) : '';
 const j = (...p) => p.every(Boolean) ? path.join(...p) : '';
 // RetroArch: listas de reprodução (.lpl) guardam o caminho de cada jogo já escaneado.
 for (const base of [exeDir('retroarch'), j(env.APPDATA, 'RetroArch'), 'C:\\RetroArch-Win64', 'C:\\RetroArch', path.join(xdg,'retroarch'),path.join(flat,'org.libretro.RetroArch/config/retroarch')]) {
  const dir = j(base, 'playlists'); if (!dir || !io.exists(dir)) continue;
  for (const f of io.list(dir)) if (!f.dir && /\.lpl$/i.test(f.name)) { try { for (const it of JSON.parse(io.read(path.join(dir, f.name)) || '{}').items || []) add(fileDir(it.path), 'RetroArch'); } catch {} }
 }
 // PCSX2 e DuckStation: [GameList] Paths / RecursivePaths.
 for (const [file, source] of [[j(xdg,'PCSX2/inis/PCSX2.ini'),'PCSX2'],[j(flat,'net.pcsx2.PCSX2/config/PCSX2/inis/PCSX2.ini'),'PCSX2'],[j(xdg,'duckstation/settings.ini'),'DuckStation'],[j(flat,'org.duckstation.DuckStation/config/duckstation/settings.ini'),'DuckStation'],[j(docs, 'PCSX2', 'inis', 'PCSX2.ini'), 'PCSX2'], [j(exeDir('ps2'), 'inis', 'PCSX2.ini'), 'PCSX2'], [j(docs, 'DuckStation', 'settings.ini'), 'DuckStation'], [j(exeDir('ps1'), 'settings.ini'), 'DuckStation'], [j(env.LOCALAPPDATA, 'DuckStation', 'settings.ini'), 'DuckStation']]) {
  if (!file) continue; const ini = iniSections(io.read(file));
  for (const [k, v] of ini.gamelist || []) if (/^(recursive)?paths$/i.test(k)) add(v, source);
 }
 // PPSSPP: pasta atual do navegador de jogos, recentes e pastas fixadas.
 const pspDir = exeDir('psp') || (emulator ? path.dirname(emulator) : '');
 for (const file of [j(xdg,'ppsspp/PSP/SYSTEM/ppsspp.ini'),j(flat,'org.ppsspp.PPSSPP/config/ppsspp/PSP/SYSTEM/ppsspp.ini'),j(pspDir, 'memstick', 'PSP', 'SYSTEM', 'ppsspp.ini'), j(docs, 'PPSSPP', 'PSP', 'SYSTEM', 'ppsspp.ini')]) {
  if (!file) continue; const ini = iniSections(io.read(file));
  for (const [k, v] of ini.general || []) if (/^currentdirectory$/i.test(k)) add(v, 'PPSSPP');
  for (const [k, v] of ini.recent || []) if (/^filename\d+$/i.test(k)) add(fileDir(v), 'PPSSPP');
  for (const [k, v] of ini.pinnedpaths || []) if (/^path\d+$/i.test(k)) add(v, 'PPSSPP');
 }
 // Dolphin: ISOPath0..N.
 for (const file of [j(xdg,'dolphin-emu/Dolphin.ini'),j(flat,'org.DolphinEmu.dolphin-emu/config/dolphin-emu/Dolphin.ini'),j(data,'dolphin-emu/Config/Dolphin.ini'),j(flat,'org.DolphinEmu.dolphin-emu/data/dolphin-emu/Config/Dolphin.ini'),j(env.APPDATA, 'Dolphin Emulator', 'Config', 'Dolphin.ini'), j(docs, 'Dolphin Emulator', 'Config', 'Dolphin.ini'), j(exeDir('dolphin'), 'User', 'Config', 'Dolphin.ini')]) {
  if (!file) continue; for (const [k, v] of iniSections(io.read(file)).general || []) if (/^isopath\d+$/i.test(k)) add(v, 'Dolphin');
 }
 // RPCS3: games.yml lista cada jogo instalado (SERIAL: caminho).
 for (const file of [j(xdg,'rpcs3/games.yml'),j(flat,'net.rpcs3.RPCS3/config/rpcs3/games.yml'),j(exeDir('ps3'), 'config', 'games.yml'), j(exeDir('ps3'), 'games.yml')]) {
  if (!file) continue; for (const m of io.read(file).matchAll(/^\s*[A-Z]{4}\d{5}\s*:\s*(.+?)\s*$/gm)) add(m[1].replace(/^["']|["']$/g, ''), 'RPCS3');
 }
 // yuzu e derivados (suyu, sudachi, citron, eden): qt-config.ini, [UI] Paths\gamedirs\N\path.
 for (const [name, label] of [['yuzu', 'yuzu'], ['suyu', 'suyu'], ['sudachi', 'Sudachi'], ['citron', 'Citron'], ['eden', 'Eden']]) {
  for (const file of [j(env.APPDATA, name, 'config', 'qt-config.ini'), j(exeDir('switch'), 'user', 'config', 'qt-config.ini')]) {
   if (!file) continue; const text = io.read(file) || ''; if (!text) continue;
   for (const m of text.matchAll(/^Paths\\gamedirs\\\d+\\path\s*=\s*(.+)$/gim)) { const v = m[1].trim(); if (v && !/^(SDMC|UserNAND|SysNAND)$/i.test(v)) add(v, label); }
  }
 }
 // Ryujinx e derivados: Config.json game_dirs.
 for (const file of [j(env.APPDATA, 'Ryujinx', 'Config.json'), j(exeDir('switch'), 'portable', 'Config.json')]) {
  if (!file) continue; try { for (const d of JSON.parse(io.read(file) || '{}').game_dirs || []) add(d, 'Ryujinx'); } catch {}
 }
 // Cemu: <GamePaths><Entry>.
 for (const file of [j(exeDir('cemu'), 'settings.xml'), j(env.APPDATA, 'Cemu', 'settings.xml')]) {
  if (!file) continue; const xml = io.read(file).match(/<GamePaths>([\s\S]*?)<\/GamePaths>/i)?.[1] || '';
  for (const m of xml.matchAll(/<Entry>([^<]+)<\/Entry>/gi)) add(m[1], 'Cemu');
 }
 // Azahar / Citra / Lime3DS: Paths\gamedirs\N\path.
 for (const app of ['Azahar', 'Lime3DS', 'Citra']) for (const file of [j(env.APPDATA, app, 'config', 'qt-config.ini'), j(exeDir('azahar'), 'user', 'config', 'qt-config.ini')]) {
  if (!file) continue; for (const rows of Object.values(iniSections(io.read(file)))) for (const [k, v] of rows) if (/gamedirs\\\d+\\path$/i.test(k) && !/^(SDMC|UserNANDs|SysNANDs|INSTALLED)$/i.test(v)) add(v, 'Azahar');
 }
 // shadPS4: installDirs no config.toml.
 for (const file of [j(exeDir('shadps4'), 'user', 'config.toml'), j(env.APPDATA, 'shadPS4', 'config.toml')]) {
  if (!file) continue; const block = io.read(file).match(/installDirs\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  for (const m of block.matchAll(/["']([^"']+)["']/g)) add(m[1], 'shadPS4');
 }
 // xemu e Xenia guardam caminhos de forma variável; ficam para as pastas comuns.
 return out;
}

// Frontends que organizam ROMs em pastas por sistema.
export function frontendFolders({env = process.env, drives = [], io = defaults} = {}) {
 const out = [], home = env.USERPROFILE || env.HOME || '';
 const add = (p, source) => { if (p && io.exists(p)) out.push({path: p, source}); };
 for (const d of drives) { add(path.join(d, 'RetroBat', 'roms'), 'RetroBat'); add(path.join(d, 'Emulation', 'roms'), 'EmuDeck'); }
 if (home) add(path.join(home, 'Emulation', 'roms'), 'EmuDeck');
 // LaunchBox: ApplicationPath de cada jogo, relativo à pasta do LaunchBox.
 for (const base of [...drives.map(d => path.join(d, 'LaunchBox')), home && path.join(home, 'LaunchBox')].filter(Boolean)) {
  const dir = path.join(base, 'Data', 'Platforms'); if (!io.exists(dir)) continue;
  for (const f of io.list(dir)) if (!f.dir && /\.xml$/i.test(f.name)) for (const m of io.read(path.join(dir, f.name)).matchAll(/<ApplicationPath>([^<]+)<\/ApplicationPath>/g)) {
   const p = m[1].replace(/&amp;/g, '&'), abs = /^[a-z]:[\\/]/i.test(p) ? p : path.join(base, p);
   out.push({path: path.dirname(abs), source: 'LaunchBox'});
  }
 }
 return out;
}

// Pastas de ROMs com nomes comuns em cada unidade e na pasta do usuário.
export function commonFolders({env = process.env, drives = [], io = defaults} = {}) {
 const out = [], home = env.USERPROFILE || env.HOME || '';
 for (const d of drives) for (const rel of ROM_FOLDERS) { const p = path.join(d, ...rel.split('\\')); if (io.exists(p)) out.push({path: p, source: 'roms'}); }
 if (home) for (const rel of HOME_FOLDERS) { const p = path.join(home, ...rel.split('\\')); if (io.exists(p)) out.push({path: p, source: 'roms'}); }
 return out;
}

// Jogos de PC fora das lojas: cada subpasta de \Games, \Jogos... vira uma busca separada (evita estourar o
// limite de arquivos de uma pasta inteira). A importação só aceita sozinha quando há prova (AppID, loja).
export function pcGameFolders({drives = [], env = process.env, io = defaults, max = 200} = {}) {
 const out = [], home = env.USERPROFILE || env.HOME || '';
 const roots = [...drives.flatMap(d => PC_FOLDERS.map(n => path.join(d, n))), ...(home ? PC_FOLDERS.map(n => path.join(home, n)) : [])];
 for (const root of roots) {
  if (!io.exists(root)) continue;
  for (const f of io.list(root)) { if (!f.dir || SKIP.test(f.name) || /^(roms|isos?|emula(tors|dores|tion))$/i.test(f.name)) continue; out.push({path: path.join(root, f.name), source: 'pc'}); if (out.length >= max) return out; }
 }
 return out;
}

export function windowsDrives(io = defaults) {
 const out = [];
 for (let c = 67; c <= 90; c++) { const d = String.fromCharCode(c) + ':\\'; if (io.exists(d)) out.push(d); }
 return out;
}

// Remove duplicadas e pastas dentro de outras já incluídas.
export function collapseFolders(list, {caseInsensitive = true} = {}) {
 const norm = p => { const r = path.resolve(p).replace(/[\\/]+$/, ''); return caseInsensitive ? r.toLowerCase() : r; };
 const seen = new Map();
 for (const item of list) { const key = norm(item.path); if (!seen.has(key)) seen.set(key, {...item, path: path.resolve(item.path), sources: [item.source]}); else { const s = seen.get(key); if (!s.sources.includes(item.source)) s.sources.push(item.source); } }
 const keys = [...seen.keys()].sort((a, b) => a.length - b.length), kept = [];
 for (const key of keys) if (!kept.some(k => key.startsWith(k + path.sep) || key.startsWith(k + '\\') || key.startsWith(k + '/'))) kept.push(key);
 return kept.map(k => seen.get(k));
}

// Junta todas as fontes. `saved` são as pastas que o usuário já escolheu antes.
export function discoverGameFolders(config = {}, {env = process.env, platform = process.platform, io = defaults, drives = null, limit = 900} = {}) {
 io = {...defaults, ...io};
 const ds = drives || (platform === 'win32' ? windowsDrives(io) : []);
 const found = [
  ...emulatorGameFolders({launchers: config.launchers || {}, emulator: config.emulator || '', env, io}),
  ...frontendFolders({env, drives: ds, io}),
  ...commonFolders({env, drives: ds, io}),
  ...(config.roots || []).map(p => ({path: p, source: 'saved'})),
 ].filter(f => io.exists(f.path) && !SKIP.test(path.basename(f.path)) && !/^[a-z]:[\\/]?$/i.test(f.path) && path.resolve(f.path) !== path.resolve(env.USERPROFILE || env.HOME || '/__none__'));
 const roms = collapseFolders(found, {caseInsensitive: platform === 'win32'});
 const pc = collapseFolders(pcGameFolders({drives: ds, env, io}), {caseInsensitive: platform === 'win32'}).filter(p => !roms.some(r => (p.path + path.sep).toLowerCase().startsWith((r.path + path.sep).toLowerCase())));
 const all = [...roms, ...pc].slice(0, limit);
 const sources = [...new Set(all.flatMap(f => f.sources))];
 return {folders: all, paths: all.map(f => f.path), sources};
}

// Varredura ampla (busca automática): pastas do usuário e as unidades inteiras. Os arquivos achados só entram
// quando o próprio conteúdo prova que é um jogo (cabeçalho da ISO/cartucho) ou estão numa pasta de plataforma.
export function sweepRoots({env = process.env, platform = process.platform, io = defaults, drives = null, skip = []} = {}) {
 io = {...defaults, ...io};
 const home = env.USERPROFILE || env.HOME || '', out = [];
 const add = p => { if (p && io.exists(p)) out.push(p); };
 for (const rel of ['Desktop', 'Downloads', 'Documents', 'Documentos', 'Games', 'Jogos', 'OneDrive\\Desktop', 'OneDrive\\Documents', 'OneDrive\\Documentos', 'OneDrive\\Área de Trabalho']) if (home) add(path.join(home, ...rel.split('\\')));
 for (const d of drives || (platform === 'win32' ? windowsDrives(io) : [])) add(d);
 const norm = p => path.resolve(p).replace(/[\\/]+$/, '').toLowerCase();
 const skipped = new Set(skip.map(norm));
 return [...new Set(out.map(p => path.resolve(p)))].filter(p => !skipped.has(norm(p)));
}
// Onde procurar emuladores além das pastas padrão: pastas do usuário e raízes das outras unidades.
export function emulatorSearchRoots({env = process.env, platform = process.platform, io = defaults, drives = null} = {}) {
 io = {...defaults, ...io};
 const home = env.USERPROFILE || env.HOME || '', out = [];
 for (const rel of ['Desktop', 'Downloads', 'Documents', 'Documentos', 'Games', 'Jogos', 'Emuladores', 'Emulators']) { const p = home && path.join(home, rel); if (p && io.exists(p)) out.push(p); }
 for (const d of drives || (platform === 'win32' ? windowsDrives(io) : [])) for (const n of ['Emuladores', 'Emulators', 'Emulation', 'Games', 'Jogos', 'RetroArch', 'PPSSPP', 'PCSX2', 'DuckStation', 'Dolphin', 'RPCS3']) { const p = path.join(d, n); if (io.exists(p)) out.push(p); }
 return [...new Set(out)];
}
