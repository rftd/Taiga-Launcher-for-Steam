// Conquistas de jogos de outras lojas, no mesmo formato usado pelo RetroAchievements e pela Steam no Taiga Launcher.
// Rotas estudadas no SuccessStory/playnite-plugincommon (MIT, Lacro59):
//  - Epic: GraphQL público do launcher (launcher.store.epicgames.com/graphql). A lista de conquistas
//    (productAchievementsRecordBySandbox) é pública; o progresso vem do perfil do jogador
//    (playerProfile.productAchievements), que responde sem login quando as conquistas do perfil são públicas.
//  - GOG: página pública do perfil (gog.com/u/<usuário>/game/<id>), que traz window.profilesData.achievements.
// Nada é gravado nas lojas; só leitura.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const EPIC_GRAPHQL = 'https://launcher.store.epicgames.com/graphql';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher Chrome/120.0 Safari/537.36';
const ALLOWED = /^https:\/\/(launcher\.store\.epicgames\.com|store\.epicgames\.com|www\.gog\.com|titlehub\.xboxlive\.com|achievements\.xboxlive\.com)\//;
const readJSON = f => { try { if (fs.statSync(f).size > 8 * 1024 * 1024) return null; return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const EPIC_LOCALE = {'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr', de: 'de'};
const GOG_LANG = {'pt-BR': 'pt', en: 'en', es: 'es', fr: 'fr', de: 'de'};

const SCHEMA_QUERY = `query Achievement($SandboxId: String!, $Locale: String!) { Achievement { productAchievementsRecordBySandbox(sandboxId: $SandboxId, locale: $Locale) { productId sandboxId totalAchievements achievements { achievement { name hidden unlockedDisplayName lockedDisplayName unlockedDescription lockedDescription unlockedIconLink lockedIconLink XP rarity { percent } } } } } }`;
const PLAYER_QUERY = `query playerProfileAchievementsByProductId($EpicAccountId: String!, $ProductId: String!) { PlayerProfile { playerProfile(epicAccountId: $EpicAccountId) { epicAccountId displayName productAchievements(productId: $ProductId) { ... on PlayerProductAchievementsResponseSuccess { data { totalUnlocked playerAchievements { playerAchievement { achievementName unlocked unlockDate progress } } } } } } } }`;

// ── Epic: jogos instalados (manifestos .item) e conta ──
export function epicManifests(env = process.env) {
 const dir = path.join(env.PROGRAMDATA || env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
 let names = []; try { names = fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.item')); } catch { return []; }
 return names.map(n => readJSON(path.join(dir, n))).filter(m => m && m.CatalogNamespace && m.InstallLocation).map(m => ({appName: m.AppName || '', namespace: m.CatalogNamespace, catalogItemId: m.CatalogItemId || '', title: m.DisplayName || '', root: String(m.InstallLocation).replace(/\//g, '\\')}));
}
const inside = (file, root) => { const a = String(file || '').replace(/\//g, '\\').toLowerCase(), b = String(root || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase(); return !!b && (a === b || a.startsWith(b + '\\')); };
// Jogo da Epic: pela importação da loja ou pelo executável dentro de uma pasta instalada pela Epic.
export function epicGameInfo(game, manifests) {
 if (game?.store?.name === 'epic' && game.store.namespace) return {namespace: game.store.namespace, appName: game.store.appName || ''};
 const m = manifests.find(x => (game?.store?.name === 'epic' && (x.catalogItemId === game.store.id || x.appName === game.store.id)) || inside(game?.path, x.root) || inside(game?.gameRoot, x.root));
 return m ? {namespace: m.namespace, appName: m.appName} : null;
}
const HEX32 = /\b([0-9a-f]{32})\b/i;
// ID da conta Epic deste PC, sem login: o launcher grava a conta nos registros e passa "-epicuserid=<id>" a cada
// jogo que abre. Ordem de confiança: -epicuserid (é sempre a conta logada), LastLoggedInUser, accountId do
// armazenamento da loja e, por último, menções genéricas nos registros.
const STRONG = [/-epicuserid=([0-9a-f]{32})\b/i, /LastLoggedInUser["'\s:=]+([0-9a-f]{32})\b/i];
const WEAK = [/"(?:accountId|epicAccountId|account_id)"\s*:\s*"([0-9a-f]{32})"/i, /(?:AccountId|Account Id|accountId|account_id|UserId)["'\s:=\[]+([0-9a-f]{32})\b/i, /\/account\/api\/public\/account\/([0-9a-f]{32})\b/i];
export function epicAccountFromText(text, patterns = [...STRONG, ...WEAK]) { for (const re of patterns) { const m = String(text || '').match(re); if (m) return m[1].toLowerCase(); } return null; }
export function epicAccountIdFromLauncher(env = process.env) {
 const base = env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'EpicGamesLauncher', 'Saved') : '';
 if (!base) return null;
 const files = [path.join(base, 'Config', 'Windows', 'GameUserSettings.ini'), path.join(base, 'Logs', 'EpicGamesLauncher.log')];
 try { for (const n of fs.readdirSync(path.join(base, 'Logs'))) if (/^EpicGamesLauncher.*\.log$/i.test(n) && !files.includes(path.join(base, 'Logs', n))) files.push(path.join(base, 'Logs', n)); } catch {}
 // Armazenamento local da loja dentro do launcher (webcache*/Local Storage/leveldb).
 const store = [];
 try { for (const w of fs.readdirSync(base)) { if (!/^webcache/i.test(w)) continue; const dir = path.join(base, w, 'Local Storage', 'leveldb'); try { for (const n of fs.readdirSync(dir)) if (/\.(log|ldb)$/i.test(n)) store.push(path.join(dir, n)); } catch {} } } catch {}
 const read = f => { try { const st = fs.statSync(f); if (st.size > 32 * 1024 * 1024) return ''; return fs.readFileSync(f, 'latin1'); } catch { return ''; } };
 const texts = files.map(read);
 for (const t of texts) { const id = epicAccountFromText(t, STRONG); if (id) return id; }
 for (const f of store) { const id = epicAccountFromText(read(f), WEAK.slice(0, 1)); if (id) return id; }
 for (const t of texts) { const id = epicAccountFromText(t, WEAK); if (id) return id; }
 return null;
}
// Aceita o ID (32 caracteres) ou o link do perfil (store.epicgames.com/u/<id>).
export function parseEpicAccount(value) { const m = String(value || '').trim().match(/(?:\/u\/)?([0-9a-f]{32})(?:\b|\/|$)/i); return m ? m[1].toLowerCase() : ''; }

export class StoreAchievements {
 constructor({dir, fetchImpl = (...a) => fetch(...a), offline = false} = {}) { Object.assign(this, {dir, fetchImpl, offline}); }
 cacheFile(key) { return path.join(this.dir, 'cache', 'store-ach-' + createHash('sha1').update(key).digest('hex').slice(0, 24) + '.json'); }
 cached(key, maxAge) { const c = readJSON(this.cacheFile(key)); return c && Date.now() - c.at < maxAge ? c.data : null; }
 store(key, data) { try { fs.mkdirSync(path.join(this.dir, 'cache'), {recursive: true}); fs.writeFileSync(this.cacheFile(key), JSON.stringify({at: Date.now(), data})); } catch {} return data; }
 async http(url, {method = 'GET', body = null, headers = {}} = {}) {
  if (this.offline) throw Error('Sem conexão (modo offline).');
  if (!ALLOWED.test(url)) throw Error('Fonte não permitida.');
  const res = await this.fetchImpl(url, {method, body, headers: {'User-Agent': UA, ...headers}, signal: AbortSignal.timeout(20000)});
  if (!res.ok) throw Error('A loja respondeu HTTP ' + res.status + '.');
  return res.text();
 }
 async graphql(query, variables, auth = null) {
  const text = await this.http(EPIC_GRAPHQL, {method: 'POST', body: JSON.stringify({query, variables}), headers: {'Content-Type': 'application/json', Accept: 'application/json', ...(auth?.accessToken ? {Authorization: (auth.type || 'bearer') + ' ' + auth.accessToken} : {})}});
  let data; try { data = JSON.parse(text); } catch { throw Error('Resposta inválida da Epic.'); }
  return data?.data || null;
 }
 // Lista oficial de conquistas da Epic (pública), guardada por 24 h.
 async epicSchema(namespace, language) {
  const locale = EPIC_LOCALE[language] || 'en-US', key = 'epic-schema|' + namespace + '|' + locale, hit = this.cached(key, 86400000); if (hit) return hit;
  const d = await this.graphql(SCHEMA_QUERY, {SandboxId: namespace, Locale: locale});
  const rec = d?.Achievement?.productAchievementsRecordBySandbox;
  if (!rec?.productId) return this.store(key, {productId: '', achievements: []});
  return this.store(key, {productId: rec.productId, achievements: (rec.achievements || []).map(x => x?.achievement).filter(a => a?.name)});
 }
 // auth: sessão da Epic (login no Taiga Launcher), como o SuccessStory: permite ler o progresso mesmo com o perfil privado.
 async epic({namespace, accountId, language = 'pt-BR', live = false, auth = null}) {
  const schema = await this.epicSchema(namespace, language);
  // A Epic devolve o texto em inglês quando o jogo não tem tradução: compara com a versão em inglês para saber o
  // que ainda precisa ser traduzido para o idioma do Taiga Launcher.
  let english = null; if (schema.achievements.length && (EPIC_LOCALE[language] || 'en-US') !== 'en-US') { try { english = new Map((await this.epicSchema(namespace, 'en')).achievements.map(a => [String(a.name), a])); } catch {} }
  const langOf = (a, field) => { if (!english) return (EPIC_LOCALE[language] || 'en-US') === 'en-US' ? 'en' : language; const e = english.get(String(a.name)); if (!e) return language; const pick = x => String(x[field] || '').trim(); return pick(a) && pick(a) === pick(e) && /[a-z]/i.test(pick(a)) ? 'en' : language; };
  if (!schema.achievements.length) return {status: 'unmapped', provider: 'epic', source: 'Epic Games', message: 'Este jogo não tem conquistas na Epic.', achievements: []};
  let progress = null, status = 'ok', message = '';
  if (accountId) {
   const key = 'epic-player|' + accountId + '|' + schema.productId; progress = this.cached(key, live ? 30000 : 120000);
   if (!progress) {
    try {
     let d = null; try { d = await this.graphql(PLAYER_QUERY, {EpicAccountId: accountId, ProductId: schema.productId}); } catch (e) { if (!auth) throw e; }
     // Perfil privado (sem resposta anônima) e com login: pede de novo autenticado, como o SuccessStory.
     if (!d?.PlayerProfile?.playerProfile?.productAchievements?.data && auth) d = await this.graphql(PLAYER_QUERY, {EpicAccountId: accountId, ProductId: schema.productId}, auth);
     const resp = d?.PlayerProfile?.playerProfile?.productAchievements?.data;
     if (resp) progress = this.store(key, (resp.playerAchievements || []).map(x => x?.playerAchievement).filter(Boolean));
     else { status = 'private'; message = auth ? 'A Epic não devolveu as conquistas deste jogo para a sua conta.' : 'O perfil da Epic não mostra as conquistas. Entre com a sua conta Epic em Configurações > Conquistas de outras lojas (ou deixe as conquistas públicas no perfil da Epic).'; }
    } catch (e) { status = 'offline'; message = e.message; }
   }
  } else { status = 'unconfigured'; message = 'Informe sua conta Epic nas configurações para ver o progresso.'; }
  const earned = new Map((progress || []).filter(p => p.unlocked).map(p => [String(p.achievementName), p]));
  const achievements = schema.achievements.map(a => {
   const p = earned.get(String(a.name)), unlocked = !!p, hidden = !!a.hidden;
   return {id: String(a.name), title: String((unlocked || !hidden ? a.unlockedDisplayName : a.lockedDisplayName) || a.unlockedDisplayName || a.name).trim(), description: String((unlocked || !hidden ? a.unlockedDescription : a.lockedDescription) || '').trim(), icon: a.unlockedIconLink || '', lockedIcon: a.lockedIconLink || a.unlockedIconLink || '', hidden, unlocked, date: unlocked && p.unlockDate ? new Date(p.unlockDate).toISOString() : null, globalPercent: Number.isFinite(Number(a.rarity?.percent)) ? Number(a.rarity.percent) : null, points: Number(a.XP) || 0, titleLanguage: langOf(a, unlocked || !hidden ? 'unlockedDisplayName' : 'lockedDisplayName'), descriptionLanguage: langOf(a, unlocked || !hidden ? 'unlockedDescription' : 'lockedDescription')};
  });
  return {status: status === 'ok' || progress ? 'ok' : status, provider: 'epic', source: 'Epic Games', sourceLanguage: language, progressKnown: !!progress, message, achievements};
 }
 // GOG: perfil público. O ID numérico do usuário vem da própria página do perfil.
 async gogUserId(username) {
  const key = 'gog-user|' + username.toLowerCase(), hit = this.cached(key, 30 * 86400000); if (hit) return hit;
  const html = await this.http('https://www.gog.com/u/' + encodeURIComponent(username));
  const m = html.match(/"(?:userId|user_id|id)"\s*:\s*"?(\d{6,})"?/); if (!m) throw Error('Perfil GOG não encontrado ou privado.');
  return this.store(key, m[1]);
 }
 async gog({productId, username, language = 'pt-BR', live = false}) {
  if (!username) return {status: 'unconfigured', provider: 'gog', source: 'GOG', message: 'Informe seu usuário GOG nas configurações para ver as conquistas.', achievements: []};
  const key = 'gog-ach|' + username.toLowerCase() + '|' + productId + '|' + language, hit = live ? null : this.cached(key, 60000); if (hit) return hit;
  const userId = await this.gogUserId(username);
  const html = await this.http('https://www.gog.com/u/' + encodeURIComponent(username) + '/game/' + encodeURIComponent(productId) + '?sort=user_unlock_date&sort_user_id=' + userId, {headers: {Cookie: 'gog_lc=BR_BRL_' + (GOG_LANG[language] || 'en')}});
  const start = html.search(/window\.profilesData\.achievements\s*=\s*/); if (start < 0) return {status: 'private', provider: 'gog', source: 'GOG', message: 'O perfil GOG não mostra as conquistas deste jogo.', achievements: []};
  const json = extractJSON(html.slice(start).replace(/^window\.profilesData\.achievements\s*=\s*/, ''));
  let list = []; try { list = JSON.parse(json); } catch { return {status: 'offline', provider: 'gog', source: 'GOG', message: 'Resposta inválida da GOG.', achievements: []}; }
  const achievements = (Array.isArray(list) ? list : []).map(x => { const a = x?.achievement || {}, st = x?.stats?.[userId] || {}; const unlocked = !!st.isUnlocked; return {id: String(a.id || a.key || a.name), title: String(a.name || '').trim(), description: String(a.description || '').trim(), icon: a.imageUrlUnlocked2 || a.image_url_unlocked_2 || a.imageUrlUnlocked || '', lockedIcon: a.imageUrlLocked2 || a.image_url_locked_2 || a.imageUrlLocked || '', hidden: a.visible === false, unlocked, date: unlocked && st.unlockDate ? new Date(Number(st.unlockDate) * 1000).toISOString() : null, globalPercent: Number.isFinite(Number(a.rarity)) ? Number(a.rarity) : null}; }).filter(a => a.id);
  return this.store(key, {status: 'ok', provider: 'gog', source: 'GOG', sourceLanguage: language, progressKnown: true, achievements});
 }
 // Xbox / Microsoft Store: conquistas da conta Xbox (login no Taiga Launcher). O jogo é achado na lista de títulos da
 // conta pelo nome do pacote (PFN) ou, se faltar, pelo nome.
 async xbox({session, pfn = '', titleId = '', name = '', altNames = [], language = 'pt-BR', live = false}) {
  if (!session?.xsts?.token) return {status: 'unconfigured', provider: 'xbox', source: 'Xbox', message: 'Entre com a sua conta Microsoft em Contas para ver as conquistas do Xbox.', achievements: []};
  const lang = {'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE'}[language] || 'en-US', auth = 'XBL3.0 x=' + session.xsts.uhs + ';' + session.xsts.token, xuid = session.xsts.xuid;
  const headers = v => ({Authorization: auth, 'x-xbl-contract-version': v, 'Accept-Language': lang, Accept: 'application/json'});
  const shape = list => (list || []).map(x => ({titleId: String(x.titleId), pfn: String(x.pfn || ''), name: String(x.name || ''), total: Number(x.achievement?.totalAchievements) || 0}));
  // Nome sem sinais, "™", "for Windows", "(PC)", "Windows 10 Edition" e afins: o mesmo jogo com nomes um pouco diferentes.
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[™®©]/g, '').replace(/\((?:pc|windows(?: 10)?|game preview)\)/g, '').replace(/\b(?:for windows(?: 10)?|windows(?: 10)? edition|pc edition|xbox one edition|game preview)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
  const names = [name, ...altNames].map(norm).filter(Boolean);
  const pick = list => list.find(t => titleId && t.titleId === String(titleId)) || list.find(t => pfn && t.pfn.toLowerCase() === pfn.toLowerCase()) || list.find(t => names.includes(norm(t.name)));
  const titlesKey = 'xbox-titles|' + xuid;
  const loadTitles = async () => this.store(titlesKey, shape(JSON.parse(await this.http('https://titlehub.xboxlive.com/users/xuid(' + xuid + ')/titles/titlehistory/decoration/achievement,detail', {headers: headers('2')})).titles));
  let titles = this.cached(titlesKey, 6 * 3600000), title = titles ? pick(titles) : null;
  // Jogo aberto há pouco ainda não estava na lista guardada: busca a lista de novo (no máximo a cada 2 min).
  if (!title && (!titles || !this.cached(titlesKey, 120000))) { titles = await loadTitles(); title = pick(titles); }
  // Fora do histórico: pergunta direto pelo Title ID ou pelo pacote.
  for (const q of !title ? [titleId && 'titleid(' + titleId + ')', pfn && 'pfn(' + pfn + ')'].filter(Boolean) : []) {
   try { const t = shape(JSON.parse(await this.http('https://titlehub.xboxlive.com/users/xuid(' + xuid + ')/titles/' + q + '/decoration/achievement,detail', {headers: headers('2')})).titles)[0]; if (t?.titleId) { title = t; break; } } catch {}
  }
  if (!title) return {status: 'unmapped', provider: 'xbox', source: 'Xbox', message: 'Este jogo ainda não aparece no histórico da sua conta Xbox. Abra o jogo uma vez e tente de novo.', achievements: []};
  const key = 'xbox-ach|' + xuid + '|' + title.titleId + '|' + lang, hit = live ? null : this.cached(key, 60000); if (hit) return hit;
  // Todas as páginas (jogos com muitas conquistas vêm em partes).
  const raw = []; let token = '';
  for (let page = 0; page < 10; page++) {
   const d = JSON.parse(await this.http('https://achievements.xboxlive.com/users/xuid(' + xuid + ')/achievements?titleId=' + title.titleId + '&maxItems=1000' + (token ? '&continuationToken=' + encodeURIComponent(token) : ''), {headers: headers('2')}));
   raw.push(...(d.achievements || [])); token = d.pagingInfo?.continuationToken || ''; if (!token) break;
  }
  const achievements = raw.map(a => { const unlocked = a.progressState === 'Achieved', icon = (a.mediaAssets || []).find(m => /icon/i.test(m.type || m.name))?.url || (a.mediaAssets || [])[0]?.url || '', req = (a.progression?.requirements || [])[0], cur = Number(req?.current), target = Number(req?.target); return {id: String(a.id), title: String(a.name || '').trim() || ('#' + a.id), description: String((unlocked ? a.description : a.lockedDescription || a.description) || '').trim(), icon, lockedIcon: icon, hidden: !!a.isSecret, unlocked, date: unlocked && a.progression?.timeUnlocked && !/^0001/.test(a.progression.timeUnlocked) ? new Date(a.progression.timeUnlocked).toISOString() : null, globalPercent: Number.isFinite(Number(a.rarity?.currentPercentage)) ? Number(a.rarity.currentPercentage) : null, ...(!unlocked && Number.isFinite(cur) && Number.isFinite(target) && target > 1 ? {progress: Math.max(0, cur), maxProgress: target} : {})}; });
  if (!achievements.length) return {status: 'unmapped', provider: 'xbox', source: 'Xbox', message: title.total ? 'O Xbox ainda não liberou a lista de conquistas deste jogo para a sua conta. Tente de novo em alguns minutos.' : 'Este jogo não tem conquistas no Xbox.', achievements: []};
  return this.store(key, {status: 'ok', provider: 'xbox', source: 'Xbox', sourceLanguage: language, progressKnown: true, achievements});
 }

}
// Primeiro valor JSON completo (array/objeto) de um texto.
export function extractJSON(text) {
 const open = text[0], close = open === '[' ? ']' : '}'; if (open !== '[' && open !== '{') return '';
 let depth = 0, str = false, esc = false;
 for (let i = 0; i < text.length; i++) { const c = text[i]; if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; } if (c === '"') str = true; else if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') { depth--; if (!depth) return text.slice(0, i + 1); } }
 return '';
}
// Jogo da GOG: pela importação da loja ou pelo goggame-<id>.info ao lado do executável.
export function gogProductId(game) {
 if (game?.store?.name === 'gog' && /^\d+$/.test(String(game.store.id || ''))) return String(game.store.id);
 let dir = game?.gameRoot || (game?.path ? path.win32.dirname(String(game.path)) : '');
 for (let i = 0; i < 3 && dir; i++) { try { const n = fs.readdirSync(dir).find(x => /^goggame-\d+\.info$/i.test(x)); if (n) return n.match(/\d+/)[0]; } catch {} const p = path.win32.dirname(dir); if (p === dir) break; dir = p; }
 return null;
}
