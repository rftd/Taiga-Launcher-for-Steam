// Qual é o jogo na Steam? (AppID) Decisão por evidências, da mais forte para a mais fraca:
//  1. Prova no próprio jogo: steam_appid.txt e configurações de emuladores do Steamworks (Goldberg, CODEX,
//     OnlineFix, CreamAPI...), procuradas também nas subpastas onde fica a steam_api(64).dll (Unity, Unreal);
//     ou o jogo instalado pela própria Steam (appmanifest da biblioteca).
//  2. Bancos que guardam o AppID de cada jogo, consultados pelo jogo já identificado: ID da loja (IGDB/SteamGridDB),
//     Wikidata (P1733), PCGamingWiki (Steam_AppID), IGDB (ID externo Steam) e SteamGridDB (plataforma Steam).
//  3. Busca da Steam pelo nome: só conta quando um único jogo base tem exatamente o mesmo nome.
//  4. Pastas de progresso dos emuladores (pasta com o AppID): só reforçam um candidato que já apareceu.
// Liga sozinho com prova (1) ou quando fontes independentes concordam; se elas discordarem, pede confirmação.
import fs from 'node:fs';
import path from 'node:path';
import {appIdFromFolder, isGameFolder} from './steam-appid-proof.mjs';
import {normalizeTitle, editionBase} from './title-match.mjs';

const W = {proof: 100, store: 90, wikidata: 80, pcgamingwiki: 80, igdb: 70, sgdb: 60, steam: 60, saves: 40};
const NAMES = {proof: 'arquivo do jogo', store: 'ID da loja', wikidata: 'Wikidata', pcgamingwiki: 'PCGamingWiki', igdb: 'IGDB', sgdb: 'SteamGridDB', steam: 'busca da Steam', saves: 'progresso salvo'};
const key = t => normalizeTitle(String(t || '').replace(/[™®©]/g, ''));
const isId = v => /^[1-9]\d{0,9}$/.test(String(v ?? '').trim()) && Number(v) < 2147483648;
const ids = v => String(v ?? '').split(/[,;\s]+/).filter(isId).map(Number);

// ── 1. Prova local: arquivos da pasta (steam-appid-proof.mjs) e appmanifest da biblioteca da Steam ──
export function localSteamProof(game) {
 const root = game.gameRoot || game.suggestedRoot || (game.path && /\.exe$/i.test(game.path) ? path.dirname(game.path) : '');
 if (!root) return null;
 const manifest = steamManifest(root); if (manifest) return manifest;
 if (!isGameFolder(root)) return null;
 try { return appIdFromFolder(root); } catch { return null; }
}
// Jogo dentro de steamapps\common\<pasta>: o appmanifest da mesma biblioteca diz o AppID.
export function steamManifest(dir) {
 const parts = path.resolve(dir).split(/[\\/]/), i = parts.findIndex((p, n) => /^common$/i.test(p) && /^steamapps$/i.test(parts[n - 1] || ''));
 if (i < 1 || !parts[i + 1]) return null;
 const apps = parts.slice(0, i).join(path.sep), folder = parts[i + 1].toLowerCase();
 let list = []; try { list = fs.readdirSync(apps).filter(f => /^appmanifest_\d+\.acf$/i.test(f)); } catch { return null; }
 for (const f of list) { try { const t = fs.readFileSync(path.join(apps, f), 'utf8'); const dirName = t.match(/"installdir"\s+"([^"]+)"/i)?.[1]; const id = t.match(/"appid"\s+"(\d+)"/i)?.[1]; if (dirName && id && dirName.toLowerCase() === folder) return {appId: Number(id), source: 'appmanifest'}; } catch {} }
 return null;
}

// ── 4. Pastas de progresso dos emuladores do Steamworks (nome da pasta = AppID) ──
export function saveDirAppIds(env = process.env) {
 const bases = [env.APPDATA && path.join(env.APPDATA, 'GSE Saves'), env.APPDATA && path.join(env.APPDATA, 'Goldberg SteamEmu Saves'), env.APPDATA && path.join(env.APPDATA, 'Steam', 'CODEX'), env.APPDATA && path.join(env.APPDATA, 'OnlineFix'), env.APPDATA && path.join(env.APPDATA, 'SmartSteamEmu'), env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'SKIDROW'), env.PUBLIC && path.join(env.PUBLIC, 'Documents', 'Steam', 'CODEX'), env.PUBLIC && path.join(env.PUBLIC, 'Documents', 'Steam', 'RUNE'), env.PUBLIC && path.join(env.PUBLIC, 'Documents', 'Steam', 'EMPRESS'), env.PUBLIC && path.join(env.PUBLIC, 'Documents', 'OnlineFix')].filter(Boolean);
 const out = new Set();
 for (const b of bases) { try { for (const e of fs.readdirSync(b, {withFileTypes: true})) if (e.isDirectory() && isId(e.name)) out.add(Number(e.name)); } catch {} }
 return out;
}

