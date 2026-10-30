// Identificação automática de jogos importados, do sinal mais forte ao mais fraco:
// 1. conteúdo do arquivo (serial/cabeçalho) conferido nos bancos Redump/No-Intro;
// 2. hash do dump reconhecido pelo RetroAchievements (sem conta);
// 3. jogos de PC: steam_appid.txt ou busca pública da Steam pelo nome da pasta/executável;
// 4. busca IGDB/SteamGridDB filtrada pela plataforma detectada, com pontuação.
// Só aceita sem perguntar quando a evidência é forte e não há empate entre versões.
import fs from 'node:fs';
import path from 'node:path';
import {platformByKey} from './platforms.mjs';
import {cleanPCTitle} from './rom-name.mjs';
import {scoreCandidate, confidentChoice, normalizeTitle, similarity, editionBase} from './title-match.mjs';

// Redump/No-Intro trocam ":" por " - "; para exibição, volta ao formato usual.
export function displayTitle(datTitle) {
 const t = String(datTitle || '').trim();
 return t.replace(/^(.+?) - (.+)$/, (m, a, b) => /\d$/.test(a) && /^\d/.test(b) ? m : a + ': ' + b);
}
const exists = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
// Evidência direta do AppID na pasta do jogo (sinais usados pelo NativeGameLink e pelos emuladores de Steam):
// steam_appid.txt, configurações do Goldberg/GSE, CODEX/RUNE (steam_emu.ini), CreamAPI, OnlineFix, ALI213, SmartSteamEmu.
const APPID_INI = ['steam_emu.ini', 'ColdClientLoader.ini', 'cream_api.ini', 'OnlineFix.ini', 'ALI213.ini', 'SmartSteamEmu.ini', 'steam_api.ini', 'CODEX.ini', 'RUNE.ini', path.join('steam_settings', 'configs.app.ini'), path.join('steam_settings', 'configs.main.ini')];
export function appIdFromIni(text) { const m = String(text || '').match(/^\s*(?:Real)?App[_ ]?I[Dd]\s*=\s*"?([1-9]\d{0,9})"?\s*$/mi); return m ? Number(m[1]) : null; }
export function steamAppIdEvidence(dir) {
 for (const name of ['steam_appid.txt', path.join('steam_settings', 'steam_appid.txt')]) {
  const f = path.join(dir, name);
  if (exists(f) && fs.statSync(f).size < 32) { const text = fs.readFileSync(f, 'utf8').trim(); if (/^[1-9]\d{0,9}$/.test(text)) return {appId: Number(text), source: name}; }
 }
 for (const name of APPID_INI) { const f = path.join(dir, name); if (exists(f) && fs.statSync(f).size < 64 * 1024) { const id = appIdFromIni(fs.readFileSync(f, 'utf8')); if (id) return {appId: id, source: name}; } }
 return null;
}
export function steamAppIdNear(file, root = null) {
 let dir = path.dirname(file);
 for (let i = 0; i < 4 && dir; i++) {
  const found = steamAppIdEvidence(dir); if (found) return found.appId;
  if (root && path.resolve(dir).toLowerCase() === path.resolve(root).toLowerCase()) break;
  const up = path.dirname(dir); if (up === dir) break; dir = up;
 }
 return null;
}
// Nomes candidatos de um jogo de PC: ProductName do executável, pasta do jogo e nome do .exe.
export function pcNames(item) {
 const names = [];
 if (item.storeTitleEn) names.push(item.storeTitleEn);
 if (item.identitySource === 'PE ProductName' && item.internalTitle) names.push(item.internalTitle);
 const root = item.gameRoot || item.suggestedRoot;
 if (item.engineProduct) names.push(item.engineProduct);
 if (item.title) names.push(item.title);
 // Nome sem o sufixo de edição da loja ("20 Year Celebration", "Definitive Edition"...).
 for (const t of [item.storeTitleEn, item.title]) if (t && editionBase(t) !== String(t).replace(/[™®©]/g, '').trim()) names.push(editionBase(t));
 if (root) names.push(cleanPCTitle(path.basename(root)));
 const exe = path.basename(item.path, path.extname(item.path)), shipping = exe.match(/^(.+?)-(?:Win64|Win32|WinGDK)-Shipping$/i);
 if (shipping) names.push(cleanPCTitle(shipping[1].replace(/([a-z])([A-Z])/g, '$1 $2')));
 const parts = path.dirname(item.path).split(/[\\/]/), bin = parts.findIndex(p => /^binaries$/i.test(p));
 if (bin > 0) names.push(cleanPCTitle(parts[bin - 1]));
 if (bin > 1) names.push(cleanPCTitle(parts[bin - 2]));
 names.push(cleanPCTitle(exe.replace(/-(?:Win64|Win32|WinGDK)-Shipping$/i, '')));
 const seen = new Set();
 return names.filter(n => n && n.length > 1 && !/^(?:game|games|launcher|start|play|bin|binaries|win64|win32|x64|release|steam|common|content|engine|program files)$/i.test(n) && !seen.has(normalizeTitle(n)) && seen.add(normalizeTitle(n)));
}

