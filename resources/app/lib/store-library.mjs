// Biblioteca das lojas (jogos da conta, instalados ou não), lida com o login que o usuário já fez no Taiga Launcher.
//  - Epic: o mesmo caminho do Legendary (legendary/core.py, get_game_and_dlc_list): a lista de "assets" do launcher
//    para Windows diz o que pode ser instalado no PC; o catálogo dá o nome, as imagens e se é DLC.
//    DLC, mods e conteúdo da Unreal Engine (namespace "ue") ficam de fora.
//  - Xbox: o histórico de títulos da conta (titlehub), como o Playnite: só jogos com versão para PC e nome de pacote.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher';
const ASSETS = 'https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/public/assets/Windows?label=Live';
const CATALOG = (ns, id, locale) => 'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace/' + encodeURIComponent(ns) + '/bulk/items?id=' + encodeURIComponent(id) + '&includeDLCDetails=true&includeMainGameDetails=true&country=US&locale=' + locale;
const LOCALE = {'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr', de: 'de'};

const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeJSON = (f, v) => { try { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); } catch {} };

async function getJSON(url, headers, fetchImpl) {
 const res = await fetchImpl(url, {headers: {'User-Agent': UA, Accept: 'application/json', ...headers}, signal: AbortSignal.timeout(30000)});
 if (!res.ok) throw Error('A loja respondeu HTTP ' + res.status + '.');
 return res.json();
}

