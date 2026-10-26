// Catálogo de plataformas do Taiga Launcher.
// Cada plataforma reúne os identificadores usados pelas fontes externas (IGDB,
// RetroAchievements, libretro), os nomes de pasta mais comuns em coleções de
// ROMs (EmuDeck, ES-DE, RetroBat, Batocera, LaunchBox, RomM, RetroArch, Redump
// e No-Intro) e os perfis de emulador que podem executá-la.
// O nome (name) segue a IGDB, que já era o padrão gravado nos cadastros.
import path from 'node:path';

const P = (key, name, short, igdb, ra, libretro, extra = {}) => ({key, name, short, igdb, ra, libretro, aliases: [], ext: [], profiles: [], dat: [], hash: null, family: 'other', ...extra});

export const PLATFORMS = [
 P('psp', 'PlayStation Portable', 'PSP', 38, 41, 'Sony - PlayStation Portable', {family: 'sony', aliases: ['psp', 'playstation portable', 'sony playstation portable', 'ppsspp', 'umd'], ext: ['cso', 'pbp'], profiles: ['psp', 'retroarch'], dat: [['redump', 'Sony - PlayStation Portable'], ['no-intro', 'Sony - PlayStation Portable (PSN)']], hash: 'psp', serial: /^(?:UL|UC|NP|ND)[A-Z]{2}[-_ ]?\d{5}$/}),
 P('ps2', 'PlayStation 2', 'PS2', 8, 21, 'Sony - PlayStation 2', {family: 'sony', aliases: ['ps2', 'playstation 2', 'playstation2', 'sony playstation 2', 'pcsx2'], ext: [], profiles: ['ps2', 'retroarch'], dat: [['redump', 'Sony - PlayStation 2']], hash: 'ps2', serial: /^S[CL][AEKPU][CDMS][-_ ]?\d{3}\.?\d{2}$/}),
 P('ps1', 'PlayStation', 'PS1', 7, 12, 'Sony - PlayStation', {family: 'sony', aliases: ['psx', 'ps1', 'psone', 'playstation', 'playstation 1', 'sony playstation', 'sony playstation 1', 'duckstation', 'swanstation'], ext: [], profiles: ['ps1', 'bizhawk', 'mednafen', 'ares', 'retroarch'], dat: [['redump', 'Sony - PlayStation']], hash: 'ps1', serial: /^S[CL][AEPU][DMS][-_ ]?\d{3}\.?\d{2}$/}),
 P('ps3', 'PlayStation 3', 'PS3', 9, null, 'Sony - PlayStation 3', {family: 'sony', aliases: ['ps3', 'playstation 3', 'playstation3', 'sony playstation 3', 'rpcs3'], ext: [], profiles: ['ps3'], dat: [['redump', 'Sony - PlayStation 3']], serial: /^(?:BL|BC|NP)[A-Z]{2}\d{5}$/}),
 P('ps4', 'PlayStation 4', 'PS4', 48, null, 'Sony - PlayStation 4', {family: 'sony', aliases: ['ps4', 'playstation 4', 'playstation4', 'sony playstation 4', 'shadps4'], ext: [], profiles: ['shadps4'], serial: /^(?:CUSA|PLAS)\d{5}$/}),
 P('vita', 'PlayStation Vita', 'Vita', 46, null, 'Sony - PlayStation Vita', {family: 'sony', aliases: ['psvita', 'vita', 'ps vita', 'playstation vita', 'sony playstation vita', 'vita3k'], ext: ['vpk'], profiles: ['vita3k'], dat: [['no-intro', 'Sony - PlayStation Vita']], serial: /^(?:PCS[A-Z]|NP[A-Z]{2})\d{5}$/}),
 P('gc', 'Nintendo GameCube', 'GC', 21, 16, 'Nintendo - GameCube', {family: 'nintendo', aliases: ['gc', 'gamecube', 'ngc', 'nintendo gamecube', 'game cube'], ext: ['gcm', 'gcz'], profiles: ['dolphin', 'retroarch'], dat: [['redump', 'Nintendo - GameCube']]}),
 P('wii', 'Wii', 'Wii', 5, 19, 'Nintendo - Wii', {family: 'nintendo', aliases: ['wii', 'nintendo wii'], ext: ['wbfs', 'wad'], profiles: ['dolphin'], dat: [['redump', 'Nintendo - Wii']]}),
 P('wiiu', 'Wii U', 'Wii U', 41, 20, 'Nintendo - Wii U', {family: 'nintendo', aliases: ['wiiu', 'wii u', 'nintendo wii u', 'cemu'], ext: ['wud', 'wux', 'wua', 'rpx'], profiles: ['cemu']}),
 P('switch', 'Nintendo Switch', 'Switch', 130, null, 'Nintendo - Switch', {family: 'nintendo', aliases: ['switch', 'nintendo switch', 'nsw', 'ryujinx', 'yuzu', 'citron', 'eden', 'sudachi'], ext: ['xci', 'nsp', 'nsz', 'xcz'], profiles: ['switch']}),
 P('3ds', 'Nintendo 3DS', '3DS', 37, 62, 'Nintendo - Nintendo 3DS', {family: 'nintendo', aliases: ['3ds', 'n3ds', 'nintendo 3ds', 'citra', 'azahar', 'lime3ds'], ext: ['3ds', 'cci', 'cia', 'cxi', '3dsx'], profiles: ['azahar', 'retroarch'], dat: [['no-intro', 'Nintendo - Nintendo 3DS']]}),
 P('nds', 'Nintendo DS', 'DS', 20, 18, 'Nintendo - Nintendo DS', {family: 'nintendo', aliases: ['nds', 'ds', 'nintendo ds', 'melonds', 'desmume'], ext: ['nds', 'dsi'], profiles: ['melonds', 'bizhawk', 'retroarch'], dat: [['no-intro', 'Nintendo - Nintendo DS']], hash: 'nds'}),
 P('gba', 'Game Boy Advance', 'GBA', 24, 5, 'Nintendo - Game Boy Advance', {family: 'nintendo', aliases: ['gba', 'game boy advance', 'gameboy advance', 'nintendo game boy advance', 'mgba'], ext: ['gba', 'agb'], profiles: ['mgba', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Game Boy Advance']], hash: 'whole'}),
 P('gbc', 'Game Boy Color', 'GBC', 22, 6, 'Nintendo - Game Boy Color', {family: 'nintendo', aliases: ['gbc', 'game boy color', 'gameboy color', 'nintendo game boy color'], ext: ['gbc', 'cgb'], profiles: ['mgba', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Game Boy Color']], hash: 'whole'}),
 P('gb', 'Game Boy', 'GB', 33, 4, 'Nintendo - Game Boy', {family: 'nintendo', aliases: ['gb', 'game boy', 'gameboy', 'nintendo game boy', 'dmg'], ext: ['gb', 'dmg', 'sgb'], profiles: ['mgba', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Game Boy']], hash: 'whole'}),
 P('n64', 'Nintendo 64', 'N64', 4, 2, 'Nintendo - Nintendo 64', {family: 'nintendo', aliases: ['n64', 'nintendo 64', 'nintendo64', 'project64', 'mupen64', 'mupen64plus', 'simple64', 'rmg'], ext: ['n64', 'z64', 'v64', 'ndd'], profiles: ['project64', 'bizhawk', 'ares', 'retroarch'], dat: [['no-intro', 'Nintendo - Nintendo 64']], hash: 'n64'}),
 P('snes', 'Super Nintendo Entertainment System', 'SNES', 19, 3, 'Nintendo - Super Nintendo Entertainment System', {family: 'nintendo', aliases: ['snes', 'sfc', 'super nintendo', 'super famicom', 'super nintendo entertainment system', 'snes9x', 'bsnes', 'supernintendo'], ext: ['sfc', 'smc', 'swc', 'fig', 'bs'], profiles: ['snes9x', 'mesen', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Super Nintendo Entertainment System']], hash: 'snes'}),
 P('nes', 'Nintendo Entertainment System', 'NES', 18, 7, 'Nintendo - Nintendo Entertainment System', {family: 'nintendo', aliases: ['nes', 'famicom', 'fc', 'nintendo entertainment system', 'nintendo nes', 'nestopia', 'fceux'], ext: ['nes', 'unf', 'unif'], profiles: ['mesen', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Nintendo Entertainment System']], hash: 'nes'}),
 P('fds', 'Family Computer Disk System', 'FDS', 51, 7, 'Nintendo - Family Computer Disk System', {family: 'nintendo', aliases: ['fds', 'famicom disk system', 'family computer disk system'], ext: ['fds'], profiles: ['mesen', 'bizhawk', 'ares', 'retroarch'], dat: [['no-intro', 'Nintendo - Family Computer Disk System']], hash: 'fds'}),
 P('virtualboy', 'Virtual Boy', 'VB', 87, 28, 'Nintendo - Virtual Boy', {family: 'nintendo', aliases: ['virtualboy', 'virtual boy', 'vb'], ext: ['vb', 'vboy'], profiles: ['bizhawk', 'mednafen', 'retroarch'], dat: [['no-intro', 'Nintendo - Virtual Boy']], hash: 'whole'}),
 P('pokemini', 'Pokémon mini', 'Poké mini', 166, 24, 'Nintendo - Pokemon Mini', {family: 'nintendo', aliases: ['pokemini', 'pokemon mini'], ext: ['min'], profiles: ['retroarch'], dat: [['no-intro', 'Nintendo - Pokemon Mini']], hash: 'whole'}),
 P('genesis', 'Sega Mega Drive/Genesis', 'Mega Drive', 29, 1, 'Sega - Mega Drive - Genesis', {family: 'sega', aliases: ['genesis', 'megadrive', 'mega drive', 'md', 'sega genesis', 'sega mega drive', 'sega mega drive genesis'], ext: ['gen', 'md', 'smd'], profiles: ['bizhawk', 'ares', 'fusion', 'mednafen', 'retroarch'], dat: [['no-intro', 'Sega - Mega Drive - Genesis']], hash: 'whole'}),
 P('sms', 'Sega Master System/Mark III', 'Master System', 64, 11, 'Sega - Master System - Mark III', {family: 'sega', aliases: ['sms', 'mastersystem', 'master system', 'sega master system', 'mark iii', 'sega mark iii'], ext: ['sms'], profiles: ['mesen', 'bizhawk', 'ares', 'fusion', 'mednafen', 'retroarch'], dat: [['no-intro', 'Sega - Master System - Mark III']], hash: 'whole', names: ['Sega Master System']}),
 P('gamegear', 'Sega Game Gear', 'Game Gear', 35, 15, 'Sega - Game Gear', {family: 'sega', aliases: ['gamegear', 'game gear', 'gg', 'sega game gear'], ext: ['gg'], profiles: ['mesen', 'bizhawk', 'ares', 'fusion', 'mednafen', 'retroarch'], dat: [['no-intro', 'Sega - Game Gear']], hash: 'whole'}),
 P('sg1000', 'SG-1000', 'SG-1000', 84, 33, 'Sega - SG-1000', {family: 'sega', aliases: ['sg1000', 'sg 1000', 'sega sg 1000'], ext: ['sg'], profiles: ['bizhawk', 'ares', 'fusion', 'retroarch'], dat: [['no-intro', 'Sega - SG-1000']], hash: 'whole'}),
 P('segacd', 'Sega CD', 'Sega CD', 78, 9, 'Sega - Mega-CD - Sega CD', {family: 'sega', aliases: ['segacd', 'sega cd', 'megacd', 'mega cd', 'sega mega cd'], ext: [], profiles: ['bizhawk', 'ares', 'fusion', 'retroarch'], dat: [['redump', 'Sega - Mega-CD - Sega CD']], hash: 'segacd'}),
 P('sega32x', 'Sega 32X', '32X', 30, 10, 'Sega - 32X', {family: 'sega', aliases: ['32x', 'sega32x', 'sega 32x'], ext: ['32x'], profiles: ['ares', 'fusion', 'retroarch'], dat: [['no-intro', 'Sega - 32X']], hash: 'whole'}),
 P('saturn', 'Sega Saturn', 'Saturn', 32, 39, 'Sega - Saturn', {family: 'sega', aliases: ['saturn', 'sega saturn', 'ss'], ext: [], profiles: ['mednafen', 'bizhawk', 'retroarch'], dat: [['redump', 'Sega - Saturn']], hash: 'saturn'}),
 P('dreamcast', 'Dreamcast', 'Dreamcast', 23, 40, 'Sega - Dreamcast', {family: 'sega', aliases: ['dreamcast', 'dc', 'sega dreamcast', 'flycast', 'redream'], ext: ['gdi', 'cdi'], profiles: ['flycast', 'redream', 'retroarch'], dat: [['redump', 'Sega - Dreamcast']]}),
 P('xbox', 'Xbox', 'Xbox', 11, null, 'Microsoft - XBOX', {family: 'microsoft', aliases: ['xbox', 'microsoft xbox', 'xemu', 'original xbox'], ext: ['xbe'], profiles: ['xemu'], dat: [['redump', 'Microsoft - Xbox']]}),
 P('xbox360', 'Xbox 360', 'X360', 12, null, 'Microsoft - Xbox 360', {family: 'microsoft', aliases: ['xbox360', 'xbox 360', 'x360', 'xenia', 'microsoft xbox 360'], ext: ['xex'], profiles: ['xenia'], dat: [['redump', 'Microsoft - Xbox 360']]}),
 P('arcade', 'Arcade', 'Arcade', 52, 27, 'MAME', {family: 'arcade', aliases: ['arcade', 'mame', 'fbneo', 'fba', 'finalburn', 'finalburn neo', 'cps1', 'cps2', 'cps3', 'neogeo', 'neo geo', 'naomi', 'atomiswave'], ext: [], profiles: ['mame', 'retroarch'], hash: 'arcade'}),
 P('pce', 'TurboGrafx-16/PC Engine', 'PC Engine', 86, 8, 'NEC - PC Engine - TurboGrafx 16', {family: 'nec', aliases: ['pcengine', 'pc engine', 'tg16', 'tg 16', 'turbografx', 'turbografx 16', 'pce', 'supergrafx'], ext: ['pce', 'sgx'], profiles: ['mesen', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'NEC - PC Engine - TurboGrafx 16']], hash: 'pce'}),
 P('pcecd', 'Turbografx-16/PC Engine CD', 'PCE CD', 150, 76, 'NEC - PC Engine CD - TurboGrafx-CD', {family: 'nec', aliases: ['pcenginecd', 'pc engine cd', 'pce cd', 'pcecd', 'tgcd', 'tg cd', 'turbografx cd'], ext: [], profiles: ['bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['redump', 'NEC - PC Engine CD - TurboGrafx-CD']]}),
 P('pcfx', 'PC-FX', 'PC-FX', 274, 49, 'NEC - PC-FX', {family: 'nec', aliases: ['pcfx', 'pc fx'], ext: [], profiles: ['mednafen', 'retroarch']}),
 P('atari2600', 'Atari 2600', '2600', 59, 25, 'Atari - 2600', {family: 'atari', aliases: ['atari2600', 'atari 2600', '2600', 'a2600', 'vcs'], ext: ['a26'], profiles: ['stella', 'bizhawk', 'retroarch'], dat: [['no-intro', 'Atari - 2600']], hash: 'whole'}),
 P('atari7800', 'Atari 7800', '7800', 60, 51, 'Atari - 7800', {family: 'atari', aliases: ['atari7800', 'atari 7800', '7800', 'a7800'], ext: ['a78'], profiles: ['bizhawk', 'retroarch'], dat: [['no-intro', 'Atari - 7800']], hash: 'atari7800'}),
 P('lynx', 'Atari Lynx', 'Lynx', 61, 13, 'Atari - Lynx', {family: 'atari', aliases: ['lynx', 'atari lynx', 'atarilynx'], ext: ['lnx', 'lyx'], profiles: ['bizhawk', 'mednafen', 'retroarch'], dat: [['no-intro', 'Atari - Lynx']], hash: 'lynx'}),
 P('jaguar', 'Atari Jaguar', 'Jaguar', 62, 17, 'Atari - Jaguar', {family: 'atari', aliases: ['jaguar', 'atari jaguar', 'atarijaguar'], ext: ['j64', 'jag'], profiles: ['retroarch'], dat: [['no-intro', 'Atari - Jaguar']], hash: 'whole'}),
 P('ngp', 'Neo Geo Pocket', 'NGP', 119, 14, 'SNK - Neo Geo Pocket', {family: 'arcade', aliases: ['ngp', 'neo geo pocket', 'neogeo pocket', 'neogeopocket'], ext: ['ngp'], profiles: ['bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'SNK - Neo Geo Pocket']], hash: 'whole'}),
 P('ngpc', 'Neo Geo Pocket Color', 'NGPC', 120, 14, 'SNK - Neo Geo Pocket Color', {family: 'arcade', aliases: ['ngpc', 'neo geo pocket color', 'neogeo pocket color', 'neogeopocketcolor'], ext: ['ngc'], profiles: ['bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'SNK - Neo Geo Pocket Color']], hash: 'whole'}),
 P('neogeocd', 'Neo Geo CD', 'Neo Geo CD', 136, 56, 'SNK - Neo Geo CD', {family: 'arcade', aliases: ['neogeocd', 'neo geo cd', 'neogeo cd'], ext: [], profiles: ['retroarch']}),
 P('wonderswan', 'WonderSwan', 'WS', 57, 53, 'Bandai - WonderSwan', {family: 'other', aliases: ['wonderswan', 'ws', 'bandai wonderswan'], ext: ['ws'], profiles: ['mesen', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Bandai - WonderSwan']], hash: 'whole'}),
 P('wonderswancolor', 'WonderSwan Color', 'WSC', 123, 53, 'Bandai - WonderSwan Color', {family: 'other', aliases: ['wonderswancolor', 'wonderswan color', 'wsc'], ext: ['wsc', 'pc2'], profiles: ['mesen', 'bizhawk', 'ares', 'mednafen', 'retroarch'], dat: [['no-intro', 'Bandai - WonderSwan Color']], hash: 'whole'}),
 P('colecovision', 'ColecoVision', 'Coleco', 68, 44, 'Coleco - ColecoVision', {family: 'other', aliases: ['colecovision', 'coleco'], ext: ['col'], profiles: ['bizhawk', 'ares', 'retroarch'], dat: [['no-intro', 'Coleco - ColecoVision']], hash: 'whole'}),
 P('intellivision', 'Intellivision', 'Intellivision', 67, 45, 'Mattel - Intellivision', {family: 'other', aliases: ['intellivision', 'intv'], ext: ['int'], profiles: ['bizhawk', 'retroarch'], dat: [['no-intro', 'Mattel - Intellivision']], hash: 'whole'}),
 P('msx', 'MSX', 'MSX', 27, 29, 'Microsoft - MSX', {family: 'microsoft', aliases: ['msx', 'msx1', 'msx2', 'msx 2'], ext: ['mx1', 'mx2'], profiles: ['ares', 'retroarch'], dat: [['no-intro', 'Microsoft - MSX']], hash: 'whole'}),
 P('3do', '3DO Interactive Multiplayer', '3DO', 50, 43, 'The 3DO Company - 3DO', {family: 'other', aliases: ['3do', 'panasonic 3do'], ext: [], profiles: ['retroarch']}),
 P('dos', 'DOS', 'DOS', 13, null, 'DOS', {family: 'pc', aliases: ['dos', 'msdos', 'ms dos', 'dosbox', 'pc dos', 'exodos'], ext: [], profiles: ['dosbox', 'retroarch']}),
 P('linux', 'Linux', 'Linux', 3, null, null, {family: 'pc', aliases: [], ext: ['appimage'], profiles: ['pc']}),
 P('pc', 'PC (Microsoft Windows)', 'PC', 6, null, null, {family: 'pc', aliases: [], ext: ['exe'], profiles: ['pc']}),
];

export const BY_KEY = new Map(PLATFORMS.map(p => [p.key, p]));
const BY_NAME = new Map();
for (const p of PLATFORMS) for (const n of [p.name, ...(p.names || [])]) BY_NAME.set(n.toLowerCase(), p);

// Extensões que, sozinhas, não indicam a plataforma (formatos de disco e arquivos compactados).
export const AMBIGUOUS_EXT = new Set(['iso', 'bin', 'cue', 'chd', 'img', 'm3u', 'zip', '7z', 'cso', 'pbp', 'elf', 'mdf', 'ccd', 'rvz', 'wia', 'ciso', 'nkit', 'ecm', 'toc']);
export const DISC_EXT = new Set(['iso', 'bin', 'cue', 'chd', 'img', 'm3u', 'cso', 'pbp', 'gdi', 'cdi', 'mdf', 'ccd', 'rvz', 'wia', 'ciso', 'gcz', 'gcm', 'wbfs', 'nkit', 'toc']);

export function platformByKey(key) { return BY_KEY.get(String(key || '')) || null; }
export function platformByName(name) {
 if (!name) return null;
 const raw = String(name).trim(), hit = BY_NAME.get(raw.toLowerCase()) || BY_KEY.get(raw.toLowerCase());
 if (hit) return hit;
 const n = folderKey(raw);
 return PLATFORMS.find(p => p.aliases.includes(n) || folderKey(p.name) === n || folderKey(p.short) === n) || null;
}
export const platformName = key => platformByKey(key)?.name || 'Não informada';
export function samePlatform(a, b) { const x = platformByName(a), y = platformByName(b); return !!x && !!y && x.key === y.key; }
export function platformByIGDB(id) { return PLATFORMS.find(p => p.igdb === Number(id)) || null; }

// Normaliza nomes de pasta: "Sony - PlayStation 2" -> "sony playstation 2"; "ROMs PS2" -> "ps2".
const NOISE = /\b(?:roms?|isos?|games?|jogos?|juegos?|jeux|spiele|colecao|coleção|collection|library|biblioteca|images?|dumps?|full ?set|sets?|redump|no ?intro|tosec|usa|europe|japan|eur|jap|ntsc|pal|bios)\b/g;
export function folderKey(name) {
 return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_.\-()[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function folderCandidates(name) {
 const base = folderKey(name), stripped = base.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
 return [...new Set([base, stripped, base.replace(/^sony |^nintendo |^sega |^microsoft |^atari |^nec |^snk |^bandai /, ''), stripped.replace(/^sony |^nintendo |^sega |^microsoft |^atari |^nec |^snk |^bandai /, '')].filter(Boolean))];
}
// Aliases muito curtos só valem como nome exato da pasta, nunca dentro de frases.
export function platformFromFolderName(name) {
 for (const candidate of folderCandidates(name)) {
  const hit = PLATFORMS.find(p => p.aliases.includes(candidate) || folderKey(p.name) === candidate || folderKey(p.libretro || '') === candidate);
  if (hit) return hit;
 }
 return null;
}
// Procura a plataforma subindo pelas pastas do arquivo (até 4 níveis), como RomM e EmuDeck.
export function platformFromPath(file, {depth = 4, stopAt = []} = {}) {
 const stops = new Set(stopAt.map(s => path.resolve(s).toLowerCase()));
 let dir = path.dirname(path.resolve(file));
 for (let i = 0; i < depth; i++) {
  const name = path.basename(dir);
  if (!name || dir === path.parse(dir).root) break;
  const hit = platformFromFolderName(name);
  if (hit) return {platform: hit, folder: dir, level: i};
  if (stops.has(dir.toLowerCase())) break;
  dir = path.dirname(dir);
 }
 return null;
}
export function platformsForExtension(ext) {
 const e = String(ext || '').replace(/^\./, '').toLowerCase();
 return PLATFORMS.filter(p => p.ext.includes(e));
}
// Lista pública para a interface: rótulo curto e família para agrupar.
export function platformList() {
 return PLATFORMS.map(({key, name, short, family, igdb, ra, profiles}) => ({key, name, short, family, igdb, ra: ra || null, profiles}));
}
export const RA_CONSOLES = Object.fromEntries(PLATFORMS.filter(p => p.ra).map(p => [p.key, p.ra]));