export async function identifyLocal(item, {providers, autoLookup = true}) {
 const out = {automatic: false, reasons: [], confidence: 0};
 const platform = platformByKey(item.platformKey);
 if (!platform || autoLookup === false) return out;
 // 1) Banco de dumps verificados.
 const dat = platform.dat?.length ? await providers.datLookup?.(platform, item) : null;
 if (dat) {
  item.dat = {name: dat.name, title: displayTitle(dat.title), by: dat.by, confidence: dat.confidence, region: dat.region, serial: dat.serials?.[0] || '', ambiguous: !!dat.ambiguous};
  if (dat.confidence >= .95 && !dat.ambiguous) {
   // Título interno confiável (PARAM.SFO, cabeçalho de disco) continua; senão usa o canônico.
   if (!(item.identitySource && item.internalTitle && item.platformKey !== 'gba' && item.platformKey !== 'nds')) item.title = item.dat.title;
   item.canonicalName = dat.name;
   out.automatic = true; out.confidence = dat.confidence;
   out.reasons.push(dat.by.startsWith('serial') ? 'Código do jogo conferido no banco Redump/No-Intro' : dat.by === 'size' ? 'Tamanho exato conferido no banco de dumps' : 'Arquivo conferido no banco de dumps (CRC/MD5)');
  } else if (dat.confidence >= .8 && !dat.ambiguous && similarity(dat.title, item.fileTitle || item.title) >= .9) {
   item.title = item.dat.title; item.canonicalName = dat.name;
   out.automatic = true; out.confidence = .9; out.reasons.push('Nome do arquivo corresponde ao banco de dumps');
  }
 }
 // 2) Hash RetroAchievements (identifica o dump exato e o conjunto de conquistas).
 if (item.raHash && platform.ra) {
  const id = await providers.raGameId?.(item.raHash, platform);
  if (id) { item.raId = id; out.reasons.push('Conjunto RetroAchievements reconhecido pelo hash'); if (!out.automatic) { out.automatic = true; out.confidence = .97; } }
 }
 return out;
}

export async function identifyPC(item, {steamLink, autoLookup = true}) {
 const out = {automatic: false, reasons: [], suggestions: []};
 if (item.profile !== 'pc' || item.auxiliary) return out;
 const appId = steamAppIdNear(item.path, item.gameRoot || item.suggestedRoot);
 if (appId) { item.steamAppId = appId; out.reasons.push('steam_appid.txt encontrado na pasta do jogo'); }
 if (autoLookup === false || !steamLink) return out;
 const names = pcNames(item);
 try {
  if (appId) {
   const details = await steamLink.details(appId);
   if (details?.name) { item.title = details.name; item.steamName = details.name; out.automatic = true; }
   return out;
  }
  for (const name of names.slice(0, 2)) {
   const found = await steamLink.search(name);
   const scored = (found.items || []).map(r => ({...r, ...scoreCandidate(name, r.name, {})}));
   out.suggestions.push(...scored.filter(s => s.score >= .6));
   const choice = confidentChoice(scored, {min: .95, gap: .1});
   // Exige o mesmo nome em pelo menos duas fontes (ProductName/pasta/exe) ou um nome não genérico exato.
   const agreeing = names.filter(n => choice && normalizeTitle(n) === normalizeTitle(choice.name)).length;
   if (choice && choice.exact && (agreeing >= 2 || item.identitySource === 'PE ProductName' && normalizeTitle(item.internalTitle) === normalizeTitle(choice.name))) {
    item.steamAppId = choice.appId; item.steamName = choice.name; item.title = choice.name;
    out.automatic = true; out.reasons.push('Nome confirmado na loja Steam'); break;
   }
  }
 } catch {}
 const seen = new Set(); out.suggestions = out.suggestions.sort((a, b) => b.score - a.score).filter(s => !seen.has(s.appId) && seen.add(s.appId)).slice(0, 6);
 return out;
}

// Detecção do AppID pelo nome (jogos de PC e de outras lojas já cadastrados): várias fontes de nome,
// candidato exato e sem empate; com dois nomes concordando ou com o título já identificado.
export async function steamAppByName(item, steamLink) {
 const names = pcNames(item).slice(0, 5), seen = new Map();
 for (const name of names) {
  const found = await steamLink.search(name);
  const scored = (found.items || []).map(r => ({...r, ...scoreCandidate(name, r.name, {})}));
  for (const s of scored) { const old = seen.get(s.appId); if (!old || s.score > old.score) seen.set(s.appId, {...s, hits: (old?.hits || 0) + (s.exact ? 1 : 0)}); else if (s.exact) old.hits++; }
  const choice = confidentChoice(scored, {min: .95, gap: .1});
  if (choice?.exact) {
   const agreeing = names.filter(n => normalizeTitle(n) === normalizeTitle(choice.name)).length;
   const sameTitle = item.title && normalizeTitle(item.title) === normalizeTitle(choice.name) && ['igdb', 'manual', 'dat'].includes(item.titleSource);
   // Nome do produto gravado pelo motor do jogo (Unity app.info) igual ao da Steam também confirma.
   const engine = item.engineProduct && normalizeTitle(item.engineProduct) === normalizeTitle(choice.name);
   // Jogo de loja: o nome da loja sem o sufixo de edição igual ao nome na Steam também confirma.
   const edition = !!item.store && [item.storeTitleEn, item.storeName, item.title].some(t => t && normalizeTitle(editionBase(t)) === normalizeTitle(choice.name));
   if (agreeing >= 2 || sameTitle || engine || edition || item.storeName && normalizeTitle(item.storeName) === normalizeTitle(choice.name)) return {appId: choice.appId, name: choice.name, confident: true, candidates: [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 6)};
  }
 }
 return {appId: null, confident: false, candidates: [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 6)};
}
