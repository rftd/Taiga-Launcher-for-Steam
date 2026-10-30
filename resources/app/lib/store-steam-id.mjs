// AppID da Steam a partir do ID da loja (Epic, GOG, Xbox…), sem depender do nome: o IGDB e o SteamGridDB guardam o
// ID de cada jogo em cada loja. Só quando os dois lados apontam para o mesmo jogo a ligação é feita.
const IGDB_STORE = {epic: 26, gog: 5, xbox: 11, microsoft: 11, amazon: 20};
const SGDB_STORE = {epic: 'egs', origin: 'origin', ea: 'origin', ubisoft: 'uplay', uplay: 'uplay', battlenet: 'bnet'};
const clean = v => String(v || '').trim();

export function storeIds(game) {
 const s = game.store || {}, name = String(s.name || '').toLowerCase();
 return {store: name, ids: [...new Set([clean(s.id), clean(s.namespace), clean(s.appName), clean(game.launch?.storeId)].filter(v => v && v.length >= 3 && v.length <= 80))]};
}

import {editionBase, normalizeTitle} from './title-match.mjs';
const UA = 'TaigaLauncher/2.5 (https://github.com/GabrielTaiga/Taiga-Launcher)';
const getJSON = async (fetchImpl, url, options = {}) => { const res = await fetchImpl(url, {...options, headers: {'User-Agent': UA, Accept: 'application/json', ...(options.headers || {})}, signal: AbortSignal.timeout(20000)}); if (!res.ok) throw Error('HTTP ' + res.status); return res.json(); };
// Endereço da página do jogo na Epic (pageSlug), pelo mesmo GraphQL que o Heroic usa.
export async function epicSlug(namespace, fetchImpl = (...a) => fetch(...a)) {
 if (!/^[\w-]{3,80}$/.test(String(namespace || ''))) return '';
 const query = '{ Catalog { catalogNs(namespace: "' + namespace + '") { mappings(pageType: "productHome") { pageSlug pageType } } } }';
 const d = await getJSON(fetchImpl, 'https://launcher.store.epicgames.com/graphql', {method: 'POST', body: JSON.stringify({query}), headers: {'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher'}});
 const m = (d?.data?.Catalog?.catalogNs?.mappings || []).find(x => x?.pageType === 'productHome' && x.pageSlug);
 return m ? String(m.pageSlug) : '';
}
// Wikidata: o item do jogo guarda o ID da Epic Games Store (P6278) ou da Microsoft Store (P5885) e o AppID da Steam
// (P1733). Liga só quando um único jogo tem esse ID e ele aponta para um único AppID.
export async function wikidataSteamByStore(store, values, fetchImpl = (...a) => fetch(...a)) {
 const prop = store === 'epic' ? 'P6278' : store === 'xbox' || store === 'microsoft' ? 'P5885' : '';
 if (!prop) return null;
 for (const v of [...new Set(values.filter(Boolean))]) {
  if (!/^[\w./-]{2,120}$/.test(v)) continue;
  const q = await getJSON(fetchImpl, 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({action: 'query', list: 'search', srsearch: 'haswbstatement:' + prop + '=' + v, srlimit: '5', format: 'json', origin: '*'}));
  const qids = (q?.query?.search || []).map(x => x.title).filter(t => /^Q\d+$/.test(t));
  if (qids.length !== 1) continue;
  const e = await getJSON(fetchImpl, 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({action: 'wbgetentities', ids: qids[0], props: 'claims|labels', languages: 'en', format: 'json', origin: '*'}));
  const ent = e?.entities?.[qids[0]];
  const id = await pickSteamId(ent, fetchImpl);
  if (id) return {appId: id, source: 'wikidata', name: ent?.labels?.en?.value || '', qid: qids[0]};
 }
 return null;
}
// AppID da Steam guardado no item da Wikidata. Com mais de um (edições, demos, trilhas), fica o "preferido" da
// Wikidata ou, se não houver, o único que a loja da Steam diz ser um jogo.
export async function pickSteamId(ent, fetchImpl = (...a) => fetch(...a)) {
 const claims = (ent?.claims?.P1733 || []).filter(c => c?.rank !== 'deprecated' && /^\d{1,10}$/.test(String(c?.mainsnak?.datavalue?.value || '')));
 const ids = [...new Set(claims.map(c => String(c.mainsnak.datavalue.value)))];
 if (ids.length === 1) return Number(ids[0]);
 const preferred = [...new Set(claims.filter(c => c.rank === 'preferred').map(c => String(c.mainsnak.datavalue.value)))];
 if (preferred.length === 1) return Number(preferred[0]);
 if (ids.length > 1 && ids.length <= 6) {
  const games = [];
  for (const id of ids) { try { const d = await getJSON(fetchImpl, 'https://store.steampowered.com/api/appdetails?appids=' + id + '&filters=basic'); const data = d?.[id]; if (data?.success && data.data?.type === 'game') games.push(Number(id)); } catch {} }
  if (games.length === 1) return games[0];
 }
 return 0;
}
// Wikidata pelo nome: o item de jogo (P31 = videogame) com o rótulo em inglês igual ao nome (ou ao nome sem o sufixo de
// edição) e com AppID da Steam. Liga só quando há um único item assim.
export async function wikidataSteamByName(titles, fetchImpl = (...a) => fetch(...a)) {
 const wanted = [...new Set(titles.filter(Boolean).flatMap(t => [t, editionBase(t)]).map(t => String(t).replace(/[™®©]/g, '').trim()).filter(t => t.length > 2))];
 for (const t of wanted) {
  const q = await getJSON(fetchImpl, 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({action: 'query', list: 'search', srsearch: '"' + t.replace(/"/g, '') + '" haswbstatement:P1733 haswbstatement:P31=Q7889', srlimit: '8', format: 'json', origin: '*'}));
  const qids = (q?.query?.search || []).map(x => x.title).filter(x => /^Q\d+$/.test(x));
  if (!qids.length) continue;
  const e = await getJSON(fetchImpl, 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({action: 'wbgetentities', ids: qids.join('|'), props: 'claims|labels|aliases', languages: 'en', format: 'json', origin: '*'}));
  const same = Object.values(e?.entities || {}).filter(ent => [ent?.labels?.en?.value, ...(ent?.aliases?.en || []).map(a => a.value)].some(l => l && normalizeTitle(l) === normalizeTitle(t)));
  if (same.length !== 1) continue;
  const id = await pickSteamId(same[0], fetchImpl);
  if (id) return {appId: id, source: 'wikidata-name', name: same[0].labels?.en?.value || t, qid: same[0].id};
 }
 return null;
}

export async function steamIdFromStore(game, providers, {log = () => {}, fetchImpl = (...a) => fetch(...a)} = {}) {
 const {store, ids} = storeIds(game);
 if (!store || !ids.length) return null;
 // Wikidata pelo ID da loja: slug da Epic (página do jogo) ou productId da Microsoft Store.
 if (!providers.offline) {
  try {
   const s = game.store || {};
   if (store === 'epic' && s.namespace && !s.slug) { try { s.slug = await epicSlug(s.namespace, fetchImpl); } catch (e) { log('Epic (slug): ' + e.message); } }
   const values = store === 'epic' ? [s.slug, s.slug ? 'p/' + s.slug : ''] : [s.productId];
   const w = await wikidataSteamByStore(store, values, fetchImpl);
   if (w) { log('ID da loja ' + store + ' → Steam ' + w.appId + ' (Wikidata ' + w.qid + ': ' + w.name + ')'); return w; }
   // Sem o ID da loja na Wikidata: o mesmo jogo pelo nome (em inglês) no item de videogame da Wikidata.
   const byName = await wikidataSteamByName([game.storeTitleEn, game.title], fetchImpl);
   if (byName) { log('Nome da loja → Steam ' + byName.appId + ' (Wikidata ' + byName.qid + ': ' + byName.name + ')'); return byName; }
  } catch (e) { log('Wikidata (ID da loja): ' + e.message); }
 }
 // IGDB: o jogo cujo ID externo da loja bate; dele sai o ID externo da Steam (categoria 1).
 const cat = IGDB_STORE[store];
 if (cat && providers.igAvailable?.()) {
  try {
   const list = await providers.ig(`fields id,name,external_games.category,external_games.uid,external_games.external_game_source; where external_games.uid = (${ids.map(i => JSON.stringify(i)).join(',')}); limit 10;`);
   for (const g of Array.isArray(list) ? list : []) {
    const ext = g.external_games || [];
    const own = ext.some(e => ids.includes(String(e.uid)) && (Number(e.category ?? e.external_game_source) === cat));
    const steam = ext.find(e => Number(e.category ?? e.external_game_source) === 1 && /^\d{1,10}$/.test(String(e.uid)));
    if (own && steam) { log('ID da loja ' + store + ' → Steam ' + steam.uid + ' (IGDB: ' + g.name + ')'); return {appId: Number(steam.uid), source: 'igdb', name: g.name}; }
   }
  } catch (e) { log('IGDB (ID da loja): ' + e.message); }
 }
 // SteamGridDB: /games/<loja>/<id> e os dados da plataforma Steam do mesmo jogo.
 const plat = SGDB_STORE[store];
 if (plat && providers.sgAvailable?.()) {
  for (const id of ids) {
   try {
    const g = await providers.sg('games/' + plat + '/' + encodeURIComponent(id));
    const gid = Array.isArray(g) ? g[0]?.id : g?.id; if (!gid) continue;
    const full = await providers.sg('games/id/' + gid + '?platformdata=steam');
    const steam = (Array.isArray(full) ? full[0] : full)?.external_platform_data?.steam?.[0]?.id;
    if (/^\d{1,10}$/.test(String(steam || ''))) { log('ID da loja ' + store + ' → Steam ' + steam + ' (SteamGridDB)'); return {appId: Number(steam), source: 'sgdb', name: (Array.isArray(full) ? full[0] : full)?.name || ''}; }
   } catch {}
  }
 }
 return null;
}