// Imagens do catálogo da Epic: capa vertical, horizontal e logo.
export function epicImages(keyImages) {
 const pick = (...types) => { for (const t of types) { const k = (keyImages || []).find(x => x?.type === t && /^https:\/\//.test(String(x.url || ''))); if (k) return k.url; } return ''; };
 return {cover: pick('DieselGameBoxTall', 'OfferImageTall'), wide: pick('DieselGameBox', 'OfferImageWide', 'DieselStoreFrontWide'), logo: pick('DieselGameBoxLogo')};
}

// O item do catálogo é um jogo instalável (não DLC, não mod).
export function epicIsGame(item) {
 if (!item || item.mainGameItem) return false;
 const cats = (item.categories || []).map(c => String(c?.path || ''));
 if (cats.includes('mods') || cats.includes('addons') || cats.includes('digitalextras')) return false;
 return true;
}

export async function epicLibrary(auth, {fetchImpl = (...a) => fetch(...a), cacheDir, language = 'en'} = {}) {
 if (!auth?.accessToken) throw Error('Entre com a sua conta Epic em Contas.');
 const headers = {Authorization: 'bearer ' + auth.accessToken};
 const assets = await getJSON(ASSETS, headers, fetchImpl);
 const cacheFile = cacheDir ? path.join(cacheDir, 'epic-catalog.json') : '';
 const cache = (cacheFile && readJSON(cacheFile)) || {};
 const locale = LOCALE[language] || 'en-US', seen = new Set(), out = [], todo = [];
 for (const a of Array.isArray(assets) ? assets : []) {
  if (!a?.appName || !a.namespace || !a.catalogItemId || a.namespace === 'ue' || seen.has(a.appName)) continue;
  seen.add(a.appName); todo.push(a);
 }
 // Catálogo: no máximo 6 pedidos ao mesmo tempo; guardado para não perguntar de novo.
 let i = 0;
 const worker = async () => {
  while (i < todo.length) {
   const a = todo[i++], key = a.catalogItemId + '|' + locale;
   let item = cache[key];
   if (!item) { try { const d = await getJSON(CATALOG(a.namespace, a.catalogItemId, locale), headers, fetchImpl); const raw = d?.[a.catalogItemId]; item = raw ? {title: raw.title || '', keyImages: raw.keyImages || [], mainGameItem: raw.mainGameItem ? {id: raw.mainGameItem.id} : null, categories: raw.categories || [], developer: raw.developer || ''} : {missing: true}; cache[key] = item; } catch { continue; } }
   if (item.missing || !epicIsGame(item) || !item.title) continue;
   // Nome em inglês: é o que a Steam e os bancos de dados usam para achar o mesmo jogo.
   let titleEn = item.title;
   if (locale !== 'en-US') { const ek = a.catalogItemId + '|en-US'; let en = cache[ek]; if (!en) { try { const d = await getJSON(CATALOG(a.namespace, a.catalogItemId, 'en-US'), headers, fetchImpl); const raw = d?.[a.catalogItemId]; en = raw ? {title: raw.title || '', keyImages: raw.keyImages || [], mainGameItem: raw.mainGameItem ? {id: raw.mainGameItem.id} : null, categories: raw.categories || []} : {missing: true}; cache[ek] = en; } catch {} } if (en?.title) titleEn = en.title; }
   out.push({store: 'epic', storeName: 'Epic Games', id: a.catalogItemId, appName: a.appName, namespace: a.namespace, catalogItemId: a.catalogItemId, title: String(item.title).trim(), titleEn: String(titleEn).replace(/[™®©]/g, '').trim(), images: epicImages(item.keyImages), developer: item.developer || ''});
  }
 };
 await Promise.all(Array.from({length: 6}, worker));
 if (cacheFile) writeJSON(cacheFile, cache);
 return out.sort((x, y) => x.title.localeCompare(y.title));
}

// Xbox: títulos da conta com versão para PC (pacote da Microsoft Store).
export async function xboxLibrary(session, {fetchImpl = (...a) => fetch(...a), language = 'en'} = {}) {
 if (!session?.xsts?.token) throw Error('Entre com a sua conta Microsoft em Contas.');
 const lang = {'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE'}[language] || 'en-US';
 const url = 'https://titlehub.xboxlive.com/users/xuid(' + session.xsts.xuid + ')/titles/titlehistory/decoration/achievement,detail', auth = {Authorization: 'XBL3.0 x=' + session.xsts.uhs + ';' + session.xsts.token, 'x-xbl-contract-version': '2'};
 const d = await getJSON(url, {...auth, 'Accept-Language': lang}, fetchImpl);
 const list = xboxTitles(d?.titles);
 // Nome em inglês para achar o jogo na Steam.
 if (lang !== 'en-US') { try { const en = xboxTitles((await getJSON(url, {...auth, 'Accept-Language': 'en-US'}, fetchImpl))?.titles); const byPfn = new Map(en.map(x => [x.pfn.toLowerCase(), x.title])); for (const x of list) x.titleEn = byPfn.get(x.pfn.toLowerCase()) || x.title; } catch {} }
 return list;
}
export function xboxTitles(titles) {
 const out = [], seen = new Set();
 for (const t of Array.isArray(titles) ? titles : []) {
  const pfn = String(t?.pfn || ''), devices = (t?.devices || []).map(String);
  if (!pfn || !devices.includes('PC') || (t.type && t.type !== 'Game') || seen.has(pfn.toLowerCase())) continue;
  seen.add(pfn.toLowerCase());
  const productId = String(t.detail?.productId || t.productId || '').trim();
  out.push({store: 'xbox', storeName: 'Xbox', id: pfn.split('_')[0], pfn, titleId: String(t.titleId || ''), productId: /^[0-9A-Z]{12}$/i.test(productId) ? productId : '', title: String(t.name || '').trim(), images: {cover: /^https:\/\//.test(String(t.displayImage || '')) ? t.displayImage : ''}});
 }
 return out.filter(x => x.title);
}
// Link que abre o jogo no app Xbox (ou na Microsoft Store quando falta o productId).
export const xboxStoreLink = item => item.productId ? 'msxbox://game/?productId=' + item.productId : 'ms-windows-store://pdp/?PFN=' + item.pfn;
// Link que abre a instalação do jogo no Epic Games Launcher.
export const epicInstallLink = item => 'com.epicgames.launcher://apps/' + encodeURIComponent(item.namespace) + '%3A' + encodeURIComponent(item.catalogItemId) + '%3A' + encodeURIComponent(item.appName) + '?action=install';
