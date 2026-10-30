// Página dos jogos sem página na Steam (emuladores, ports): o que preenche a parte de baixo.
//  - Linha do tempo da sua atividade: conquistas desbloqueadas (por dia) e marcos (metade das conquistas, todas as
//    conquistas). Tudo com dados que o Taiga Launcher já tem no PC.
//  - Capturas de tela e jogos parecidos (mesma franquia primeiro) (IGDB, pelo servidor do Taiga), guardados por 30 dias. As imagens
//    são baixadas uma vez e servidas pelo próprio Taiga Launcher.
import fs from 'node:fs';
import path from 'node:path';
import {json, save} from './files.mjs';

// Data de uma conquista em segundos (aceita segundos, milissegundos ou texto de data).
export function unlockSeconds(value) {
 if (value === null || value === undefined || value === '') return 0;
 const n = Number(value);
 if (Number.isFinite(n) && n > 0) return Math.floor(n > 1e12 ? n / 1000 : n);
 const t = Date.parse(/^[\d-]+ [\d:]+$/.test(String(value)) ? String(value).replace(' ', 'T') + 'Z' : String(value));
 return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}
const dayKey = sec => { const d = new Date(sec * 1000); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); };

// Itens da linha do tempo, do mais novo para o mais antigo (no máximo 40).
export function buildActivity({achievements = [], iconUrl = u => u} = {}) {
 const out = [];
 const total = achievements.length;
 const unlocked = achievements.filter(a => a.unlocked).map(a => ({title: String(a.title || '').slice(0, 120), icon: iconUrl(a.icon || ''), at: unlockSeconds(a.date)})).filter(a => a.at > 0).sort((a, b) => a.at - b.at);
 // Conquistas por dia.
 const byDay = new Map();
 for (const a of unlocked) { const k = dayKey(a.at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(a); }
 let running = 0;
 for (const list of byDay.values()) {
  running += list.length;
  out.push({kind: 'achievements', at: list[list.length - 1].at, count: list.length, progress: running, total, items: list.slice(-8).reverse().map(a => ({title: a.title, icon: a.icon}))});
 }
 // Marcos (metade, todas) não entram na atividade: só os cartões das conquistas.
 return out.sort((a, b) => b.at - a.at).slice(0, 40);
}

const IMG = id => /^[a-z0-9]{4,40}$/.test(String(id || ''));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[™®©]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

const yearOf = sec => Number(sec) > 0 ? new Date(Number(sec) * 1000).getUTCFullYear() : null;
// Remasters, coletâneas e edições contam como o mesmo jogo (não aparecem como recomendação dele mesmo).
const EDITION = /\b(remaster(ed)?|hd|collection|definitive|edition|complete|goty|game of the year|deluxe|ultimate|special|anniversary|enhanced|directors? cut|reloaded|classic|origins collection|saga|trilogy|bundle|pack)\b/g;
const baseName = t => norm(t).replace(EDITION, ' ').replace(/\s+/g, ' ').trim();

// Escolhe até 4: jogos da franquia (os mais conhecidos, mais perto da época deste) e completa com parecidos.
export function pickSimilar({self, family = [], similar = [], max = 4}) {
 const selfBase = baseName(self.name), seen = new Set([selfBase]), out = [];
 const ok = x => x && x.name && !/\b(collection|trilogy|bundle|pack|compilation|double pack)\b/.test(norm(x.name)) && IMG(x.cover?.image_id) && Number(x.id) !== Number(self.id) && !x.version_parent && !x.parent_game;
 const add = (x, fam) => { const b = baseName(x.name); if (!b || seen.has(b) || out.length >= max) return; seen.add(b); out.push({...x, family: fam}); };
 const dist = x => { const y = yearOf(x.first_release_date); return self.year && y ? Math.abs(y - self.year) : 50; };
 const pop = x => Number(x.total_rating_count) || 0;
 const fam = family.filter(ok);
 const known = fam.slice().sort((a, b) => pop(b) - pop(a)).slice(0, 10).filter(x => pop(x) > 0 || fam.length <= 4);
 for (const x of (known.length ? known : fam).sort((a, b) => dist(a) - dist(b) || pop(b) - pop(a))) add(x, true);
 const plats = new Set(self.platforms || []);
 const sim = similar.filter(ok).map(x => ({x, same: (x.platforms || []).some(p => plats.has(p)) ? 1 : 0}));
 for (const {x} of sim.sort((a, b) => b.same - a.same || dist(a.x) - dist(b.x) || pop(b.x) - pop(a.x))) add(x, false);
 return out;
}

// Capturas e jogos parecidos do IGDB. ig(query) consulta o IGDB; image(url) baixa e devolve o nome do arquivo.
export function createGameExtras({cacheDir, ig, igAvailable = () => true, image, log = () => {}}) {
 const pending = new Map(), misses = new Map();
 const file = id => path.join(cacheDir, 'igdb-extra2-' + id + '.json');
 async function resolveId(g, {title, platformIgdb = 0}) {
  const known = Number(g.igdbId) || 0; if (known) return known;
  const names = [...new Set([title, g.title, g.storeTitleEn, g.wikiEnTitle].filter(Boolean))];
  for (const name of names) {
   const found = await ig(`search ${JSON.stringify(String(name).slice(0, 120))}; fields id,name,platforms,alternative_names.name; limit 10;`);
   const exact = (found || []).filter(x => [x.name, ...(x.alternative_names || []).map(a => a.name)].some(n => norm(n) === norm(name)));
   const onPlatform = platformIgdb ? exact.filter(x => (x.platforms || []).includes(platformIgdb)) : [];
   const pick = onPlatform.length === 1 ? onPlatform[0] : exact.length === 1 ? exact[0] : null;
   if (pick) return Number(pick.id);
  }
  return 0;
 }
 async function load(g, opts) {
  const id = await resolveId(g, opts); if (!id) return {id: 0, videos: [], shots: [], similar: [], at: Date.now()};
  const hit = json(file(id), null); if (hit && Date.now() - hit.at < 30 * 86400000) return hit;
  const sub = 'name,cover.image_id,first_release_date,platforms,version_parent,parent_game,total_rating_count';
  const row = (await ig(`fields name,first_release_date,platforms,collections,franchises,franchise,screenshots.image_id,artworks.image_id,${sub.split(',').map(f => 'similar_games.' + f).join(',')}; where id = ${id};`))?.[0] || {};
  const save1 = async (url) => { try { return await image(url); } catch { return ''; } };
  const shots = [];
  for (const s of [...(row.screenshots || []), ...(row.artworks || [])].filter(s => IMG(s.image_id)).slice(0, 3)) { const f = await save1('https://images.igdb.com/igdb/image/upload/t_screenshot_big/' + s.image_id + '.jpg'); if (f) shots.push(f); }
  // Mesma franquia/série primeiro; depois os parecidos do IGDB, preferindo os da mesma época e plataforma.
  const ids = list => [...new Set((list || []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 6);
  const coll = ids(row.collections), fran = ids([...(row.franchises || []), row.franchise].filter(Boolean));
  const where = [coll.length ? `collections = (${coll.join(',')})` : '', fran.length ? `franchises = (${fran.join(',')})` : ''].filter(Boolean).join(' | ');
  let family = [];
  if (where) { try { family = await ig(`fields ${sub}; where (${where}) & id != ${id} & cover != null & version_parent = null & parent_game = null; limit 50;`) || []; } catch (e) { log('Página do jogo (IGDB, franquia): ' + e.message); } }
  const picked = pickSimilar({self: {id, name: row.name || opts.title || g.title, year: yearOf(row.first_release_date), platforms: row.platforms || []}, family, similar: row.similar_games || []});
  const similar = [];
  for (const s of picked) { const cover = await save1('https://images.igdb.com/igdb/image/upload/t_cover_big/' + s.cover.image_id + '.jpg'); if (cover) similar.push({name: String(s.name).slice(0, 80), cover, year: yearOf(s.first_release_date), family: !!s.family}); }
  const out = {id, videos: [], shots, similar, at: Date.now()};
  try { fs.mkdirSync(cacheDir, {recursive: true}); save(file(id), out); } catch {}
  return out;
 }
 return {
  // Responde na hora com o que já tem; o que falta é buscado em segundo plano (pending = pedir de novo daqui a pouco).
  get(g, opts) {
   const key = g.uuid || g.id;
   const id = Number(g.igdbId) || 0, hit = id ? json(file(id), null) : null;
   if (hit && Date.now() - hit.at < 30 * 86400000) return {...hit, pending: false};
   if (!igAvailable() || Date.now() - (misses.get(key) || 0) < 86400000) return {videos: [], shots: [], similar: [], pending: false};
   if (!pending.has(key)) {
    const job = load(g, opts).then(r => { if (!r.id) misses.set(key, Date.now()); if (r.id && !g.igdbId) { g.igdbId = r.id; try { opts.onResolved?.(g); } catch {} } return r; }).catch(e => { misses.set(key, Date.now() - 86400000 + 600000); log('Página do jogo (IGDB): ' + e.message); return null; });
    pending.set(key, job); job.finally(() => setTimeout(() => pending.delete(key), 60000));
   }
   return {videos: [], shots: [], similar: [], pending: true};
  },
  async wait(g, opts, ms = 4000) { this.get(g, opts); const job = pending.get(g.uuid || g.id); if (job) await Promise.race([job, new Promise(r => setTimeout(r, ms))]); return this.get(g, opts); },
 };
}
