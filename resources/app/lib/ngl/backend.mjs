// Backend do NativeGameLink for Steam (MIT, David Miranda) portado para o Taiga Launcher.
// O frontend original do NGL roda dentro da Steam e chama estas funções pelos mesmos nomes que usava no
// Millennium (callables). Aqui elas usam os dados do Taiga Launcher: jogos com AppID da Steam usam o AppID real;
// jogos de emulador recebem um AppID virtual e a página é montada com os metadados, as artes, as
// conquistas (RetroAchievements/locais) e o tempo de jogo do Taiga Launcher.
// Não foram portados: simulação de conquistas, sincronização de conquistas com a conta Steam e "card farming".
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {httpGet, decodeRequest, safeLanguage, readJson, writeJsonAtomic, TtlCache, trim, steamLanguageFor} from './core.mjs';
import {createSteamWeb, isVirtualAppId, VIRTUAL_MIN, VIRTUAL_MAX} from './steam-web.mjs';
import {parseVDF, shortcutInfo, value as vdfValue} from '../vdf.mjs';
import {detectLanguage} from '../translation.mjs';

export {isVirtualAppId};
// Gêneros do IGDB (em inglês) no idioma do programa.
const GENRES = {
 'Point-and-click': ['Apontar e clicar', 'Apuntar y hacer clic', 'Pointer-cliquer', 'Point-and-Click'], 'Fighting': ['Luta', 'Lucha', 'Combat', 'Kampfspiel'], 'Shooter': ['Tiro', 'Disparos', 'Tir', 'Shooter'],
 'Music': ['Música', 'Música', 'Musique', 'Musik'], 'Platform': ['Plataforma', 'Plataformas', 'Plateforme', 'Plattformer'], 'Puzzle': ['Quebra-cabeça', 'Puzles', 'Réflexion', 'Rätsel'], 'Racing': ['Corrida', 'Carreras', 'Course', 'Rennspiel'],
 'Real Time Strategy (RTS)': ['Estratégia em tempo real', 'Estrategia en tiempo real', 'Stratégie en temps réel', 'Echtzeitstrategie'], 'Role-playing (RPG)': ['RPG', 'Rol (RPG)', 'Jeu de rôle', 'Rollenspiel'],
 'Simulator': ['Simulação', 'Simulación', 'Simulation', 'Simulation'], 'Sport': ['Esporte', 'Deportes', 'Sport', 'Sport'], 'Strategy': ['Estratégia', 'Estrategia', 'Stratégie', 'Strategie'],
 'Turn-based strategy (TBS)': ['Estratégia por turnos', 'Estrategia por turnos', 'Stratégie au tour par tour', 'Rundenstrategie'], 'Tactical': ['Tático', 'Táctico', 'Tactique', 'Taktik'],
 "Hack and slash/Beat 'em up": ['Hack and slash', 'Hack and slash', 'Beat them all', 'Hack and Slash'], 'Quiz/Trivia': ['Perguntas e respostas', 'Preguntas', 'Quiz', 'Quiz'], 'Pinball': ['Pinball', 'Pinball', 'Flipper', 'Flipper'],
 'Adventure': ['Aventura', 'Aventura', 'Aventure', 'Abenteuer'], 'Indie': ['Indie', 'Indie', 'Indépendant', 'Indie'], 'Arcade': ['Arcade', 'Arcade', 'Arcade', 'Arcade'], 'Visual Novel': ['Romance visual', 'Novela visual', 'Visual novel', 'Visual Novel'],
 'Card & Board Game': ['Cartas e tabuleiro', 'Cartas y tablero', 'Cartes et plateau', 'Karten- und Brettspiel'], 'MOBA': ['MOBA', 'MOBA', 'MOBA', 'MOBA'], 'Action': ['Ação', 'Acción', 'Action', 'Action'],
};
const genreName = (name, lang) => { const i = {'pt-BR': 0, es: 1, fr: 2, de: 3}[lang]; const row = GENRES[String(name)]; return i === undefined || !row ? String(name) : row[i]; };
// Resumo curto sem cortar no meio da frase.
const clipSentence = (text, max) => { text = String(text || ''); if (text.length <= max) return text; const cut = text.slice(0, max), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? ')); return end > max * 0.4 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…'; };
// Guardado em memória: é chamado para cada jogo em vários pedidos da página da Steam.
const vidCache = new Map();
export const virtualAppIdFor = uuid => { const k = String(uuid); let v = vidCache.get(k); if (v === undefined) { v = VIRTUAL_MIN + (parseInt(createHash('sha1').update(k).digest('hex').slice(0, 8), 16) % (VIRTUAL_MAX - VIRTUAL_MIN)); if (vidCache.size > 20000) vidCache.clear(); vidCache.set(k, v); } return v; };
const UNSUPPORTED = JSON.stringify({ok: false, error: 'unsupported_in_taigasteam'});
const imageMime = b => b && b.length > 100 ? (b[0] === 137 && b.toString('latin1', 1, 4) === 'PNG' ? 'image/png' : b[0] === 255 && b[1] === 216 ? 'image/jpeg' : b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : null) : null;
const trustedImageHost = url => /^https:\/\/([a-z0-9-]+\.)*(steamgriddb\.com|steamstatic\.com|steampowered\.com)(\/|$)/i.test(String(url || ''));
const unsignedId = v => { const n = Number(v); return Number.isFinite(n) ? (n < 0 ? n + 4294967296 : n) >>> 0 : null; };

// Recursos sempre mostrados nos jogos de emulador (mesmos IDs de categoria da Loja; 9901 é o "Salvamento local"
// do Taiga Launcher, desenhado pelo frontend com ícone próprio). Textos no idioma pedido pela Steam.
const VIRTUAL_FEATURES = [
 [2, {english: 'Single-player', brazilian: 'Um jogador', portuguese: 'Um jogador', spanish: 'Un jugador', latam: 'Un jugador', french: 'Solo', german: 'Einzelspieler', italian: 'Giocatore singolo'}],
 [22, {english: 'Achievements', brazilian: 'Conquistas', portuguese: 'Conquistas', spanish: 'Logros', latam: 'Logros', french: 'Succès', german: 'Errungenschaften', italian: 'Obiettivi'}],
 [9901, {english: 'Local saves', brazilian: 'Salvamento local', portuguese: 'Gravação local', spanish: 'Guardado local', latam: 'Guardado local', french: 'Sauvegardes locales', german: 'Lokale Speicherstände', italian: 'Salvataggi locali'}],
 [28, {english: 'Full controller support', brazilian: 'Compatibilidade total com controle', portuguese: 'Compatibilidade total com comando', spanish: 'Compatibilidad total con control', latam: 'Compatibilidad total con control', french: 'Compatibilité complète avec les manettes', german: 'Volle Controllerunterstützung', italian: 'Supporto completo per i controller'}],
];
export const VIRTUAL_CATEGORY_IDS = VIRTUAL_FEATURES.map(([id]) => id);

