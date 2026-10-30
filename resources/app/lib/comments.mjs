// Comentários dos jogos sem página na Steam (emuladores, ports), guardados no servidor do Taiga Launcher.
// Segurança (o que sai e o que entra no PC):
//  - Sai só: a chave do jogo (ex.: "ra:1234", sem nome de arquivo nem pasta), o texto do comentário e a sessão.
//  - Login pelo OpenID oficial da Steam numa página da própria Steam; aqui chega só uma sessão (guardada cifrada pelo
//    Windows, como as outras contas). A senha da Steam nunca passa pelo Taiga Launcher.
//  - A sessão fica só neste processo: a página da Steam pede os comentários ao Taiga Launcher, nunca vê a sessão.
//  - Tudo o que vem do servidor é conferido (formato, tamanho, endereços de imagem da Steam) antes de chegar à página,
//    que mostra como texto puro. Nada vindo do servidor é aberto, baixado ou executado.
import crypto from 'node:crypto';
import {editionBase} from './title-match.mjs';

const ID_RE = /^\d{1,12}$/;
const STEAMID_RE = /^7656\d{13}$/;
const AVATAR_RE = /^https:\/\/avatars\.(?:akamai\.|cloudflare\.|fastly\.)?steamstatic\.com\/[a-f0-9]{40}(?:_full|_medium)?\.jpg$/;
const DEFAULT_AVATAR = 'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[™®©]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Mesma chave para todos que têm o mesmo jogo, em qualquer versão: nome do jogo (sem ™/®, sem região entre
// parênteses, sem "Edição X", numerais romanos iguais aos números) + plataforma original. Um port (God of War III no
// SpartanPort, qualquer versão do .exe) e o mesmo jogo num emulador caem na mesma conversa.
// O número do RetroAchievements ou do IGDB não entra: nem todo mundo tem (depende de conta e de busca), e isso
// separaria as pessoas. O código do disco só é usado quando não há nome.
const ROMAN = {ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15};
const PLATFORM_NAMES = [[/playstation\s*5|^ps5$/i, 'ps5'], [/playstation\s*4|^ps4$/i, 'ps4'], [/playstation\s*3|^ps3$/i, 'ps3'], [/playstation\s*2|^ps2$/i, 'ps2'], [/playstation\s*portable|^psp$/i, 'psp'], [/playstation\s*vita|^vita$|^psvita$/i, 'vita'], [/^playstation$|^ps1$|^psx$/i, 'ps1']];
export function commentPlatform(value) {
 const v = String(value || '').trim(); if (!v) return '';
 for (const [re, key] of PLATFORM_NAMES) if (re.test(v)) return key;
 return v.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
}
export function commentTitle(value) {
 let t = editionBase(String(value || '').replace(/[™®©]/g, '')).replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ');
 t = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
 return t.split(' ').map(w => ROMAN[w] ? String(ROMAN[w]) : w).join('-').slice(0, 80);
}
export function gameCommentKey(g, {title = '', platform = ''} = {}) {
 if (!g) return '';
 const plat = commentPlatform(platform || g.platformKey || g.platformName) || (['pc', 'custom', 'store'].includes(g.profile || '') ? 'pc' : commentPlatform(g.profile)) || 'pc';
 const name = commentTitle(title || g.canonicalName || g.title);
 if (name) return 'title:' + plat + ':' + name;
 const serial = String(g.serial || g.discId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
 return /^[A-Z]{4}\d{5}$/.test(serial) ? 'serial:' + plat + ':' + serial.toLowerCase() : '';
}

const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, '').slice(0, max);
// Comentário vindo do servidor, só com campos esperados e conferidos.
export function safeComment(c) {
 if (!c || typeof c !== 'object' || !ID_RE.test(String(c.id)) || !STEAMID_RE.test(String(c.steamid))) return null;
 const at = Number(c.at); if (!Number.isFinite(at) || at <= 0) return null;
 const body = clean(c.body, 1200).trim(); if (!body) return null;
 return {id: String(c.id), steamid: String(c.steamid), at, body, lang: /^(pt|en|es|fr|de)$/.test(String(c.lang || '')) ? String(c.lang) : null, likes: Math.max(0, Math.floor(Number(c.likes) || 0)), liked: c.liked === true, name: clean(c.name, 64).trim() || String(c.steamid), avatar: AVATAR_RE.test(String(c.avatar || '')) ? String(c.avatar) : DEFAULT_AVATAR};
}
const safeMe = a => a && STEAMID_RE.test(String(a.steamid)) ? {steamid: String(a.steamid), name: clean(a.name, 64).trim() || String(a.steamid), avatar: AVATAR_RE.test(String(a.avatar || '')) ? String(a.avatar) : DEFAULT_AVATAR, level: Number.isFinite(Number(a.level)) && a.level !== null ? Number(a.level) : null, public: !!a.public} : null;