// ── 2. Bancos com o AppID ──
async function fromWikidata(game, providers) {
 const r = [];
 if (Array.isArray(game.wikiSteamAppIds) && game.wikiSteamAppIds.length) r.push(...game.wikiSteamAppIds.filter(isId).map(Number));
 else if (game.wikidataId && providers.wikidataSteamIds) r.push(...await providers.wikidataSteamIds(game.wikidataId));
 return r;
}
async function fromPCGamingWiki(titles, providers) {
 for (const t of titles) {
  const page = String(t).replace(/"/g, '');
  const r = await providers.request('https://www.pcgamingwiki.com/w/api.php?' + new URLSearchParams({action: 'cargoquery', tables: 'Infobox_game', fields: 'Infobox_game._pageName=Page,Infobox_game.Steam_AppID', where: `Infobox_game._pageName="${page}"`, format: 'json'}));
  for (const row of r?.cargoquery || []) { const v = row?.title?.['Steam AppID'] ?? row?.title?.Steam_AppID; const found = ids(v); if (found.length) return found; }
 }
 return [];
}
async function fromIGDB(titles, providers) {
 if (!providers.igAvailable?.()) return [];
 const list = await providers.ig(`fields name,external_games.category,external_games.external_game_source,external_games.uid; where name ~ ${JSON.stringify(titles[0])}; limit 5;`);
 const want = new Set(titles.map(key));
 for (const g of Array.isArray(list) ? list : []) { if (!want.has(key(g.name))) continue; const found = (g.external_games || []).filter(e => Number(e.category ?? e.external_game_source) === 1).flatMap(e => ids(e.uid)); if (found.length) return found; }
 return [];
}
async function fromSGDB(titles, providers) {
 if (!providers.sgAvailable?.()) return [];
 const list = await providers.sg('search/autocomplete/' + encodeURIComponent(titles[0]));
 const want = new Set(titles.map(key)), hit = (Array.isArray(list) ? list : []).find(g => want.has(key(g.name)));
 if (!hit?.id) return [];
 const full = await providers.sg('games/id/' + hit.id + '?platformdata=steam');
 return ((Array.isArray(full) ? full[0] : full)?.external_platform_data?.steam || []).flatMap(s => ids(s.id));
}

// Decisão final. sources: injeção para testes ({wikidata, pcgamingwiki, igdb, sgdb, store, steam}: async () => [ids]).
export async function resolveSteamAppId(game, {providers = {}, steamLink = null, storeLookup = null, env = process.env, log = () => {}, sources = null, verify = null, local = true, useSaves = true} = {}) {
 const title = String(game.title || '').replace(/[™®©]/g, '').trim();
 const base = [...new Set([game.storeTitleEn, title, game.wikiEnTitle, game.storeName, game.store?.title].filter(Boolean).map(t => String(t).replace(/[™®©]/g, '').trim()))];
 // Também o nome sem o sufixo de edição da loja ("Rise of the Tomb Raider: 20 Year Celebration" → "Rise of the Tomb Raider").
 const titles = [...new Set([...base, ...base.map(editionBase)])];
 if (local) { const proof = localSteamProof(game); if (proof && proof.appId !== 480) { log(`AppID ${proof.appId} pelo arquivo ${proof.source}.`); return {appId: proof.appId, confident: true, via: ['proof'], detail: proof.source, candidates: []}; } }
 const ask = sources || {
  store: async () => { if (!storeLookup || !game.store) return []; const r = await storeLookup(game); return r?.appId ? [r.appId] : []; },
  wikidata: () => fromWikidata(game, providers),
  pcgamingwiki: () => titles.length ? fromPCGamingWiki(titles, providers) : [],
  igdb: () => titles.length ? fromIGDB(titles, providers) : [],
  sgdb: () => titles.length ? fromSGDB(titles, providers) : [],
  steam: async () => { if (!steamLink || !titles.length) return []; for (const q of [...new Set([titles[0], editionBase(titles[0])])]) { const found = await steamLink.search(q); const exact = (found.items || []).filter(i => titles.some(t => key(t) === key(i.name))); if (exact.length === 1) return [exact[0].appId]; } return []; },
 };
 const votes = new Map(), add = (id, src) => { const v = votes.get(id) || {appId: id, score: 0, via: []}; if (v.via.includes(src)) return; v.score += W[src]; v.via.push(src); votes.set(id, v); };
 await Promise.all(Object.entries(ask).map(async ([src, fn]) => { try { const list = [...new Set(await fn())]; for (const id of list) add(id, src); if (list.length) log(`${NAMES[src]}: ${list.join(', ')}`); } catch (e) { log(`${NAMES[src]}: ${e.message}`); } }));
 if (!votes.size) return {appId: null, confident: false, via: [], candidates: []};
 const saves = useSaves ? saveDirAppIds(env) : new Set(); for (const id of votes.keys()) if (saves.has(id)) add(id, 'saves');
 // Confere cada candidato na loja: precisa ser um jogo base (não DLC, trilha sonora ou demo).
 const check = verify || (async id => { if (!steamLink) return {ok: true, name: ''}; try { const d = await steamLink.details(id); return {ok: true, name: d.name}; } catch { return {ok: false}; } });
 const list = [];
 for (const v of [...votes.values()].sort((a, b) => b.score - a.score).slice(0, 6)) { const c = await check(v.appId); if (!c.ok) continue; v.name = c.name || ''; v.exactName = !!c.name && titles.some(t => key(t) === key(c.name)); list.push(v); }
 list.sort((a, b) => b.score - a.score || Number(b.exactName) - Number(a.exactName));
 const [top, second] = list;
 if (!top) return {appId: null, confident: false, via: [], candidates: []};
 const independent = top.via.filter(s => s !== 'saves').length;
 const tieBroken = second && second.score === top.score && top.exactName && !second.exactName;
 // Outro AppID apontado por um banco com ID (não só pelo nome) é conflito, a menos que a diferença seja grande.
 const DB = ['store', 'wikidata', 'pcgamingwiki', 'igdb', 'sgdb'];
 const clear = !second || top.score - second.score >= 80 || (!second.via.some(s => DB.includes(s)) && (second.score < top.score || tieBroken));
 // Jogos da Epic quase sempre existem na Steam: nome idêntico a um único jogo base já basta, sem perguntar.
 const epic = game.store?.name === 'epic' || game.store?.label === 'Epic Games';
 const confident = clear && (top.score >= 140 || (epic && top.exactName && top.score >= 60) || (independent >= 1 && top.exactName && top.score >= 80) || (top.via.includes('store') && top.score >= 90));
 return {appId: confident ? top.appId : null, confident, via: top.via, name: top.name, candidates: list.map(v => ({appId: v.appId, title: v.name, score: Math.min(1, v.score / 200), via: v.via}))};
}