export function createNglBackend(host) {
 // host: {dataDir, config(), games(), shortcutGame(id), virtualGame(vid), steamAppIdOf(g), linkGame(g,appId), unlinkGame(g),
 //        achievements(g,{live}), playtime(g), artUrl(name), searchStore(term), executableTitle(file), steamAppIdEvidence(dir), log(msg)}
 const dir = path.join(host.dataDir, 'ngl');
 const file = name => path.join(dir, name);
 const log = msg => { try { host.log?.(msg); } catch {} };
 const language = () => host.config().language || 'pt-BR';
 const steamDir = () => host.config().steamDir || '';
 const account = () => String(host.config().account || '');
 const gridDir = () => path.join(steamDir(), 'userdata', account(), 'config', 'grid');

 // ── AppIDs virtuais (jogos sem AppID da Steam) ──
 const virtual = {
  async gameData(vid, steamLang) {
   let g = host.virtualGame(vid); if (!g) return null;
   // Descrição ainda em outro idioma (a tradução falhou ou não rodou na importação): traduz agora, com prazo curto.
   if (g.metadata?.summary && (detectLanguage(g.metadata.summary) || g.metadata.summaryLanguage || language()) !== language() && host.localizeGame) { try { await Promise.race([host.localizeGame(vid), new Promise(r => setTimeout(r, 6000))]); g = host.virtualGame(vid) || g; } catch {} }
   const m = g.metadata || {}, art = g.art || {}, lang = language();
   const virtualCategories = () => VIRTUAL_FEATURES.map(([id, labels]) => ({id, description: labels[steamLang] || labels[{'pt-BR': 'brazilian', es: 'latam', fr: 'french', de: 'german'}[lang]] || labels.english}));
   const date = m.release ? new Date(m.release + 'T12:00:00Z') : null;
   const releaseText = date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat(lang, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date) : '';
   const ach = host.cachedAchievements?.(g);
   const media = (g.media || []).map((name, i) => ({id: i + 1, path_thumbnail: host.artUrl(name), path_full: host.artUrl(name)}));
   const header = host.artUrl(art.wide || art.hero || art.cover), summary = String(m.summary || '').trim();
   return {
    type: 'game', name: g.title, steam_appid: vid, header_image: header, capsule_image: host.artUrl(art.cover || art.wide), capsule_imagev5: host.artUrl(art.cover || art.wide),
    background: host.artUrl(art.hero), background_raw: host.artUrl(art.hero),
    short_description: clipSentence(summary, 300), detailed_description: summary.replace(/\n/g, '<br>'), about_the_game: summary.replace(/\n/g, '<br>'),
    developers: String(m.developer || '').split(/\s*,\s*/).filter(Boolean), publishers: String(m.publisher || '').split(/\s*,\s*/).filter(Boolean),
    franchises: m.series ? [m.series] : [], genres: (m.genres || []).map((d, i) => ({id: String(i + 1), description: genreName(d, lang)})),
    release_date: {coming_soon: false, date: releaseText}, categories: virtualCategories(lang), controller_support: 'full',
    screenshots: media, movies: [], platforms: {windows: true, mac: false, linux: false}, website: m.url || '',
    achievements: {total: ach?.total || 0, highlighted: []},
    metadata_sources: {identity: 'steam_store_api', artwork: 'steam_store_api'},
    taigasteam: {virtual: true, platform: g.platformName || '', emulator: g.emulatorName || '', serial: g.serial || '', region: g.region || []},
   };
  },
  async news() { return []; },
 };
 const web = createSteamWeb({virtual, log});

 // ── mappings.lua ──
 const readMappings = () => readJson(file('mappings.json'), null) || readJson(file('mappings.backup.json'), {}) || {};
 const writeMappings = data => writeJsonAtomic(file('mappings.json'), data) && (writeJsonAtomic(file('mappings.backup.json'), data), true);
 const shortcutKey = id => 'shortcut:' + unsignedId(id);
 // Todo jogo do Taiga Launcher na Steam tem página: AppID real da Steam quando houver; senão, AppID virtual (também jogos de PC).
 const ownMappings = () => { const out = {}; for (const g of host.games()) { const sid = g.bindings?.[account()]; if (!sid || g.nglDismissed) continue; const appId = host.steamAppIdOf(g) || virtualAppIdFor(g.uuid || g.id); if (appId) out[shortcutKey(sid)] = String(appId); } return out; };
 const allMappings = () => ({...readMappings(), ...ownMappings()});
 const ourGameForKey = key => { const m = String(key || '').match(/^shortcut:(-?\d+)$/); return m ? host.shortcutGame(unsignedId(m[1])) : null; };
 function setMapping(key, steamId) {
  const g = ourGameForKey(key);
  if (g) { if (isVirtualAppId(steamId)) { g.nglDismissed = false; host.save?.(); } else host.linkGame(g, Number(steamId)); return true; }
  const data = readMappings(); data[String(key)] = String(steamId); return writeMappings(data);
 }
 // Atalho que a Steam ainda não gravou em disco (adicionado ao vivo) não é "órfão": a limpeza automática do NGL
 // (lista de atalhos do shortcuts.vdf) não pode desligar a página de um jogo do Taiga Launcher. Só um pedido explícito desliga.
 function removeMapping(key, {sweep = false} = {}) {
  const g = ourGameForKey(key);
  // 2.2.3: a limpeza automática nunca desliga um jogo do Taiga Launcher (ela chegou a apagar a ligação de jogos de
  // loja com a Steam, que voltavam para a página simples). Só o pedido explícito (remove_mapping) desliga.
  if (g) { if (sweep) { log('Remoção automática ignorada para jogo do Taiga Launcher: ' + g.title); return true; } host.unlinkGame(g); return true; }
  const data = readMappings(); delete data[String(key)]; return writeMappings(data);
 }

 // ── shortcut_registry.lua / get_shortcut_details ──
 function diskShortcutIds() { try { const f = path.join(steamDir(), 'userdata', account(), 'config', 'shortcuts.vdf'); return new Set(fs.existsSync(f) ? shortcutInfo(parseVDF(fs.readFileSync(f))).map(s => s.appId >>> 0) : []); } catch { return new Set(); } }
 // Atalhos do shortcuts.vdf mais os jogos do Taiga Launcher já adicionados ao vivo (a Steam só grava o arquivo depois).
 // Lista de atalhos (disco + jogos do Taiga): a mesma enquanto o shortcuts.vdf e o cadastro não mudarem. Antes o arquivo
 // era lido e interpretado de novo a cada pedido da Steam.
 let shortcutsMemo = null;
 function shortcutsListCached() {
  let st = null; try { st = fs.statSync(path.join(steamDir(), 'userdata', account(), 'config', 'shortcuts.vdf')); } catch {}
  const games = host.games();
  const key = [steamDir(), account(), st ? st.mtimeMs + ':' + st.size : '-', host.dataVersion?.() ?? '', games.length].join('|');
  if (shortcutsMemo?.key === key) return shortcutsMemo.value;
  const value = shortcutsList(); shortcutsMemo = {key, value}; return value;
 }
 function shortcutsList() {
  const disk = diskShortcutsList(), have = new Set(disk.map(s => Number(s.shortcut_app_id)));
  for (const g of host.games()) { const sid = unsignedId(g.bindings?.[account()]); if (!sid || sid < 2147483648 || have.has(sid)) continue; have.add(sid); disk.push({shortcut_app_id: String(sid), title: String(g.title || '').trim(), exe_path: String(g.path || ''), start_dir: path.win32.dirname(String(g.path || '')), launch_options: '', source: 'taigasteam', account_id: account()}); }
  return disk.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
 }
 function diskShortcutsList() {
  try { const f = path.join(steamDir(), 'userdata', account(), 'config', 'shortcuts.vdf'); if (!fs.existsSync(f) || fs.statSync(f).size > 8 * 1024 * 1024) return []; return shortcutInfo(parseVDF(fs.readFileSync(f))).filter(s => s.appId >= 2147483648 && s.title).map(s => ({shortcut_app_id: String(s.appId), title: s.title.trim(), exe_path: s.exe.replace(/^"(.*)"$/, '$1'), start_dir: String(vdfValue(s.node.value, 'StartDir') || '').replace(/^"(.*)"$/, '$1'), launch_options: s.options.trim(), source: 'shortcuts_vdf', account_id: account()})).sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())); } catch { return []; }
 }
 const normalizeTitle = t => String(t || '').toLowerCase().replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

 // ── detecção do AppID da Steam para um atalho (porte simplificado de shortcut_detection.lua) ──
 const appdetailsCache = new TtlCache(96), detectCache = new TtlCache(128);
 async function appdetails(appid, lang = 'english') { const key = appid + '|' + lang, hit = appdetailsCache.get(key, 1800); if (hit) return hit; const r = await httpGet('https://store.steampowered.com/api/appdetails?appids=' + appid + '&l=' + lang, {headers: {Accept: 'application/json'}, timeout: 4}); let d = null; try { const b = JSON.parse(r?.body || ''); if (b?.[appid]?.success) d = b[appid].data; } catch {} if (d) appdetailsCache.set(key, d); return d; }
 function evidenceAppId(exe, startDir, options) {
  const fromArgs = String(options || '').match(/steam:\/\/rungameid\/(\d+)/)?.[1] || String(options || '').match(/[-/]app_?id[\s=]+(\d+)/i)?.[1];
  if (fromArgs) return {appid: fromArgs, source: 'launch_argument'};
  let d = startDir || (exe ? path.win32.dirname(exe) : '');
  for (let i = 0; i < 4 && d; i++) { try { const e = host.steamAppIdEvidence(d); if (e) return {appid: String(e.appId), source: 'steam_appid_file'}; } catch {} const p = path.win32.dirname(d); if (p === d) break; d = p; }
  const m = String(exe || '').match(/^(.*\\steamapps\\)common\\([^\\]+)/i);
  if (m) { try { for (const n of fs.readdirSync(m[1])) { const id = n.match(/^appmanifest_(\d+)\.acf$/)?.[1]; if (!id) continue; const t = fs.readFileSync(path.join(m[1], n), 'utf8'); if (t.match(/"installdir"\s*"([^"]+)"/)?.[1]?.toLowerCase() === m[2].toLowerCase()) return {appid: t.match(/"appid"\s*"(\d+)"/)?.[1] || id, source: 'steam_appmanifest'}; } } catch {} }
  return null;
 }
 async function detect(req) {
  const title = trim(req.title).slice(0, 240); let exe = trim(req.exe_path).replace(/^"(.*)"$/, '$1'), start = trim(req.start_dir).replace(/^"(.*)"$/, '$1'), options = trim(req.launch_options);
  const sid = unsignedId(req.shortcut_app_id);
  if ((!exe || !start) && (sid || title)) { const s = shortcutsListCached().find(x => (sid && Number(x.shortcut_app_id) === sid) || normalizeTitle(x.title) === normalizeTitle(title)); if (s) { exe ||= s.exe_path; start ||= s.start_dir; options ||= s.launch_options; } }
  const lang = safeLanguage(req.language || 'english'), base = path.win32.basename(exe), stem = base.replace(/\.[^.]+$/, '');
  const launcher = /launcher|bootstrapper|start protected game/i.test(stem), generic = /^(game|start|play|launcher|main|app|client|run|shipping)$/i.test(stem);
  const result = extra => ({launcher_detected: launcher, generic_launcher: generic, executable: base, phase: req.phase === 'local' ? 'local' : 'all', validation_state: 'confirmed', ...extra});
  let own = sid ? host.shortcutGame(sid) : null;
  // Atalho de emulador criado pela própria Steam: o Taiga Launcher adota o jogo e responde com o AppID virtual dele.
  if (!own && sid && host.adoptShortcut && (req.phase !== 'local' || /--taiga-launch\s/.test(options))) { try { own = await host.adoptShortcut({sid, exe, startDir: start, options, title}); } catch {} }
  if (own) { const appid = host.steamAppIdOf(own) || virtualAppIdFor(own.uuid || own.id); if (appid) return result({candidates: [{appid: String(appid), name: own.title, image: isVirtualAppId(appid) ? host.artUrl(own.art?.wide || own.art?.cover) : 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + appid + '/header.jpg', score: 100, confidence: 'exact', reasons: ['taigasteam_identified'], executable_match: true, direct: true, evidence_tier: 'proof'}], source: 'taigasteam'}); }
  const ev = evidenceAppId(exe, start, options);
  if (ev) { const d = req.phase === 'local' ? null : await appdetails(ev.appid, lang); return result({candidates: [{appid: ev.appid, name: d?.name || title || stem, image: d?.header_image || 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + ev.appid + '/header.jpg', score: 100, confidence: 'exact', reasons: [ev.source], executable_match: true, direct: true, evidence_tier: 'proof'}], source: ev.source}); }
  if (req.phase === 'local') return result({candidates: [], source: 'local'});
  const key = [title, exe, start, options, lang].join('\u001f'), hit = detectCache.get(key, 600); if (hit) return hit;
  const names = []; const add = v => { v = trim(v).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim(); if (v.length >= 2 && !names.some(n => normalizeTitle(n) === normalizeTitle(v)) && !/^(game|launcher|start|play|setup|win64|binaries|bin|shipping)$/i.test(v)) names.push(v); };
  add(title); try { add(host.executableTitle?.(exe)); } catch {} if (!generic) add(stem.replace(/-Win64-Shipping$/i, '')); let d = start || path.win32.dirname(exe); for (let i = 0; i < 3 && d; i++) { const b = path.win32.basename(d); if (!/^(bin|binaries|win64|win32|x64|x86|game|games|jogos|common|steamapps)$/i.test(b)) add(b); const p = path.win32.dirname(d); if (p === d) break; d = p; }
  const seen = new Map();
  for (const name of names.slice(0, 4)) {
   let items = []; try { items = (await host.searchStore(name))?.items || []; } catch {}
   for (const it of items.slice(0, 8)) {
    const a = normalizeTitle(name), b = normalizeTitle(it.name); const exact = a === b; const tokensA = new Set(a.split(' ')), tokensB = b.split(' ').filter(Boolean); const overlap = tokensB.filter(t => tokensA.has(t)).length / Math.max(tokensA.size, tokensB.length, 1);
    const score = Math.round(exact ? 96 : 40 + overlap * 50); const prev = seen.get(String(it.appId));
    if (!prev || score > prev.score) seen.set(String(it.appId), {appid: String(it.appId), name: it.name, image: it.image || 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + it.appId + '/header.jpg', score, reasons: [exact ? 'official_title_exact' : 'title_similarity'], executable_match: false, direct: false});
   }
  }
  const list = [...seen.values()].sort((x, y) => y.score - x.score).slice(0, 10);
  list.forEach((c, i) => { c.confidence = c.score >= 95 ? 'high' : c.score >= 80 ? 'medium' : 'low'; c.evidence_tier = c.score >= 95 ? 'strong' : 'supporting'; c.score_gap = i === 0 && list[1] ? c.score - list[1].score : undefined; c.ambiguous = i === 0 && list[1] ? list[1].score >= c.score - 3 : false; });
  return detectCache.set(key, result({candidates: list, source: 'steam_store_search'}));
 }

 // ── artwork.lua ──
 const libraryCache = new TtlCache(48);
 const LANG_ALIASES = {spanish: ['latam'], latam: ['spanish'], portuguese: ['brazilian'], brazilian: ['portuguese'], schinese: ['tchinese'], tchinese: ['schinese']};
 const localized = (bucket, lang) => { if (typeof bucket === 'string') return bucket; if (!bucket || typeof bucket !== 'object') return ''; for (const k of [lang, ...(LANG_ALIASES[lang] || []), 'english', 'default', 'neutral']) if (typeof bucket[k] === 'string' && bucket[k]) return bucket[k]; return ''; };
 const pick = (asset, lang, prefer2x) => { if (!asset || typeof asset !== 'object') return ''; for (const k of prefer2x ? ['image2x', 'image'] : ['image', 'image2x']) { const v = localized(asset[k], lang); if (v) return v; } return ''; };
 const assetUrl = (appid, rel) => { const v = String(rel || ''); return !v || v.includes('..') || v.includes('\\') || /^https?:\/\//.test(v) || !/^[\w./-]+$/.test(v) ? '' : 'https://shared.steamstatic.com/store_item_assets/steam/apps/' + appid + '/' + v; };
 const communityAsset = (appid, hash, ext) => { hash = String(hash || '').toLowerCase(); return hash.length === 40 && /^[0-9a-f]+$/.test(hash) && ['tga', 'ico', 'jpg', 'png'].includes(ext) ? 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/' + appid + '/' + hash + '.' + ext : ''; };
 const communityIcon = (appid, hash, ext) => { hash = String(hash || '').toLowerCase(); return hash.length === 40 && /^[0-9a-f]+$/.test(hash) && ['ico', 'jpg', 'png'].includes(ext) ? 'https://shared.fastly.steamstatic.com/community_assets/images/apps/' + appid + '/' + hash + '.' + ext : ''; };
 function installSize(depots) {
  if (!depots || typeof depots !== 'object') return 0; const cands = []; let osMeta = false;
  for (const [id, d] of Object.entries(depots)) { if (!d || typeof d !== 'object' || d.dlcappid || d.depotfromapp || d.sharedinstall || typeof d.manifests !== 'object') continue; const os = String(d.config?.oslist || ''); if (os) osMeta = true; if (os && !os.toLowerCase().includes('windows')) continue; let m = d.manifests.public; if (!m || typeof m !== 'object') m = Object.values(d.manifests).find(x => x && typeof x === 'object' && x.size); const size = Number(m?.size); if (size > 0) cands.push({id: Number(id) || 0, size}); }
  cands.sort((a, b) => a.id - b.id); const sel = [];
  for (const c of cands) { let dup = false; if (!osMeta && cands.length >= 3 && sel.length) { const p = sel[sel.length - 1], s = Math.min(p.size, c.size), l = Math.max(p.size, c.size); dup = c.id === p.id + 1 && l > 0 && s / l >= 0.7; } if (!dup) sel.push(c); }
  return sel.reduce((t, c) => t + c.size, 0);
 }
 async function libraryAssets(req) {
  const appid = String(req.steam_app_id ?? req.appid ?? ''), lang = safeLanguage(req.language);
  if (!/^\d+$/.test(appid)) return {error: 'invalid_appid'};
  if (isVirtualAppId(appid)) {
   // Jogos de emulador: capa vertical, fundo, logo e dados do Taiga Launcher no lugar dos ativos da Loja.
   const g = host.virtualGame(Number(appid)); if (!g) return {found: false, appid, source: 'taigasteam'};
   const m = g.metadata || {}, art = g.art || {};
   return {found: !!(art.cover || art.hero || art.logo || art.wide), appid, source: 'taigasteam', portrait: host.artUrl(art.cover), hero: host.artUrl(art.hero), hero2x: '', logo: host.artUrl(art.logo), wide: host.artUrl(art.wide), legacy_header: '', legacy_logo: '', icon: '', shortcut_icon: '', shortcut_icons: [],
    franchise: m.series || '', developers: String(m.developer || '').split(/\s*,\s*/).filter(Boolean), publishers: String(m.publisher || '').split(/\s*,\s*/).filter(Boolean), genre_ids: [], controller_support: 'full', category_ids: VIRTUAL_CATEGORY_IDS, release_date: /^\d{4}-\d{2}-\d{2}$/.test(String(m.release || '')) ? m.release : '',
    library_metadata_algorithm: 3, library_asset_language_algorithm: 2, shortcut_icon_algorithm: 3, install_size: 0, install_size_algorithm: 3, historical_metadata_algorithm: 1};
  }
  const key = appid + '|' + lang; if (!req.force_refresh) { const hit = libraryCache.get(key, 600); if (hit) return hit; }
  const r = await httpGet('https://api.steamcmd.net/v1/info/' + appid, {headers: {Accept: 'application/json'}, timeout: 20});
  if (!r || r.status !== 200) return {error: 'request_failed'};
  let body; try { body = JSON.parse(r.body); } catch {}
  const app = body?.data?.[appid], common = app?.common;
  if (!common || typeof common !== 'object') return {found: false, appid};
  const assets = common.library_assets_full && typeof common.library_assets_full === 'object' ? common.library_assets_full : {};
  let franchise = ''; const developers = [], publishers = [], genre_ids = [], category_ids = [];
  for (const a of Object.values(common.associations || {})) { const t = String(a?.type || '').toLowerCase(), n = String(a?.name || ''); if (!n) continue; if (t === 'developer') developers.push(n); else if (t === 'publisher') publishers.push(n); else if (t === 'franchise' && !franchise) franchise = n; }
  for (const gid of Object.values(common.genres || {})) if (/^\d+$/.test(String(gid))) genre_ids.push(String(gid)); genre_ids.sort();
  for (const [k, v] of Object.entries(common.category || {})) { const id = k.match(/^category_(\d+)$/)?.[1]; if (id && (v === 1 || v === true || String(v) === '1')) category_ids.push(Number(id)); } category_ids.sort((a, b) => a - b);
  const rel = Number(common.steam_release_date), icons = [];
  const legacyHeader = assetUrl(appid, typeof common.header_image === 'string' ? common.header_image : common.header_image?.english || Object.values(common.header_image || {}).find(v => typeof v === 'string' && v) || ''), legacyLogo = communityAsset(appid, common.logo, 'jpg');
  const ci = [communityAsset(appid, common.icon, 'jpg'), communityIcon(appid, common.icon, 'jpg'), communityAsset(appid, common.icon, 'png')], cl = [communityAsset(appid, common.clienticon || common.icon, 'jpg'), communityIcon(appid, common.clienticon || common.icon, 'jpg'), communityAsset(appid, common.clienticon, 'ico'), communityIcon(appid, common.clienticon, 'ico'), communityAsset(appid, common.clienttga, 'tga')];
  for (const [url, ext] of [[ci[0], 'jpg'], [ci[1], 'jpg'], [ci[2], 'png'], [cl[0], 'jpg'], [cl[1], 'jpg'], [cl[2], 'ico'], [cl[3], 'ico'], [cl[4], 'tga']]) if (url && !icons.some(i => i.url === url)) icons.push({url, extension: ext});
  const logoAsset = assets.library_logo;
  const result = {found: Object.keys(assets).length > 0 || icons.length > 0 || !!legacyHeader || !!legacyLogo, appid, source: 'steamcmd_appinfo',
   portrait: assetUrl(appid, pick(assets.library_capsule, lang, true)), hero: assetUrl(appid, localized(assets.library_hero?.image, lang)), hero2x: assetUrl(appid, localized(assets.library_hero?.image2x, lang)),
   logo: assetUrl(appid, pick(logoAsset, lang, true)), wide: assetUrl(appid, pick(assets.library_header, lang, true)), legacy_header: legacyHeader, legacy_logo: legacyLogo, icon: communityIcon(appid, common.icon, 'jpg'),
   shortcut_icon: icons[0]?.url || '', shortcut_icon_extension: icons[0]?.extension || '', shortcut_icons: icons, shortcut_icon_algorithm: 3, library_asset_language_algorithm: 2,
   franchise, developers, publishers, genre_ids, controller_support: String(common.controller_support || ''), category_ids, release_date: rel > 0 ? new Date(rel * 1000).toISOString().slice(0, 10) : '', library_metadata_algorithm: 3,
   logo_position: logoAsset?.logo_position || assets.logo_position || common.library_assets?.logo_position || undefined,
   logo_position_source: logoAsset?.logo_position && typeof logoAsset.logo_position === 'object' ? 'library_assets_full.library_logo' : assets.logo_position && typeof assets.logo_position === 'object' ? 'library_assets_full' : common.library_assets?.logo_position && typeof common.library_assets.logo_position === 'object' ? 'library_assets' : 'none',
   install_size: installSize(app.depots), install_size_algorithm: 3, historical_metadata_algorithm: 1};
  if (!result.wide) result.wide = legacyHeader;
  return libraryCache.set(key, result);
 }
 // SteamGridDB (artwork_candidates.lua). A chave salva no Taiga Launcher entra junto com a do NGL.
 const apiKeys = input => { const keys = []; const add = v => { v = trim(v); if (v.length >= 16 && v.length <= 160 && !keys.includes(v)) keys.push(v); }; add(input?.api_key); for (const k of Array.isArray(input?.api_keys) ? input.api_keys : []) add(k); add(host.config().sgdbKey); return keys; };
 async function sgdb(p, key) { const r = await httpGet('https://www.steamgriddb.com/api/v2/' + p, {headers: {Accept: 'application/json', Authorization: 'Bearer ' + key}, timeout: 6}); if (!r || r.status !== 200) return null; try { return JSON.parse(r.body); } catch { return null; } }
 const QUALITY = {portrait: {w: 300, h: 400, min: .5, max: .85}, hero: {w: 1280, h: 400, min: 2.35, max: 3.65}, wide: {w: 800, h: 350, min: 1.8, max: 2.65}, icon: {w: 32, h: 32}};
 const unsafeText = /nsfw|meme|humor|joke|epilepsy|nintendo switch|switch banner|switch grid|switch cover|playstation banner|ps5 banner|ps4 banner|xbox banner|console banner/;
 function sgdbCandidates(body, slot) {
  let items = body?.data; if (!items) return []; if (items.url) items = [items]; const out = [];
  for (const it of items) {
   if (out.length >= 10) break; if (!it || it.animated || it.nsfw || it.humor || it.epilepsy || String(it.type || '').toLowerCase() === 'animated') continue;
   const text = [it.style, Array.isArray(it.tags) ? it.tags.map(t => t?.name || t?.tag || t?.slug || t).join(' ') : it.tags, it.name].map(v => String(v || '')).join(' ').toLowerCase(); if (unsafeText.test(text)) continue;
   const url = /^https:\/\/([a-z0-9-]+\.)*steamgriddb\.com\//i.test(it.url || '') ? it.url : ''; if (!url) continue;
   const w = Number(it.width), h = Number(it.height), ratio = w && h ? w / h : null, q = QUALITY[slot];
   if (slot === 'portrait' && w && h && h <= w) continue;
   if (q && !(w && h && (!q.w || w >= q.w) && (!q.h || h >= q.h) && (!q.min || (ratio && ratio >= q.min)) && (!q.max || (ratio && ratio <= q.max)))) continue;
   const thumb = /^https:\/\/([a-z0-9-]+\.)*steamgriddb\.com\//i.test(it.thumb || it.thumbnail || '') ? (it.thumb || it.thumbnail) : url;
   out.push({id: it.id, url, thumb, width: w, height: h, language: it.language, style: it.style, transparent: it.transparent === true});
  }
  return out;
 }
 async function resolveSgdb(appid, keys, includeIcon, gameId = null) {
  let key = null;
  if (gameId) key = keys[0]; else for (const k of keys) { const g = await sgdb('games/steam/' + appid, k); if (g?.data?.id) { gameId = g.data.id; key = k; break; } }
  if (!gameId || !key) return null;
  let portrait = sgdbCandidates(await sgdb('grids/game/' + gameId + '?dimensions=600x900,342x482,660x930', key), 'portrait'); if (!portrait.length) portrait = sgdbCandidates(await sgdb('grids/game/' + gameId, key), 'portrait');
  const hero = sgdbCandidates(await sgdb('heroes/game/' + gameId, key), 'hero'), logo = sgdbCandidates(await sgdb('logos/game/' + gameId, key), 'logo'), wide = sgdbCandidates(await sgdb('grids/game/' + gameId + '?dimensions=920x430', key), 'wide'), icon = includeIcon ? sgdbCandidates(await sgdb('icons/game/' + gameId, key), 'icon') : [];
  const first = l => l[0]?.id ?? null;
  return {game_id: gameId, defaults: {portrait: first(portrait), hero: first(hero), logo: first(logo), wide: first(wide), icon: first(icon)}, slots: {portrait, hero, logo, wide, icon}};
 }
 const virtualSgdbId = appid => { const g = host.virtualGame(Number(appid)); return g?.sgdbId || null; };
 async function communityArtwork(input) {
  const appid = String(input.steam_app_id ?? input.appid ?? ''); if (!/^\d+$/.test(appid)) return {error: 'invalid_appid'};
  const keys = apiKeys(input); if (!keys.length) return {error: 'api_key_missing'};
  const res = await resolveSgdb(appid, keys, false, isVirtualAppId(appid) ? virtualSgdbId(appid) : null); if (!res) return {found: false, source: 'steamgriddb', error: 'game_not_found'};
  const by = (l, id) => l.find(x => x.id === id) || l[0] || null, p = by(res.slots.portrait, res.defaults.portrait), h = by(res.slots.hero, res.defaults.hero), l = by(res.slots.logo, res.defaults.logo), w = by(res.slots.wide, res.defaults.wide);
  return {found: !!(p || h || l || w), source: 'steamgriddb', curated: false, portrait: p?.url || '', hero: h?.url || '', logo: l?.url || '', wide: w?.url || '', icon: '', defaults: res.defaults, slots: res.slots, provenance: {portrait: p, hero: h, logo: l, wide: w, icon: null}};
 }
 async function communityCandidates(input) {
  const appid = String(input.steam_app_id ?? input.appid ?? ''); if (!/^\d+$/.test(appid)) return {error: 'invalid_appid'};
  const title = isVirtualAppId(appid) ? host.virtualGame(Number(appid))?.title || 'Jogo' : 'Steam AppID ' + appid;
  if (input.eligibility_only) return {eligible: true, title};
  const keys = apiKeys(input); if (!keys.length) return {eligible: true, title, error: 'api_key_missing'};
  const res = await resolveSgdb(appid, keys, true, isVirtualAppId(appid) ? virtualSgdbId(appid) : null); if (!res) return {eligible: true, title, error: 'game_not_found'};
  return {eligible: true, title, source: 'steamgriddb', defaults: res.defaults, slots: res.slots};
 }
 // Gravação na pasta grid da Steam (artwork.lua / artwork_icon.lua).
 const validImage = (b, ext) => { if (!b || b.length <= 100) return false; ext = ext === 'jpeg' ? 'jpg' : ext; if (ext === 'png') return b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71; if (ext === 'jpg') return b[0] === 255 && b[1] === 216; if (ext === 'webp') return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP'; if (ext === 'ico') return b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0 && b[4] > 0; if (ext === 'tga') { const t = b[2], w = b[12] + b[13] * 256, h = b[14] + b[15] * 256; return [1, 2, 3, 9, 10, 11].includes(t) && w > 0 && h > 0 && w <= 4096 && h <= 4096; } return false; };
 const writeAtomic = (target, body) => { const tmp = target + '.tmp'; fs.mkdirSync(path.dirname(target), {recursive: true}); fs.writeFileSync(tmp, body); try { fs.rmSync(target, {force: true}); } catch {} fs.renameSync(tmp, target); };
 // Só os jogos de emulador (AppID virtual) têm as artes protegidas; jogos da Steam seguem o NativeGameLink.
 const isOurShortcut = id => { const g = host.shortcutGame(unsignedId(id)); return !!g && !host.steamAppIdOf(g); };
 async function saveShortcutArtwork(req) {
  const sid = String(req.shortcut_app_id ?? req.target_app_id ?? '').match(/\d+/)?.[0] || '', type = Number(req.image_type);
  if (!sid || !Number.isInteger(type) || type < 0 || type > 3) return {ok: false, error: 'invalid_request'};
  let body = null; if (/^https?:\/\//.test(String(req.url || ''))) { const r = await httpGet(String(req.url), {binary: true, headers: {Accept: 'image/png,image/jpeg,image/webp,*/*'}, timeout: 20}); if (r?.status === 200 && r.body.length > 100) body = r.body; }
  if (!body) { const raw = String(req.data_base64 || req.image_base64 || req.base64 || ''); if (raw) body = Buffer.from(raw, 'base64'); }
  const mime = imageMime(body); if (!mime) return {ok: false, error: body ? 'invalid_image_magic_bytes' : 'empty_or_failed_image'};
  if (!account()) return {ok: false, error: 'active_user_not_found'};
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp', suffix = ['p', '_hero', '_logo', ''][type], target = path.join(gridDir(), sid + suffix + '.' + ext);
  writeAtomic(target, body); for (const old of ['png', 'jpg', 'jpeg', 'webp']) { const o = path.join(gridDir(), sid + suffix + '.' + old); if (o !== target) try { fs.rmSync(o, {force: true}); } catch {} }
  host.onArtworkChanged?.(unsignedId(sid), type);
  return {ok: true, saved: true, path: target, image_type: type};
 }
 const iconEpochs = new Map();
 const writeIcon = (sid, ext, body) => { if (!validImage(body, ext)) return null; const target = path.join(gridDir(), sid + '_icon.' + ext); writeAtomic(target, body); for (const old of ['tga', 'ico', 'jpg', 'jpeg', 'png']) { const o = path.join(gridDir(), sid + '_icon.' + old); if (o !== target) try { fs.rmSync(o, {force: true}); } catch {} } return target; };
 async function saveShortcutIcon(req) {
  const sid = String(req.shortcut_app_id || '').match(/\d+/)?.[0] || '', appid = String(req.steam_app_id || '').match(/\d+/)?.[0] || '';
  if (!sid || !appid) return {error: 'invalid_appid'}; if (!account()) return {error: 'active_user_not_found'};
  const epoch = iconEpochs.get(sid) || 0, current = () => (iconEpochs.get(sid) || 0) === epoch;
  const url = String(req.url || req.icon_url || '');
  if (/^https?:\/\//.test(url)) { const r = await httpGet(url, {binary: true, timeout: 15}); if (r?.status === 200 && r.body.length > 100 && current()) { const ext = imageMime(r.body) === 'image/jpeg' ? 'jpg' : 'png'; const f = writeIcon(sid, ext, r.body); if (f) return {saved: true, path: f, extension: ext, source: url}; } }
  const b64 = String(req.icon_base64 || req.data_base64 || '');
  if (b64) { if (!current()) return {error: 'superseded'}; const ext = String(req.extension || req.icon_extension || 'png').toLowerCase(); const f = writeIcon(sid, ext === 'jpeg' ? 'jpg' : ext, Buffer.from(b64, 'base64')); return f ? {saved: true, path: f, extension: ext, source: String(req.source || 'frontend')} : {error: 'icon_payload_failed'}; }
  const assets = await libraryAssets({steam_app_id: appid, language: req.language || 'english'});
  for (const c of assets.shortcut_icons || []) {
   if (!/^https:\/\/(cdn\.cloudflare\.steamstatic\.com\/steamcommunity\/public\/images\/apps|shared\.fastly\.steamstatic\.com\/community_assets\/images\/apps)\/\d+\/[0-9a-f]+\.[a-z]+$/.test(c.url)) continue;
   const r = await httpGet(c.url, {binary: true, timeout: 20}); if (r?.status !== 200 || !validImage(r.body, c.extension)) continue; if (!current()) return {error: 'superseded'};
   const f = writeIcon(sid, c.extension, r.body); if (f) return {saved: true, path: f, extension: c.extension, source: c.url};
  }
  return {error: 'icon_download_failed'};
 }
 function removeGridFiles(sid, suffixes) {
  const s = String(sid || '').match(/\d+/)?.[0]; if (!s || !fs.existsSync(gridDir())) return 0;
  // As artes dos jogos do Taiga Launcher são gerenciadas pelo programa.
  if (isOurShortcut(s)) return 0;
  const n = Number(s), ids = n >= 2147483648 ? [s, String(n - 4294967296)] : [s]; let removed = 0;
  for (const id of ids) { for (const suf of suffixes) for (const ext of ['jpg', 'jpeg', 'png', 'tga', 'ico']) { const f = path.join(gridDir(), id + suf + '.' + ext); if (fs.existsSync(f)) { try { fs.rmSync(f); removed++; } catch {} } } if (suffixes.includes('_logo') || suffixes.includes('')) { const j = path.join(gridDir(), id + '.json'); if (fs.existsSync(j)) { try { fs.rmSync(j); removed++; } catch {} } } }
  return removed;
 }
 const parseShortcutParam = r => (typeof r === 'object' && r ? String(r.shortcut_app_id ?? r.appid ?? '') : (() => { try { const p = JSON.parse(String(r)); return String(p.shortcut_app_id ?? p.appid ?? ''); } catch { return String(r ?? ''); } })()).match(/\d+/)?.[0] || null;
 function readImageDataUrl(file) { try { const b = fs.readFileSync(file); const m = imageMime(b); return m ? 'data:' + m + ';base64,' + b.toString('base64') : null; } catch { return null; } }

 // ── conquistas ──
 const dateSeconds = v => { if (v === null || v === undefined || v === '') return 0; const n = Number(v); if (Number.isFinite(n)) return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n); const t = Date.parse(String(v)); return Number.isFinite(t) ? Math.floor(t / 1000) : 0; };
 const absUrl = u => String(u || '').startsWith('/') ? host.artUrl(String(u).replace(/^\/art\//, '')) : String(u || '');
 function gameForAchievement(req) {
  const sid = unsignedId(req.state_app_id ?? req.shortcut_app_id ?? req.local_app_id); const bySid = sid ? host.shortcutGame(sid) : null; if (bySid) return bySid;
  const meta = Number(String(req.steam_app_id ?? req.appid ?? '').match(/\d+/)?.[0]); if (isVirtualAppId(meta)) return host.virtualGame(meta);
  return host.games().find(g => host.steamAppIdOf(g) === meta && g.bindings?.[account()]) || null;
 }
 async function localAchievementData(raw) {
  const req = typeof raw === 'object' && raw && typeof raw.request_json === 'string' ? decodeRequest(raw) : typeof raw === 'string' && !/^\d+$/.test(raw) ? decodeRequest(raw) : raw && typeof raw === 'object' ? raw : {steam_app_id: raw};
  const metadataAppId = String(req.steam_app_id ?? req.appid ?? '').match(/\d+/)?.[0] || '';
  if (!metadataAppId) return {found: false, error: 'invalid_appid'};
  const g = gameForAchievement(req), stateAppId = String(req.state_app_id ?? req.shortcut_app_id ?? metadataAppId);
  if (!g) return {found: false, appid: metadataAppId, metadata_appid: metadataAppId, state_appid: stateAppId, unlocked: 0, total: 0, achievements: [], error: 'not_a_taigasteam_game'};
  let data; try { data = await host.achievements(g, {live: Number(req.max_age_ms) === 0 ? true : false}); } catch { data = host.cachedAchievements?.(g); }
  const list = (data?.achievements || []).map(a => ({name: String(a.id), display_name: a.title || String(a.id), description: a.description || '', icon: absUrl(a.icon), icon_gray: absUrl(a.lockedIcon || a.icon), hidden: !!a.hidden, global_percent: Number(a.globalPercent) || 0, global_percent_known: a.globalPercent !== null && a.globalPercent !== undefined, earned: !!a.unlocked, earned_time: a.unlocked ? dateSeconds(a.date) : 0, progress: Number(a.progress) || 0, max_progress: Number(a.maxProgress) || 0, is_online: false, client_writable: false}));
  return {found: list.length > 0, appid: metadataAppId, metadata_appid: metadataAppId, state_appid: stateAppId, root: '', path: data?.progressFile || '', metadata_source: data?.source || 'Taiga Launcher', state_source: data?.provider || 'taigasteam', simulation_enabled: false, simulate_unlock_all: false, unlock_online: false, zero_progress: !list.some(a => a.earned), unlocked: list.filter(a => a.earned).length, total: list.length, achievements: list, taiga_status: list.length ? 'ok' : String(data?.status || 'unavailable'), taiga_provider: String(data?.provider || '')};
 }

 // ── playtime.lua ──
 const ptFile = file('playtime_sessions.json');
 let pt = null;
 const loadPt = () => { if (!pt) { const v = readJson(ptFile, null); pt = v && typeof v.sessions === 'object' ? v : {version: 2, sessions: {}, aliases: {}, offsets: {}}; pt.offsets ||= {}; } return pt; };
 const savePt = () => writeJsonAtomic(ptFile, loadPt());
 const ptKey = req => { const id = String(req.shortcut_app_id ?? req.state_app_id ?? req.local_app_id ?? '').match(/^\d+$/)?.[0]; if (id) return id; const t = normalizeTitle(req.title); const s = loadPt(); return t ? s.aliases['title:' + t] || null : null; };
 function collapse(list) { const two = Date.now() / 1000 - 14 * 86400; let zero = list.find(s => s.started_at === 0), latest = list.reduce((a, s) => !a || s.ended_at > a.ended_at ? s : a, null); const stale = list.filter(s => s.ended_at < two && s !== latest && s !== zero); if (!zero && stale.length) { zero = {started_at: 0, ended_at: 0}; list.unshift(zero); } for (const s of stale) { zero.ended_at += Math.max(0, s.ended_at - s.started_at); list.splice(list.indexOf(s), 1); } }
 function playtimeFor(req) {
  const id = ptKey(req), g = id ? host.shortcutGame(Number(id)) : null, now = Math.floor(Date.now() / 1000), two = now - 14 * 86400;
  if (g) { const p = host.playtime(g) || {}, offset = Number(loadPt().offsets[id] || 0), total = Math.max(0, Number(p.seconds || 0) + offset), last = p.lastPlayed ? dateSeconds(p.lastPlayed) : 0, recent = last && last > two ? Math.min(total, Number(p.recentSeconds ?? p.seconds ?? 0)) : 0; return {ok: true, seconds_forever: total, seconds_last_two_weeks: recent, minutes_forever: Math.round(total / 60), minutes_last_two_weeks: Math.round(recent / 60), last_played_at: last || undefined, source: 'taigasteam'}; }
  const list = id ? loadPt().sessions[id] || [] : []; let all = 0, recent = 0, last = 0;
  for (const s of list) { const d = Math.max(0, (s.ended_at ?? s.started_at) - s.started_at); all += d; if (s.started_at > two || s.ended_at > two) recent += d; if (s.started_at !== 0 && s.ended_at > last) last = s.ended_at; }
  if (id && req.title) { loadPt().aliases['title:' + normalizeTitle(req.title)] = id; }
  return {ok: true, seconds_forever: all, seconds_last_two_weeks: recent, minutes_forever: Math.round(all / 60), minutes_last_two_weeks: Math.round(recent / 60), last_played_at: last || undefined};
 }
 function session(req, kind) {
  const id = ptKey(req); if (!id) return {ok: false, error: 'missing_shortcut_app_id'};
  // Jogos do Taiga Launcher já têm o tempo registrado pelo próprio programa; não contar duas vezes.
  if (host.shortcutGame(Number(id))) return kind === 'start' ? {ok: true, instance_id: String(req.instance_id || Date.now())} : {ok: true};
  const s = loadPt(), list = s.sessions[id] ||= [], now = Math.floor(Date.now() / 1000), inst = String(req.instance_id || '');
  if (kind === 'start') { const ex = list.find(x => x.instance_id === (inst || String(now))); if (ex) ex.ended_at = now; else list.push({instance_id: inst || String(now), started_at: now, ended_at: now}); savePt(); return {ok: true, instance_id: inst || String(now)}; }
  const cur = list.find(x => inst ? x.instance_id === inst : x.instance_id) || (kind === 'stop' && !inst ? list[list.length - 1] : null);
  if (!cur) return {ok: false}; cur.ended_at = now; if (kind === 'stop') { delete cur.instance_id; collapse(list); } savePt(); return {ok: true};
 }

 // ── callables ──
 const S = v => typeof v === 'string' ? v : JSON.stringify(v);
 const calls = {
  save_mapping: async ({non_steam_id, steam_id} = {}) => /^\d+$/.test(String(steam_id)) && setMapping(non_steam_id, steam_id) ? 'ok' : 'error',
  remove_mapping: async ({non_steam_id} = {}) => removeMapping(non_steam_id) ? 'ok' : 'error',
  update_mappings: async args => { const r = decodeRequest(args); for (const [k, v] of Object.entries(r.set || {})) if (/^\d+$/.test(String(v))) setMapping(k, v); for (const k of Array.isArray(r.remove) ? r.remove : []) removeMapping(k, {sweep: r.explicit !== true}); return JSON.stringify({ok: true, data: allMappings()}); },
  get_all_mappings: async () => JSON.stringify(allMappings()),
  fetch_game_data: web.fetch_game_data,
  get_shortcut_details: async ({shortcut_app_id, title} = {}) => { const id = unsignedId(shortcut_app_id); const s = shortcutsListCached().find(x => (id && Number(x.shortcut_app_id) === id) || (title && normalizeTitle(x.title) === normalizeTitle(title))); return JSON.stringify(s || {error: 'shortcut_not_found'}); },
  list_shortcuts: async () => JSON.stringify({ok: true, shortcuts: shortcutsListCached(), account_id: account()}),
  read_shortcut_logo_inventory: async args => { const r = decodeRequest(args); if (!Array.isArray(r.shortcuts)) return JSON.stringify({ok: false, error: 'invalid_request', entries: []}); const maps = allMappings(), entries = []; for (const it of r.shortcuts.slice(0, 128)) { const id = String(it?.shortcut_app_id || ''), steam = String(it?.steam_app_id || ''), mtime = Number(it?.native_mtime); if (!/^\d+$/.test(id) || Number(id) < 2147483648 || !/^\d+$/.test(steam) || !(mtime > 0)) continue; if (String(maps['shortcut:' + id] || '') !== steam || entries.some(e => e.shortcut_app_id === id)) continue; entries.push({shortcut_app_id: id, steam_app_id: steam, requested_native_mtime: mtime, png_exists: fs.existsSync(path.join(gridDir(), id + '_logo.png')), jpg_exists: fs.existsSync(path.join(gridDir(), id + '_logo.jpg'))}); } return JSON.stringify({ok: true, entries}); },
  detect_game_candidates: async args => JSON.stringify(await detect(decodeRequest(args))),
  detect_game_candidates_local: async args => JSON.stringify(await detect({...decodeRequest(args), phase: 'local'})),
  fetch_news: web.fetch_news, fetch_partner_events: web.fetch_partner_events,
  fetch_published_file_previews: web.fetch_published_file_previews, fetch_friend_review: web.fetch_friend_review, fetch_friend_personas: web.fetch_friend_personas,
  fetch_community_activity: web.fetch_community_activity, fetch_community_content: web.fetch_community_content, fetch_community_items_catalog: web.fetch_community_items_catalog,
  fetch_library_assets: async args => JSON.stringify(await libraryAssets(decodeRequest(args))),
  fetch_community_artwork: async args => JSON.stringify(await communityArtwork(decodeRequest(args)).catch(() => ({found: false, error: 'fetch_failed'}))),
  fetch_community_artwork_candidates: async args => JSON.stringify(await communityCandidates(decodeRequest(args)).catch(() => ({eligible: false, error: 'fetch_failed'}))),
  fetch_artwork_image: async args => { const r = decodeRequest(args); let url = trustedImageHost(r.url) ? String(r.url) : ''; if (!url) return JSON.stringify({ok: false, error: 'untrusted_url'}); const res = await httpGet(url, {binary: true, headers: {Accept: 'image/webp,image/png,image/jpeg,*/*'}, timeout: 15}); if (!res) return JSON.stringify({ok: false, error: 'network_error'}); if (res.status !== 200 || (res.url && !trustedImageHost(res.url))) return JSON.stringify({ok: false, error: 'http_error', status: res.status}); const mime = imageMime(res.body); return JSON.stringify(mime ? {ok: true, mime, data_base64: res.body.toString('base64')} : {ok: false, error: 'unsupported_image'}); },
  read_local_artwork_image: async args => { const r = decodeRequest(args), p = trim(r.path); if (!p || p.length > 4096 || /[\0\r\n]/.test(p)) return JSON.stringify({ok: false, error: 'invalid_path'}); const d = readImageDataUrl(p); return JSON.stringify(d ? {ok: true, mime: d.slice(5, d.indexOf(';')), data_base64: d.slice(d.indexOf(',') + 1)} : {ok: false, error: fs.existsSync(p) ? 'unsupported_image' : 'open_failed'}); },
  validate_steamgriddb_api_key: async args => { const k = trim(decodeRequest(args).api_key); if (k.length < 16 || k.length > 160) return JSON.stringify({ok: false, error: 'invalid_key_format'}); const r = await httpGet('https://www.steamgriddb.com/api/v2/games/steam/10', {headers: {Accept: 'application/json', Authorization: 'Bearer ' + k}, timeout: 10}); if (!r) return JSON.stringify({ok: false, error: 'service_unavailable'}); if (r.status === 401 || r.status === 403) return JSON.stringify({ok: false, error: 'invalid_key'}); if (r.status !== 200) return JSON.stringify({ok: false, error: 'service_unavailable', status: r.status}); host.onSteamGridDbKey?.(k); return JSON.stringify({ok: true}); },
  save_shortcut_icon: async args => JSON.stringify(await saveShortcutIcon(decodeRequest(args))),
  save_shortcut_artwork: async args => JSON.stringify(await saveShortcutArtwork(decodeRequest(args))),
  clear_artwork: async ({shortcut_app_id} = {}) => { iconEpochs.set(String(shortcut_app_id), (iconEpochs.get(String(shortcut_app_id)) || 0) + 1); return JSON.stringify({removed: removeGridFiles(shortcut_app_id, ['p', '_hero', '_logo', '_icon', ''])}); },
  clear_artwork_except_icon: async ({shortcut_app_id} = {}) => JSON.stringify({removed: removeGridFiles(shortcut_app_id, ['p', '_hero', '_logo', '']), icon_preserved: true}),
  clear_artwork_slots: async args => { const r = decodeRequest(args), sid = String(r.shortcut_app_id || '').match(/\d+/)?.[0]; if (!sid) return JSON.stringify({ok: false, error: 'invalid_shortcut'}); const map = {0: 'p', 1: '_hero', 2: '_logo', 3: '', 4: '_icon'}, slots = [...new Set((r.slots || []).map(Number).filter(n => n in map))]; return JSON.stringify({ok: true, removed: slots.length ? removeGridFiles(sid, slots.map(s => map[s])) : 0, slots}); },
  clear_all_linked_artworks: async () => { let removed = 0; for (const k of Object.keys(readMappings())) { const sid = k.match(/(\d+)$/)?.[1]; if (sid) removed += removeGridFiles(sid, ['p', '_hero', '_logo', '_icon', '']); } return JSON.stringify({ok: true, removed}); },
  read_custom_logo_position: async r => { const id = parseShortcutParam(r); if (!id || !account()) return JSON.stringify({ok: false, error: !id ? 'invalid_shortcut_app_id' : 'active_user_not_found'}); const f = path.join(gridDir(), id + '.json'); if (!fs.existsSync(f)) return JSON.stringify({ok: true, exists: false}); const v = readJson(f, null); return JSON.stringify(v ? {ok: true, exists: true, version: v.nVersion, logo_position: v.logoPosition} : {ok: false, error: 'parse_failed'}); },
  save_custom_logo_position: async r => { const req = decodeRequest(r), id = parseShortcutParam(req), pos = req.logo_position || req.logoPosition || req.position; if (!id || Number(id) < 2147483648 || !account() || !pos || typeof pos !== 'object') return JSON.stringify({ok: false, error: 'invalid_params'}); const f = path.join(gridDir(), id + '.json'); try { writeAtomic(f, JSON.stringify({nVersion: 1, logoPosition: pos})); } catch { return JSON.stringify({ok: false, error: 'open_failed'}); } return JSON.stringify({ok: true, exists: true, path: f}); },
  read_logo_layout_images: async r => { const id = parseShortcutParam(r); if (!id || Number(id) < 2147483648 || !account()) return JSON.stringify({ok: false}); const out = {ok: true}; for (const slot of ['logo', 'hero']) for (const ext of ['png', 'jpg', 'webp']) { const f = path.join(gridDir(), id + '_' + slot + '.' + ext); if (fs.existsSync(f)) { const d = readImageDataUrl(f); if (d) out[slot] = d; break; } } return JSON.stringify(out); },
  get_achievement_base_path: async () => { const p = host.config().achievementRoot || path.join(process.env.APPDATA || host.dataDir, 'Goldberg SteamEmu Saves'); return JSON.stringify({ok: true, path: p, exists: fs.existsSync(p), configured: !!host.config().achievementRoot}); },
  set_achievement_base_path: async ({path: p} = {}) => { const v = trim(p); if (!v || v.length > 4096) return JSON.stringify({ok: false, error: 'invalid_path'}); host.setConfig?.({achievementRoot: v}); return JSON.stringify({ok: true, path: v, exists: fs.existsSync(v)}); },
  get_game_achievement_path: async args => { const r = decodeRequest(args), g = gameForAchievement(r); const p = g?.achievementSettings?.root || ''; return JSON.stringify(g ? {ok: true, configured: !!p, key: 'shortcut:' + (g.bindings?.[account()] || ''), path: p, exists: !!p && fs.existsSync(p), usable: !!p && fs.existsSync(p)} : {ok: true, configured: false, path: '', exists: false, usable: false}); },
  set_game_achievement_path: async args => { const r = decodeRequest(args), g = gameForAchievement(r); if (!g) return JSON.stringify({ok: false, error: 'missing_game_id'}); const p = trim(r.path); host.setGameAchievementRoot?.(g, p); return JSON.stringify({ok: true, configured: !!p, key: 'shortcut:' + (g.bindings?.[account()] || ''), path: p, exists: !!p && fs.existsSync(p), usable: !!p && fs.existsSync(p)}); },
  get_game_achievement_options: async () => JSON.stringify({ok: true, configured: false, simulate: false, simulate_count: 0, simulate_online_count: 0, simulate_percent: 0, simulate_online_percent: 0, unlock_online: false}),
  set_game_achievement_options: async () => JSON.stringify({ok: true, configured: false, simulate: false, simulate_count: 0, simulate_online_count: 0, simulate_percent: 0, simulate_online_percent: 0, unlock_online: false}),
  get_game_achievement_capabilities: async args => { const r = decodeRequest(args); const d = await localAchievementData({steam_app_id: r.steam_app_id || r.appid, state_app_id: r.shortcut_app_id || r.state_app_id}); return JSON.stringify(/^\d+$/.test(String(r.steam_app_id || r.appid || '')) ? {ok: true, appid: String(r.steam_app_id || r.appid), total: d.total || 0, online_count: 0, has_online: false, metadata_source: d.metadata_source || ''} : {ok: false, error: 'missing_steam_app_id'}); },
  export_achievements_json: async () => UNSUPPORTED,
  fetch_local_achievement_data: async args => JSON.stringify(await localAchievementData(args)),
  start_playtime_session: async args => JSON.stringify(session(decodeRequest(args), 'start')),
  ping_playtime_session: async args => JSON.stringify(session(decodeRequest(args), 'ping')),
  stop_playtime_session: async args => JSON.stringify(session(decodeRequest(args), 'stop')),
  get_playtime_data: async args => JSON.stringify(playtimeFor(decodeRequest(args))),
  get_all_playtime_data: async args => { const r = decodeRequest(args), list = Array.isArray(r.requests) ? r.requests : Array.isArray(r) ? r : []; return JSON.stringify({ok: true, items: list.filter(x => x && typeof x === 'object').map((it, i) => ({...playtimeFor(it), key: String(it.key ?? it.shortcut_app_id ?? i + 1), shortcut_app_id: String(it.shortcut_app_id || '')}))}); },
  set_playtime_data: async args => { const r = decodeRequest(args), id = ptKey(r); if (!id) return JSON.stringify({ok: false, error: 'missing_shortcut_app_id'}); const minutes = Math.max(0, Number(r.minutes_forever) || 0), s = loadPt(), g = host.shortcutGame(Number(id)); if (g) s.offsets[id] = Math.round(minutes * 60) - Number(host.playtime(g)?.seconds || 0); else s.sessions[id] = [{started_at: 0, ended_at: Math.floor(minutes * 60)}]; return JSON.stringify({ok: savePt(), minutes_forever: minutes}); },
  fetch_steam_account_achievements: async () => UNSUPPORTED,
  sync_steam_account_achievements: async () => UNSUPPORTED,
  start_steam_card_farming: async () => UNSUPPORTED,
  stop_steam_card_farming: async () => JSON.stringify({ok: true, running: false}),
  get_steam_card_farming_status: async () => JSON.stringify({ok: true, running: false, supported: false}),
  neutralize_steam_appid_file: async () => JSON.stringify({ok: true, modified: false, skipped: 'managed_by_taigasteam'}),
  restore_steam_appid_file: async () => JSON.stringify({ok: true, restored: false}),
  suppress_admin_prompt: async () => true,
  factory_reset: async args => { const r = decodeRequest(args); writeMappings({}); if (r.delete_playtime === true) { pt = {version: 2, sessions: {}, aliases: {}, offsets: {}}; savePt(); } return JSON.stringify({ok: true, deleted_playtime: r.delete_playtime === true}); },
  // Taiga Launcher: jogos de loja não instalados (botões Instalar/Cancelar e progresso na página do jogo).
  taiga_install_state: async ({shortcut_app_id} = {}) => { const g = host.shortcutGame?.(shortcut_app_id); if (!g || !host.install) return JSON.stringify({state: 'unknown'}); return JSON.stringify({...host.install.state(g), title: g.title}); },
  taiga_install_start: async ({shortcut_app_id, via, dir, desktop, start_menu} = {}) => { const g = host.shortcutGame?.(shortcut_app_id); if (!g || !host.install) return JSON.stringify({state: 'unknown'}); try { return JSON.stringify(await host.install.start(g, {via: ['launcher', 'legendary'].includes(via) ? via : '', dir: typeof dir === 'string' ? dir : '', shortcuts: desktop !== undefined || start_menu !== undefined ? {desktop: !!desktop, startMenu: !!start_menu} : null})); } catch (e) { return JSON.stringify({state: 'error', error: String(e.message || e).slice(0, 300)}); } },
  taiga_install_info: async ({shortcut_app_id, wait} = {}) => { const g = host.shortcutGame?.(shortcut_app_id); if (!g || !host.install?.info) return JSON.stringify({state: 'unknown'}); try { return JSON.stringify(await host.install.info(g, {wait: !!wait})); } catch (e) { return JSON.stringify({state: 'error', error: String(e.message || e).slice(0, 300)}); } },
  taiga_install_pick_folder: async () => JSON.stringify({path: host.install?.pickFolder ? await host.install.pickFolder() : ''}),
  taiga_virtual_cards: async ({steam_app_id} = {}) => { if (!host.virtualCards || !isVirtualAppId(String(steam_app_id || ''))) return JSON.stringify({cards: [], badges: []}); try { return JSON.stringify(await host.virtualCards(Number(steam_app_id)) || {cards: [], badges: []}); } catch (e) { return JSON.stringify({cards: [], badges: [], error: String(e.message || e).slice(0, 200)}); } },
  taiga_install_ids: async () => JSON.stringify({items: host.install?.ids ? host.install.ids() : []}),
  taiga_install_pause: async ({shortcut_app_id} = {}) => { const g = host.shortcutGame?.(shortcut_app_id); if (!g || !host.install?.pause) return JSON.stringify({state: 'unknown'}); return JSON.stringify(await host.install.pause(g)); },
  taiga_install_cancel: async ({shortcut_app_id} = {}) => { const g = host.shortcutGame?.(shortcut_app_id); if (!g || !host.install) return JSON.stringify({state: 'unknown'}); return JSON.stringify(await host.install.cancel(g)); },
  fe_log: async ({msg} = {}) => { log('[NGL] ' + String(msg).slice(0, 2000)); return 'ok'; },
 };
 // Notícias que a Steam só tem em inglês: título e resumo traduzidos para o idioma do Taiga Launcher (cache permanente;
 // no máximo 8 por vez e 6 s de espera, o que não ficar pronto aparece traduzido na próxima abertura).
 const ENGLISH = /\b(the|and|is|are|we|you|your|to|of|with|for|this|that|now|have|has|our|will|new|from)\b/gi;
 const looksEnglish = t => (String(t || '').match(ENGLISH) || []).length >= 2 || /^[\x00-\x7f]*$/.test(String(t || '')) && (String(t || '').match(ENGLISH) || []).length >= 1;
 const plain = t => String(t || '').replace(/\[img\][\s\S]*?\[\/img\]/gi, ' ').replace(/\[(?:url|previewyoutube|video)[^\]]*\][\s\S]*?\[\/(?:url|previewyoutube|video)\]/gi, ' ').replace(/\[[^\]]+\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
 async function translateNews(text) {
  let data; try { data = JSON.parse(text); } catch { return text; }
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.appnews?.newsitems) ? data.appnews.newsitems : null; if (!items) return text;
  const jobs = [];
  for (const it of items.slice(0, 8)) {
   if (it.title && looksEnglish(it.title)) jobs.push(host.translate(it.title).then(t => { if (t) it.title = t; }).catch(() => {}));
   const body = plain(it.contents);
   if (body && looksEnglish(body)) { const cut = body.length > 300 ? body.slice(0, 300).replace(/\s+\S*$/, '') + '…' : body; jobs.push(host.translate(cut).then(t => { if (t) it.contents = t; }).catch(() => {})); }
  }
  await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 6000))]);
  return JSON.stringify(data);
 }
 async function call(method, args) {
  const fn = calls[method]; if (!fn) throw Error('unknown_method:' + method);
  // Loja, notícias, cartas e comunidade sempre no idioma escolhido no Taiga Launcher (não no da Steam).
  const lang = steamLanguageFor(language()), a = args && typeof args === 'object' ? {...args} : {};
  if ('language' in a) a.language = lang;
  if (typeof a.request_json === 'string') { try { const r = JSON.parse(a.request_json); if (r && typeof r === 'object' && 'language' in r) { r.language = lang; a.request_json = JSON.stringify(r); } } catch {} }
  const out = await fn(a);
  if ((method === 'fetch_news' || method === 'fetch_partner_events') && lang !== 'english' && host.translate) return translateNews(out);
  return out;
 }
 return {call, calls, allMappings, virtualAppIdFor, isVirtualAppId, playtimeFor, localAchievementData, detect, libraryAssets, shortcutsList, flush: () => pt && savePt()};
}
// Resultado entregue ao frontend como no Millennium: JSON da resposta (texto JSON já pronto é repassado).
export function encodeCallResult(value) {
 if (typeof value === 'string') { try { JSON.parse(value); return value; } catch { return JSON.stringify(value); } }
 return JSON.stringify(value ?? null);
}
