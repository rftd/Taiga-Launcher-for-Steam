// Contas RetroAchievements já conectadas nos emuladores.
// Quem joga com conquistas normalmente já entrou no RA pelo próprio emulador;
// o Taiga Launcher reaproveita esse acesso (somente leitura) para mostrar o progresso,
// sem pedir login de novo. O token nunca é exibido nem enviado a outro serviço.
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = /^[A-Za-z0-9]{12,64}$/;
const isFile = f => { try { return fs.statSync(f).isFile() && fs.statSync(f).size < 4 * 1024 * 1024; } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };

export function parseIni(text) {
 const out = {}; let section = '';
 for (const line of String(text || '').replace(/^﻿/, '').split(/\r?\n/)) {
  const s = line.match(/^\s*\[([^\]]+)\]\s*$/);
  if (s) { section = s[1].trim().toLowerCase(); out[section] ||= {}; continue; }
  const kv = line.match(/^\s*([^=;#]+?)\s*=\s*(.*?)\s*$/);
  if (kv) { out[section] ||= {}; out[section][kv[1].trim().toLowerCase()] = kv[2].replace(/^"(.*)"$/, '$1'); }
 }
 return out;
}
// retroarch.cfg: chave = "valor"
export function parseCfg(text) {
 const out = {};
 for (const line of String(text || '').split(/\r?\n/)) { const m = line.match(/^\s*([\w.-]+)\s*=\s*"?(.*?)"?\s*$/); if (m) out[m[1].toLowerCase()] = m[2]; }
 return out;
}
const read = f => isFile(f) ? fs.readFileSync(f, 'utf8') : null;
const exeDir = (config, profile) => { const exe = config.launchers?.[profile]?.exe || (profile === 'psp' ? config.emulator : ''); return exe ? path.dirname(exe) : null; };

// Locais padrão e portáteis de cada emulador (Windows; Linux/macOS para testes e Proton).
export function accountSources(config = {}, env = process.env) {
 const home = env.USERPROFILE || env.HOME || '', appdata = env.APPDATA || (home && path.join(home, 'AppData', 'Roaming')), local = env.LOCALAPPDATA || (home && path.join(home, 'AppData', 'Local')), docs = home && path.join(home, 'Documents');
 const list = [];
 const xdg=env.XDG_CONFIG_HOME||path.join(home,'.config'),data=env.XDG_DATA_HOME||path.join(home,'.local/share'),flat=path.join(home,'.var/app');
 const add = (emulator, kind, file, extra = {}) => { if (file) list.push({emulator, kind, file, ...extra}); };
 const ra = exeDir(config, 'retroarch');
 add('RetroArch', 'retroarch', ra && path.join(ra, 'retroarch.cfg'));
 add('RetroArch', 'retroarch', appdata && path.join(appdata, 'RetroArch', 'retroarch.cfg'));
 for(const base of [path.join(xdg,'retroarch'),path.join(flat,'org.libretro.RetroArch/config/retroarch')])add('RetroArch','retroarch',path.join(base,'retroarch.cfg'));
 const ps2 = exeDir(config, 'ps2');
 add('PCSX2', 'pcsx2', ps2 && path.join(ps2, 'inis', 'PCSX2.ini'));
 add('PCSX2', 'pcsx2', docs && path.join(docs, 'PCSX2', 'inis', 'PCSX2.ini'));
 add('PCSX2', 'pcsx2', appdata && path.join(appdata, 'PCSX2', 'inis', 'PCSX2.ini'));
 const ps1 = exeDir(config, 'ps1');
 add('DuckStation', 'duckstation', ps1 && path.join(ps1, 'settings.ini'));
 add('DuckStation', 'duckstation', docs && path.join(docs, 'DuckStation', 'settings.ini'));
 add('DuckStation', 'duckstation', local && path.join(local, 'DuckStation', 'settings.ini'));
 const psp = exeDir(config, 'psp');
 for (const base of [psp && path.join(psp, 'memstick', 'PSP', 'SYSTEM'), psp && path.join(psp, 'PSP', 'SYSTEM'), docs && path.join(docs, 'PPSSPP', 'PSP', 'SYSTEM')]) add('PPSSPP', 'ppsspp', base && path.join(base, 'ppsspp.ini'), {tokenFile: base && path.join(base, 'ppsspp_retroachievements.dat')});
 const dolphin = exeDir(config, 'dolphin');
 add('Dolphin', 'dolphin', dolphin && path.join(dolphin, 'User', 'Config', 'RetroAchievements.ini'));
 add('Dolphin', 'dolphin', docs && path.join(docs, 'Dolphin Emulator', 'Config', 'RetroAchievements.ini'));
 add('Dolphin', 'dolphin', appdata && path.join(appdata, 'Dolphin Emulator', 'Config', 'RetroAchievements.ini'));
 for(const base of [path.join(xdg,'dolphin-emu'),path.join(data,'dolphin-emu/Config'),path.join(home,'.dolphin-emu/Config'),path.join(flat,'org.DolphinEmu.dolphin-emu/config/dolphin-emu'),path.join(flat,'org.DolphinEmu.dolphin-emu/data/dolphin-emu/Config')])add('Dolphin','dolphin',path.join(base,'RetroAchievements.ini'));
 const fly = exeDir(config, 'flycast');
 add('Flycast', 'flycast', fly && path.join(fly, 'emu.cfg'));
 add('Flycast', 'flycast', appdata && path.join(appdata, 'flycast', 'emu.cfg'));
 const hawk = exeDir(config, 'bizhawk');
 add('BizHawk', 'bizhawk', hawk && path.join(hawk, 'config.ini'));
 return list;
}
// Lê usuário/token de um arquivo; ignora tokens criptografados ou ausentes.
export function readAccount(source) {
 const text = read(source.file);
 if (text === null) return null;
 let user = '', token = '';
 if (source.kind === 'bizhawk') { let j = null; try { j = JSON.parse(text); } catch {} user = j?.RAUsername; token = j?.RAToken; }
 else if (source.kind === 'retroarch') { const c = parseCfg(text); if (c.cheevos_enable === 'false') return null; user = c.cheevos_username; token = c.cheevos_token; }
 else {
  const ini = parseIni(text);
  if (source.kind === 'pcsx2') { user = ini.achievements?.username; token = ini.achievements?.token; }
  if (source.kind === 'duckstation') { user = ini.cheevos?.username; token = ini.cheevos?.token; }
  if (source.kind === 'dolphin') { user = ini.achievements?.username; token = ini.achievements?.apitoken; }
  if (source.kind === 'flycast') { user = ini.achievements?.username; token = ini.achievements?.token; }
  if (source.kind === 'ppsspp') { user = ini.achievements?.achievementsusername; const t = source.tokenFile && read(source.tokenFile); token = t ? t.trim() : ''; }
 }
 user = String(user || '').trim(); token = String(token || '').trim();
 if (!/^[A-Za-z0-9_.-]{2,32}$/.test(user) || !TOKEN.test(token)) return null;
 return {emulator: source.emulator, user, token, file: source.file};
}
export function emulatorAccounts(config = {}, env = process.env) {
 const seen = new Set(), out = [];
 for (const source of accountSources(config, env)) {
  let account = null;
  try { account = readAccount(source); } catch {}
  if (!account) continue;
  const key = account.user.toLowerCase() + ':' + account.token;
  if (seen.has(key)) { out.find(a => a.user.toLowerCase() + ':' + a.token === key).emulators.push(account.emulator); continue; }
  seen.add(key); out.push({...account, emulators: [account.emulator]});
 }
 // Tokens mais recentes primeiro (arquivo modificado por último).
 return out.sort((a, b) => { try { return fs.statSync(b.file).mtimeMs - fs.statSync(a.file).mtimeMs; } catch { return 0; } });
}
// Versão pública (sem token) para a interface.
export const publicAccounts = list => list.map(({emulator, emulators, user, file}) => ({emulator, emulators, user, folder: path.dirname(file)}));
export {isDir};