// Idioma do programa nos comentários: pt, en, es, fr ou de.
export const commentLang = language => { const l = String(language || '').toLowerCase().slice(0, 2); return ['pt', 'en', 'es', 'fr', 'de'].includes(l) ? l : 'en'; };
export function createComments({server, config, saveConfig, fetchImpl = (...a) => fetch(...a), log = () => {}}) {
 let login = null;
 // Comentários vistos há pouco (para traduzir pelo número, sem a página mandar texto qualquer).
 const seen = new Map();
 const remember = items => { for (const c of items) { seen.delete(c.id); seen.set(c.id, {body: c.body, lang: c.lang}); } while (seen.size > 600) seen.delete(seen.keys().next().value); return items; };
 // Listas recentes guardadas por 20 s (a página na janela normal e no Big Picture pedem a mesma coisa): menos
 // consultas ao servidor e resposta na hora. Publicar, curtir, apagar ou denunciar limpa o que estava guardado.
 const lists = new Map();
 const forget = () => lists.clear();
 const base = () => { const u = String(server() || '').replace(/\/+$/, ''); return /^https:\/\//.test(u) ? u : ''; };
 const auth = () => { const a = config().commentsAuth; return a && /^[0-9a-f]{64}$/.test(String(a.token || '')) && STEAMID_RE.test(String(a.steamid || '')) ? a : null; };
 async function call(method, path, body, {token = auth()?.token, timeout = 10000} = {}) {
  const url = base(); if (!url) throw Object.assign(Error('not_configured'), {code: 'not_configured'});
  let res;
  try { res = await fetchImpl(url + path, {method, headers: {'content-type': 'application/json', ...(token ? {authorization: 'Bearer ' + token} : {})}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeout), redirect: 'error'}); }
  catch (e) { log('Comentários: ' + method + ' ' + path.split('?')[0] + ' sem resposta (' + String(e?.cause?.code || e?.cause?.message || e?.message || e).slice(0, 160) + ').'); throw Object.assign(Error('offline'), {code: 'offline'}); }
  const text = await res.text(); if (text.length > 512 * 1024) throw Object.assign(Error('offline'), {code: 'offline'});
  let data = {}; try { data = JSON.parse(text || '{}'); } catch { data = {}; }
  if (!res.ok) {
   let code = /^[a-z_]{2,32}$/.test(String(data.error || '')) ? data.error : 'offline';
   // Limite diário do plano grátis da Cloudflare (D1): volta sozinho na virada do dia (UTC).
   if (code === 'server' && /daily|limit|exceeded|quota/i.test(String(data.message || ''))) code = 'quota';
   if (!['login', 'low_level', 'private_profile', 'slow_down', 'daily_limit', 'no_links', 'too_long', 'duplicate', 'own', 'pending'].includes(code)) log('Comentários: ' + method + ' ' + path.split('?')[0] + ' respondeu ' + res.status + ' (' + code + (data.message ? ': ' + String(data.message).slice(0, 160) : '') + ').');
   // Sessão recusada pelo servidor (saiu em outro lugar, conta bloqueada): esquece a sessão.
   if (res.status === 401 && code === 'login' && config().commentsAuth) { config().commentsAuth = null; saveConfig(); }
   throw Object.assign(Error(code), {code, minLevel: Number(data.minLevel) || null, wait: Number(data.wait) || null, detail: code === 'server' || code === 'quota' ? String(data.message || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 160) : ''});
  }
  return data;
 }
 return {
  state() { const a = auth(); return {available: !!base(), loggedIn: !!a, me: a ? safeMe(a) : null, pending: !!login && Date.now() - login.at < 10 * 60000}; },
  // Login: código de uso único + segredo que só este programa conhece. A página da Steam confirma a conta e o
  // programa busca a sessão sozinho (nenhuma porta aberta no PC).
  async startLogin() {
   const id = crypto.randomBytes(16).toString('hex'), verifier = crypto.randomBytes(32).toString('hex'), challenge = crypto.createHash('sha256').update(verifier).digest('hex');
   const r = await call('POST', '/v1/auth/start', {id, challenge}, {token: null});
   // O endereço de login tem de ser o do próprio servidor do Taiga (mesmo endereço, rota de login, mesmo código).
   const url = String(r.url || ''); let ok = false;
   try { const u = new URL(url), b = new URL(base()); ok = u.protocol === 'https:' && u.hostname.toLowerCase() === b.hostname.toLowerCase() && u.pathname.endsWith('/v1/auth/steam') && u.searchParams.get('id') === id; } catch {}
   if (!ok) { log('Comentários: endereço de login inesperado (' + url.slice(0, 160) + ').'); throw Object.assign(Error('offline'), {code: 'offline'}); }
   const job = login = {id, verifier, at: Date.now()};
   (async () => {
    while (login === job && Date.now() - job.at < 10 * 60000) {
     await new Promise(r => setTimeout(r, 2000));
     if (login !== job) return;
     try {
      const p = await call('POST', '/v1/auth/poll', {id, verifier}, {token: null});
      if (p.pending) continue;
      const me = safeMe(p); if (!me || !/^[0-9a-f]{64}$/.test(String(p.token || ''))) break;
      config().commentsAuth = {token: String(p.token), ...me, at: new Date().toISOString()}; saveConfig();
      log('Comentários: conta Steam conectada (' + me.name + ').');
      break;
     } catch (e) { if (e.code === 'expired') break; }
    }
    if (login === job) login = null;
   })().catch(() => {});
   return {url};
  },
  async logout() { forget(); login = null; const a = auth(); if (a) { try { await call('POST', '/v1/auth/logout', {}, {token: a.token}); } catch {} } config().commentsAuth = null; saveConfig(); return {ok: true}; },
  async refreshMe() { const a = auth(); if (!a) return null; try { const me = safeMe(await call('GET', '/v1/auth/me')); if (me) { config().commentsAuth = {...a, ...me}; saveConfig(); } return me; } catch { return safeMe(a); } },
  async list(key, {sort = 'recent', offset = 0, lang = '', all = false} = {}) {
   if (!/^[a-z]{2,8}:[a-z0-9._:-]{1,100}$/.test(String(key || ''))) throw Object.assign(Error('game'), {code: 'game'});
   const l = /^(pt|en|es|fr|de)$/.test(String(lang)) ? String(lang) : '';
   const ck = [key, sort, offset, l, all ? 1 : 0, auth()?.steamid || ''].join('|'), hit = lists.get(ck);
   if (hit && Date.now() - hit.at < 20000) return hit.value;
   const pending = (async () => {
   const r = await call('GET', '/v1/comments?game=' + encodeURIComponent(key) + (sort === 'popular' ? '&sort=popular' : '') + (offset > 0 ? '&offset=' + Math.min(2000, Math.floor(Number(offset))) : '') + (l ? '&lang=' + l : '') + (all ? '&all=1' : ''));
   const items = remember((Array.isArray(r.items) ? r.items : []).slice(0, 50).map(safeComment).filter(Boolean));
   return {items, more: !!r.more, total: Number.isFinite(Number(r.total)) ? Number(r.total) : null, others: Number.isFinite(Number(r.others)) ? Math.max(0, Number(r.others)) : null, minLevel: Number.isFinite(Number(r.minLevel)) ? Number(r.minLevel) : null};
   })();
   lists.set(ck, {at: Date.now(), value: pending});
   pending.catch(() => { if (lists.get(ck)?.value === pending) lists.delete(ck); });
   if (lists.size > 200) lists.delete(lists.keys().next().value);
   return pending;
  },
  seenComment(id) { return seen.get(String(id)) || null; },
  async like(id, on = true) { forget(); if (!auth()) throw Object.assign(Error('login'), {code: 'login'}); if (!ID_RE.test(String(id))) throw Object.assign(Error('not_found'), {code: 'not_found'}); const r = await call('POST', '/v1/comments/' + id + '/like', {like: !!on}); return {ok: true, likes: Math.max(0, Math.floor(Number(r.likes) || 0)), liked: !!r.liked}; },
  async post(key, text, lang = '') { forget();
   if (!auth()) throw Object.assign(Error('login'), {code: 'login'});
   const body = String(text || '').trim(); if (!body) throw Object.assign(Error('empty'), {code: 'empty'}); if ([...body].length > 500) throw Object.assign(Error('too_long'), {code: 'too_long'});
   const r = await call('POST', '/v1/comments', {game: key, text: body, ...(/^(pt|en|es|fr|de)$/.test(String(lang)) ? {lang: String(lang)} : {})});
   const item = safeComment(r.item); if (!item) throw Object.assign(Error('offline'), {code: 'offline'}); remember([item]); return {item};
  },
  async remove(id) { forget(); if (!ID_RE.test(String(id))) throw Object.assign(Error('not_found'), {code: 'not_found'}); await call('DELETE', '/v1/comments/' + id); return {ok: true}; },
  async report(id) { forget(); if (!ID_RE.test(String(id))) throw Object.assign(Error('not_found'), {code: 'not_found'}); return {ok: true, hidden: !!(await call('POST', '/v1/comments/' + id + '/report', {})).hidden}; },
 };
}
