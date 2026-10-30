// Desbloqueios do RetroAchievements no instante em que acontecem, lidos do arquivo de log do emulador
// (técnica estudada no Steam Achievement Notifier; implementação própria). O emulador registra "Game N loaded",
// "Awarding achievement N" e "Unloading game N"; o Taiga Launcher só lê o final do arquivo.
// Requer o log em arquivo ligado no emulador; sem log, o progresso continua vindo da conta (a cada poucos segundos).
import fs from 'node:fs';
import path from 'node:path';

export const RA_PATTERNS = {
 start: /Game (\d+) loaded, Hardcore (enabled|disabled)/i,
 identified: /Identified game: (\d+)/i,
 stop: /Unloading game (\d+)/i,
 award: /Awarding achievement (\d+)/i,
};

export function parseRALines(text, state = {gameId: null}) {
 const events = [];
 for (const line of String(text).split(/\r?\n/)) {
  let m;
  if ((m = line.match(RA_PATTERNS.start)) || (m = line.match(RA_PATTERNS.identified))) { state.gameId = Number(m[1]); events.push({type: 'start', gameId: state.gameId, hardcore: m[2] ? m[2].toLowerCase() === 'enabled' : null}); }
  else if ((m = line.match(RA_PATTERNS.stop))) { events.push({type: 'stop', gameId: Number(m[1])}); state.gameId = null; }
  else if ((m = line.match(RA_PATTERNS.award))) events.push({type: 'award', gameId: state.gameId, achievementId: Number(m[1])});
 }
 return events;
}

// Arquivos de log conhecidos dos emuladores com RetroAchievements.
export function raLogCandidates(config = {}, env = process.env) {
 const home=env.HOME||env.USERPROFILE||'',xdg=env.XDG_CONFIG_HOME||path.join(home,'.config'),data=env.XDG_DATA_HOME||path.join(home,'.local/share'),flat=path.join(home,'.var/app');
 const docs = home ? path.join(home, 'Documents') : '', out = [];
 for(const base of [path.join(xdg,'retroarch'),path.join(flat,'org.libretro.RetroArch/config/retroarch')])out.push(path.join(base,'logs/retroarch.log'));
 for(const base of [path.join(data,'dolphin-emu'),path.join(flat,'org.DolphinEmu.dolphin-emu/data/dolphin-emu')])out.push(path.join(base,'Logs/dolphin.log'));
 for(const base of [path.join(xdg,'PCSX2'),path.join(flat,'net.pcsx2.PCSX2/config/PCSX2')])out.push(path.join(base,'logs/emulog.txt'));
 const add = (...p) => { if (p.every(Boolean)) out.push(path.join(...p)); };
 const exe = key => config.launchers?.[key]?.exe ? path.dirname(config.launchers[key].exe) : '';
 add(exe('retroarch'), 'logs', 'retroarch.log'); add(env.APPDATA, 'RetroArch', 'logs', 'retroarch.log'); add('C:\\RetroArch-Win64', 'logs', 'retroarch.log');
 add(docs, 'PCSX2', 'logs', 'emulog.txt'); add(exe('ps2'), 'logs', 'emulog.txt');
 add(exe('psp') || (config.emulator ? path.dirname(config.emulator) : ''), 'memstick', 'PSP', 'SYSTEM', 'log.txt'); add(exe('psp') || (config.emulator ? path.dirname(config.emulator) : ''), 'log.txt'); add(docs, 'PPSSPP', 'PSP', 'SYSTEM', 'log.txt');
 add(env.APPDATA, 'Dolphin Emulator', 'Logs', 'dolphin.log'); add(docs, 'Dolphin Emulator', 'Logs', 'dolphin.log'); add(exe('dolphin'), 'User', 'Logs', 'dolphin.log');
 add(exe('ps1'), 'RACache', 'RALog.txt'); add(docs, 'DuckStation', 'RACache', 'RALog.txt');
 return [...new Set(out)];
}

export class RALogWatcher {
 constructor({files, onEvent, interval = 2000}) { Object.assign(this, {files, onEvent, interval}); this.offsets = new Map(); this.states = new Map(); this.timer = null; }
 start() { if (this.timer) return; this.poll(true); this.timer = setInterval(() => this.poll(false), this.interval); this.timer.unref?.(); }
 stop() { clearInterval(this.timer); this.timer = null; }
 poll(initial) {
  for (const file of this.files()) {
   let st; try { st = fs.statSync(file); } catch { continue; }
   if (!st.isFile()) continue;
   const known = this.offsets.get(file);
   // Na primeira leitura só aprende o jogo atual, sem repetir desbloqueios antigos.
   if (known === undefined || st.size < known) {
    this.offsets.set(file, st.size);
    if (initial || known !== undefined) try { const start = Math.max(0, st.size - 256 * 1024), text = read(file, start, st.size - start), state = {gameId: null}; parseRALines(text, state); this.states.set(file, state); } catch {}
    continue;
   }
   if (st.size === known) continue;
   const from = Math.max(known, st.size - 1024 * 1024);
   let text = ''; try { text = read(file, from, st.size - from); } catch { continue; }
   this.offsets.set(file, st.size);
   const state = this.states.get(file) || {gameId: null}; this.states.set(file, state);
   for (const event of parseRALines(text, state)) try { this.onEvent({...event, file}); } catch {}
  }
 }
}
function read(file, start, length) { const fd = fs.openSync(file, 'r'); try { const b = Buffer.alloc(length); fs.readSync(fd, b, 0, length, start); return b.toString('utf8'); } finally { fs.closeSync(fd); } }
