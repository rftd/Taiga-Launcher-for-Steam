/* Taiga Launcher, jogos do Taiga Launcher no seu perfil da Comunidade Steam (dentro do cliente da Steam).
 * - Perfil: o número de "Jogos" soma os jogos adicionados pelo Taiga Launcher.
 * - Jogos (Todos, Recém-jogados, Concluídos): cartões iguais aos da Steam, com tempo de jogo, última sessão,
 *   barra de conquistas e troféu de jogo completo. Os contadores das abas também somam.
 * - Conquistas: página igual à da Steam, montada a partir de uma página de conquistas real do seu perfil.
 * Só no SEU perfil. A marcação é copiada da própria página (cartão/linhas reais) para acompanhar o visual atual
 * da Steam; os modelos guardados no Taiga Launcher só são usados quando a página não tem um cartão para copiar. */
(function () {
 'use strict';
 if (window.__TAIGA_COMMUNITY__) { try { window.__TAIGA_COMMUNITY__.kick(); } catch (e) {} return; }
 const STATE = window.__TAIGA_COMMUNITY__ = {kick: () => schedule(0), images: new Map(), rows: new Map()};
 const FB = window.__TAIGA_COMMUNITY_FALLBACK__ || {};
 const HASH = 'taiga-ach=';

 // ── ponte com o Taiga Launcher (binding do DevTools, só leitura) ──
 const pending = new Map(); let nextId = 1;
 window.__taiga_ffi_resolve__ = function (id, ok, payload) { const p = pending.get(id); if (!p) return; pending.delete(id); ok ? p.resolve(payload) : p.reject(new Error(String(payload || 'erro'))); };
 function call(method, args) {
  return new Promise((resolve, reject) => {
   if (typeof window.__taiga_ffi__ !== 'function') { reject(new Error('bridge')); return; }
   const id = nextId++; pending.set(id, {resolve, reject});
   setTimeout(() => { if (pending.delete(id)) reject(new Error('timeout')); }, 60000);
   try { window.__taiga_ffi__(JSON.stringify({id, method, args: args || {}})); } catch (e) { pending.delete(id); reject(e); }
  }).then(text => JSON.parse(text));
 }

 // ── idioma: o escolhido no Taiga Launcher (vem com os dados) ──
 const DICT = {
  pt: {missing: 'Exibir as que faltam', last: 'ÚLTIMA SESSÃO', mine: 'Minhas conquistas', locked: 'CONQUISTAS NÃO ALCANÇADAS', unlocked: 'CONQUISTAS ALCANÇADAS', on: 'Alcançada em ', hour: 'hora', hours: 'horas', minute: 'minuto', minutes: 'minutos'},
  en: {missing: 'Show only missing', last: 'LAST PLAYED', mine: 'My Achievements', locked: 'LOCKED ACHIEVEMENTS', unlocked: 'UNLOCKED ACHIEVEMENTS', on: 'Unlocked ', hour: 'hour', hours: 'hours', minute: 'minute', minutes: 'minutes'},
  es: {missing: 'Mostrar las que faltan', last: 'ÚLTIMA SESIÓN', mine: 'Mis logros', locked: 'LOGROS NO OBTENIDOS', unlocked: 'LOGROS OBTENIDOS', on: 'Obtenido el ', hour: 'hora', hours: 'horas', minute: 'minuto', minutes: 'minutos'},
  fr: {missing: 'Afficher celles qui manquent', last: 'DERNIÈRE SESSION', mine: 'Mes succès', locked: 'SUCCÈS NON DÉBLOQUÉS', unlocked: 'SUCCÈS DÉBLOQUÉS', on: 'Débloqué le ', hour: 'heure', hours: 'heures', minute: 'minute', minutes: 'minutes'},
  de: {missing: 'Nur fehlende anzeigen', last: 'ZULETZT GESPIELT', mine: 'Meine Errungenschaften', locked: 'NICHT FREIGESCHALTETE ERRUNGENSCHAFTEN', unlocked: 'FREIGESCHALTETE ERRUNGENSCHAFTEN', on: 'Freigeschaltet am ', hour: 'Stunde', hours: 'Stunden', minute: 'Minute', minutes: 'Minuten'},
 };
 let LANG = 'pt-br', LOCALE = 'pt-BR', L = DICT.pt;
 function setLang(code) { const c = String(code || 'pt-BR'); LOCALE = /^pt/i.test(c) ? 'pt-BR' : c; LANG = LOCALE.toLowerCase(); L = DICT[LANG.slice(0, 2)] || DICT.en; }
 const num = (v, digits = 0) => { try { return new Intl.NumberFormat(LOCALE, {maximumFractionDigits: digits}).format(v); } catch (e) { return String(v); } };
 function fmtPlay(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return num(m) + ' ' + (m === 1 ? L.minute : L.minutes);
  const h = Math.round(m / 6) / 10; return num(h, 1) + ' ' + (h === 1 ? L.hour : L.hours);
 }
 function fmtDay(seconds) {
  const d = new Date(Number(seconds) * 1000); if (!Number(seconds)) return '';
  try { return new Intl.DateTimeFormat(LOCALE, {day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'}).format(d); } catch (e) { return d.toLocaleDateString(); }
 }
 function fmtDateTime(iso) { const d = new Date(iso); if (isNaN(d)) return ''; try { return new Intl.DateTimeFormat(LOCALE, {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(d); } catch (e) { return d.toLocaleString(); } }
 const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

 // ── dados e perfil ──
 // Os dados ficam guardados no navegador: ao abrir a página, os números e cartões aparecem na hora e são
 // conferidos com o Taiga Launcher logo em seguida.
 // Guardado sem os ícones das conquistas (que são imagens): fica pequeno, cabe sempre no navegador e abre na hora.
 const CACHE = 'taiga-community-cache-v2';
 let DATA = null, dataAt = 0, refreshing = null;
 try { localStorage.removeItem('taiga-community-cache-v1'); } catch (e) {}
 try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (c && Array.isArray(c.games)) { DATA = c; setLang(c.language); } } catch (e) {}
 function slim(d) { return {...d, pendingIcons: undefined, games: (d.games || []).map(g => ({...g, achievements: {...g.achievements, recentIcons: []}}))}; }
 function refresh() {
  if (!refreshing) refreshing = call('community_games').then(d => {
   // A assinatura vem pronta do Taiga Launcher: sem comparar a lista inteira a cada atualização.
   const changed = !DATA || !d.sig || d.sig !== DATA.sig || DATA.slim; DATA = d; dataAt = Date.now(); setLang(d.language);
   if (changed) { try { localStorage.setItem(CACHE, JSON.stringify({...slim(d), slim: true})); } catch (e) {} schedule(0); }
   if (d && d.pendingIcons && !STATE.iconRetry) { STATE.iconRetry = setTimeout(() => { STATE.iconRetry = null; refresh().catch(() => {}); }, 2500); }
   return d;
  }).finally(() => { refreshing = null; });
  return refreshing;
 }
 async function data(force) {
  if (DATA && !force && Date.now() - dataAt < 60000) return DATA;
  if (DATA && !force) { refresh().catch(() => {}); return DATA; }
  return refresh();
 }
 function profileBase() { const m = location.pathname.match(/^\/(id|profiles)\/[^/]+/); return m ? m[0] : ''; }
 // SteamID do dono do perfil aberto (endereço /profiles/<id>, página clássica ou /id/<nome> via ?xml=1, guardado).
 async function profileSteamId() {
  const m = location.pathname.match(/^\/(id|profiles)\/([^/?#]+)/); if (!m) return '';
  if (m[1] === 'profiles') return /^\d{17}$/.test(m[2]) ? m[2] : '';
  const key = 'taiga-vanity:' + m[2].toLowerCase();
  if (STATE.pageSidFor === key && STATE.pageSid) return STATE.pageSid;
  // 1) já conhecido (na hora); 2) dados do próprio perfil na página; 3) só com a página carregada, pergunta à Steam.
  let sid = ''; try { sid = localStorage.getItem(key) || ''; } catch (e) {}
  if (!sid && route() === 'profile') { for (const sc of document.scripts) { const p = (sc.textContent || '').match(/g_rgProfileData\s*=\s*\{[^]*?"steamid"\s*:\s*"(\d{17})"/); if (p) { sid = p[1]; break; } } }
  if (!sid && document.readyState !== 'loading') { try { const t = await (await fetch('/id/' + encodeURIComponent(m[2]) + '/?xml=1', {credentials: 'include'})).text(); sid = (t.match(/<steamID64>(\d{17})<\/steamID64>/) || [])[1] || ''; } catch (e) {} }
  if (sid) { STATE.pageSid = sid; STATE.pageSidFor = key; try { localStorage.setItem(key, sid); } catch (e) {} }
  return sid;
 }
 // Perfil de um amigo que também usa o Taiga Launcher (só existe com um servidor de perfis configurado).
 const friends = new Map();
 async function friendData(sid) {
  const hit = friends.get(sid); if (hit && Date.now() - hit.at < 600000) return hit.value;
  let value = {games: []}; try { value = await call('community_friend', {steamId: sid}); } catch (e) {}
  friends.set(sid, {at: Date.now(), value}); return value;
 }
 function route() {
  const p = location.pathname.replace(/\/+$/, ''), m = p.match(/^\/(id|profiles)\/[^/]+(\/.*)?$/); if (!m) return null;
  const rest = (m[2] || '').toLowerCase();
  if (!rest || rest === '/home') return 'profile';
  if (rest === '/games') return 'games';
  return null;
 }
 const hashUuid = () => { const h = decodeURIComponent(location.hash.slice(1)); return h.startsWith(HASH) ? h.slice(HASH.length) : ''; };
 const hashHref = uuid => location.pathname + location.search + '#' + HASH + encodeURIComponent(uuid);
 // Jogos que você já tem na própria Steam não aparecem duas vezes.
 // Os AppIDs da página são lidos uma vez (dados da Steam + links), em vez de uma busca no texto inteiro por jogo.
 function ownedOnSteam(appId) {
  if (!appId) return false;
  // Dados da Steam (SSR): lidos uma vez por endereço. Links da página: no máximo a cada 1 s.
  if (!STATE.loader) { let text = ''; try { text = JSON.stringify(window.SSR && window.SSR.loaderData || {}); } catch (e) {} const base = new Set(); const re = /(?:"appid"\s*:\s*"?|\/app\/)(\d+)/g; let m; while ((m = re.exec(text))) base.add(m[1]); STATE.loader = base; STATE.owned = null; }
  if (!STATE.owned || Date.now() - STATE.ownedAt > 1000) {
   const set = new Set(STATE.loader);
   document.querySelectorAll('a[href*="/app/"]').forEach(a => { if (a.closest('[data-taiga]')) return; const x = (a.getAttribute('href') || '').match(/\/app\/(\d+)/); if (x) set.add(x[1]); });
   STATE.owned = set; STATE.ownedAt = Date.now();
  }
  return STATE.owned.has(String(appId));
 }
 function visibleGames(d) { return (d.games || []).filter(g => !(g.steamAppId && ownedOnSteam(g.steamAppId))); }

 // ── contadores (perfil e abas) ──
 // Guarda o número original da Steam e mostra original + jogos do Taiga Launcher, sem somar duas vezes.
 function bump(el, add, re) {
  const text = el.textContent; if (!el.isConnected) return;
  const m = text.match(re); if (!m) return;
  const current = Number(m[1].replace(/[^\d]/g, '')); const shown = Number(el.dataset.taigaShown || NaN);
  const baseValue = current === shown && el.dataset.taigaBase !== undefined ? Number(el.dataset.taigaBase) : current;
  const next = baseValue + add; if (current === next && el.dataset.taigaShown === String(next)) return;
  el.dataset.taigaBase = String(baseValue); el.dataset.taigaShown = String(next);
  el.textContent = text.replace(m[1], num(next));
 }
 function profileCount(d) {
  const n = visibleGames(d).length; if (!n) return;
  document.querySelectorAll('.profile_count_link_total').forEach(el => { const a = el.closest('a'); if (a && /\/games\/?(\?|$)/.test(a.getAttribute('href') || '')) bump(el, n, /(\d[\d.,\s]*)/); });
 }
 function tabOf(text, href) {
  const h = String(href || ''); const m = h.match(/[?&]tab=([a-z]+)/); if (m) return m[1] === 'completed' ? 'perfect' : m[1];
  return text === 'perfect' ? 'perfect' : text;
 }
 function tabCounts(d) {
  const list = visibleGames(d), add = {all: list.length, recent: list.filter(g => g.recent).length, perfect: list.filter(g => g.achievements.perfect).length};
  document.querySelectorAll('a[href*="/games/?tab="], a[href*="/games?tab="]').forEach(a => { const k = tabOf('', a.getAttribute('href')); const span = a.querySelector('span') || a; if (add[k]) bump(span, add[k], /\((\d[\d.,\s]*)\)/); });
  document.querySelectorAll('select option').forEach(o => { const k = tabOf(o.value === 'perfect' ? 'perfect' : o.value, ''); if (add[k]) bump(o, add[k], /\((\d[\d.,\s]*)\)/); });
 }
 function activeTab() {
  const links = [...document.querySelectorAll('a[href*="/games/?tab="], a[href*="/games?tab="]')];
  if (links.length > 1) {
   const counts = new Map(); links.forEach(a => a.classList.forEach(c => counts.set(c, (counts.get(c) || 0) + 1)));
   const active = links.find(a => [...a.classList].some(c => counts.get(c) === 1));
   if (active) return tabOf('', active.getAttribute('href'));
  }
  const p = new URLSearchParams(location.search).get('tab'); return p === 'completed' ? 'perfect' : p || 'all';
 }

 // ── cartões na lista de jogos ──
 function findList() {
  const found = [...document.querySelectorAll('div[style*="height"]')].find(d => d.firstElementChild && /top:/.test(d.firstElementChild.getAttribute('style') || '') && d.querySelector('a[href*="/app/"]') && !d.closest('[data-taiga]'));
  if (found) { STATE.listClass = found.getAttribute('class') || ''; return found; }
  // Busca sem nenhum jogo da Steam: a lista continua lá, vazia, é ela que recebe os nossos cartões.
  if (STATE.listClass) { const empty = [...document.querySelectorAll('div[style*="height"]')].find(d => d.getAttribute('class') === STATE.listClass && !d.closest('[data-taiga]')); if (empty) return empty; }
  return null;
 }
 function fromHtml(html) { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild; }
 function rowsOf(list) { return list ? [...list.children].map(w => w.firstElementChild).filter(Boolean) : []; }
 const achLink = row => [...row.querySelectorAll('a[href*="/achievements/"]')].find(a => !a.closest('[popover]')) || null;
 function achBlockOf(row) { const a = achLink(row); return a && a.parentElement && a.parentElement.parentElement; }
 function templates(list) {
  const rows = rowsOf(list), t = STATE.tpl || {};
  const withBar = rows.find(r => achBlockOf(r));
  if (withBar || rows[0]) t.row = (withBar || rows[0]).cloneNode(true);
  const perfect = rows.find(r => r.querySelector('[style*="--award-base"]'));
  if (perfect) { const a = achLink(perfect); const outer = a && a.parentElement.nextElementSibling; if (outer && outer.innerHTML) t.awardInner = outer.innerHTML; }
  const icons = rows.map(r => achBlockOf(r)).filter(Boolean).map(b => [...b.children].find(c => c.querySelector('img'))).find(Boolean);
  if (icons) t.icons = icons.cloneNode(true);
  if (list && list.children.length > 1) { const a = parseFloat(list.children[0].style.top), b = parseFloat(list.children[1].style.top); if (b > a) t.stride = b - a; }
  t.stride ||= 150;
  return STATE.tpl = t;
 }
 function setValue(span, value) { [...span.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); }); span.appendChild(document.createTextNode(value)); }
 function image(uuid, kind) {
  if (STATE.friend) { const g = STATE.friend.games.find(x => x.uuid === uuid), im = g && g.images || {}; return Promise.resolve(im[kind] || (kind === 'header' ? im.cover : '') || ''); }
  const key = uuid + '|' + kind; if (STATE.images.has(key)) return STATE.images.get(key);
  const p = call('community_image', {uuid, kind}).then(r => r.url || '').catch(() => ''); STATE.images.set(key, p); return p;
 }
 let openPop = null;
 function closePop() { if (openPop) { try { openPop.hidePopover ? openPop.hidePopover() : (openPop.style.display = 'none'); } catch (e) {} openPop = null; } }
 function togglePop(btn, pop) {
  if (openPop === pop) { closePop(); return; }
  closePop(); const r = btn.getBoundingClientRect();
  Object.assign(pop.style, {position: 'fixed', inset: 'auto', margin: '0', top: Math.round(r.bottom + 4) + 'px', left: Math.round(r.left) + 'px', minWidth: Math.round(r.width) + 'px', display: ''});
  try { pop.showPopover ? pop.showPopover() : (pop.style.display = 'block'); } catch (e) { pop.style.display = 'block'; }
  openPop = pop; STATE.popY = window.scrollY; btn.setAttribute('aria-expanded', 'true');
 }
 document.addEventListener('click', e => { if (openPop && !openPop.contains(e.target) && !(e.target.closest && e.target.closest('[data-taiga-pop-btn]'))) closePop(); }, true);
 window.addEventListener('scroll', () => { if (openPop && Math.abs(window.scrollY - (STATE.popY || 0)) > 40) closePop(); }, {passive: true});
 function fillRow(row, g, mode) {
  const t = STATE.tpl, href = hashHref(g.uuid);
  row.setAttribute('data-taiga', g.uuid); row.removeAttribute('tabindex');
  row.querySelectorAll('picture source').forEach(s => s.remove());
  const img = row.querySelector('picture img') || row.querySelector('img');
  const imgA = img && img.closest('a');
  const titleA = [...row.querySelectorAll('span > a')].find(a => !a.querySelector('img'));
  if (img) { img.alt = g.title; img.removeAttribute('src'); image(g.uuid, 'header').then(u => { if (u) img.src = u; }); }
  for (const a of [imgA, titleA]) if (a) { a.setAttribute('href', href); a.removeAttribute('target'); }
  if (titleA) titleA.textContent = g.title;
  const stats = titleA && titleA.closest('span') && titleA.closest('span').nextElementSibling;
  if (stats) {
   const spans = [...stats.children].filter(e => e.tagName === 'SPAN' && e.firstElementChild && e.firstElementChild.tagName === 'SPAN');
   const play = spans[0]; let last = spans[1];
   if (play) setValue(play, fmtPlay(g.minutes));
   if (mode === 'recent' || !g.lastPlayed) { if (last) last.remove(); }
   else { if (!last && play) { last = play.cloneNode(true); last.firstElementChild.textContent = L.last; play.after(last); } if (last) setValue(last, fmtDay(g.lastPlayed)); }
   const block = achBlockOf(row), ach = g.achievements;
   if (block) {
    if (!ach.total) block.remove();
    else {
     const a = achLink(block); a.setAttribute('href', href);
     const count = a.nextElementSibling; if (count) count.textContent = ach.unlocked + '/' + ach.total;
     const bar = block.querySelector('[style*="--grid-columns"]'); if (bar) bar.style.setProperty('--grid-columns', ach.unlocked + 'fr ' + (ach.total - ach.unlocked) + 'fr');
     const outer = a.parentElement.nextElementSibling;
     if (outer) outer.innerHTML = ach.perfect ? (t.awardInner || FB.awardInner || '') : '';
     let icons = [...block.children].find(c => c !== a.parentElement && c !== outer && c.querySelector('img'));
     if (mode === 'recent' && ach.recentIcons.length) {
      if (!icons) { icons = (t.icons ? t.icons.cloneNode(true) : fromHtml(FB.icons || '<div></div>')); block.appendChild(icons); }
      const sample = icons.firstElementChild; icons.innerHTML = '';
      for (const it of ach.recentIcons.slice(0, 6)) { const c = sample ? sample.cloneNode(true) : document.createElement('div'); let im = c.querySelector('img'); if (!im) { im = document.createElement('img'); c.appendChild(im); } im.src = it.icon; im.alt = it.title; im.title = it.title; icons.appendChild(c); }
     } else if (icons) icons.remove();
    }
   }
  }
  // Botões: "Minhas estatísticas no jogo" mostra só "Minhas conquistas"; "Meu conteúdo do jogo" e "..." não fazem nada.
  const btns = [...row.querySelectorAll('button')], pops = [...row.querySelectorAll('[popover]')];
  btns.forEach(b => { b.setAttribute('aria-expanded', 'false'); b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }); });
  pops.forEach(p => { p.innerHTML = ''; });
  if (btns[0] && pops[0]) {
   const tplInner = t.row && t.row.querySelector('[popover] > div'), tplLink = t.row && t.row.querySelector('[popover] a[href*="/achievements/"]');
   const inner = tplInner ? tplInner.cloneNode(false) : document.createElement('div');
   const link = document.createElement('a'); link.href = href; link.textContent = (tplLink && tplLink.textContent.trim()) || L.mine;
   link.addEventListener('click', closePop); inner.appendChild(link); pops[0].appendChild(inner);
   btns[0].setAttribute('data-taiga-pop-btn', '1');
   btns[0].addEventListener('click', () => togglePop(btns[0], pops[0]));
  }
  return row;
 }
 function sortMode() {
  const bar = [...document.querySelectorAll('ul')].find(u => u.querySelectorAll('li > button').length === 3 && !u.closest('[data-taiga]'));
  if (!bar) return {i: 0, bar: null};
  const b = [...bar.querySelectorAll('li > button')]; const counts = new Map(); b.forEach(x => x.classList.forEach(c => counts.set(c, (counts.get(c) || 0) + 1)));
  const i = b.findIndex(x => [...x.classList].some(c => counts.get(c) === 1));
  b.forEach(x => { if (!x.dataset.taigaSort) { x.dataset.taigaSort = '1'; x.addEventListener('click', () => schedule(80)); } });
  return {i: i < 0 ? 0 : i, bar};
 }
 function searchText() {
  const input = [...document.querySelectorAll('input[type="text"], input:not([type])')].find(i => !i.closest('[data-taiga]'));
  if (input && !input.dataset.taigaSearch) { input.dataset.taigaSearch = '1'; input.addEventListener('input', () => schedule(60)); }
  return input ? norm(input.value) : '';
 }
 // Valores de um cartão da própria Steam (para intercalar os nossos na mesma ordem dos filtros).
 function parsePlay(text) {
  const m = String(text || '').trim().match(/([\d.,]+)\s*(\S+)?/); if (!m) return 0;
  const n = parseFloat(m[1].replace(/[.\s](?=\d{3}\b)/g, '').replace(',', '.')) || 0;
  return /^min/i.test(m[2] || '') ? n : n * 60;
 }
 function steamInfo(row) {
  const titleA = [...row.querySelectorAll('span > a')].find(a => !a.querySelector('img'));
  const stats = titleA && titleA.closest('span') && titleA.closest('span').nextElementSibling;
  const play = stats && [...stats.children].find(e => e.tagName === 'SPAN' && e.firstElementChild);
  const a = achLink(row), c = a && a.nextElementSibling && a.nextElementSibling.textContent.match(/(\d+)\s*\/\s*(\d+)/);
  const app = (row.querySelector('a[href*="/app/"]') || {getAttribute: () => ''}).getAttribute('href').match(/\/app\/(\d+)/);
  return {title: titleA ? titleA.textContent.trim() : '', minutes: play ? parsePlay([...play.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('')) : 0, u: c ? +c[1] : 0, t: c ? +c[2] : 0, appid: app ? app[1] : ''};
 }
 // Última sessão dos jogos da Steam (dados que a própria página já trouxe), para a aba Recém-jogados.
 function lastPlayedMap() {
  if (STATE.lpMap) return STATE.lpMap; const map = new Map(), seen = new Set();
  const walk = (o, depth) => {
   if (!o || typeof o !== 'object' || depth > 9 || seen.has(o)) return; seen.add(o);
   if (Array.isArray(o)) { o.forEach(x => walk(x, depth + 1)); return; }
   const id = o.appid ?? o.app_id ?? o.appId;
   if (id !== undefined && id !== null) for (const k of Object.keys(o)) if (/last_?played|rtime_last|lastplayed/i.test(k) && Number(o[k]) > 0) { map.set(String(id), Number(o[k])); break; }
   for (const k in o) walk(o[k], depth + 1);
  };
  try { walk(window.SSR && window.SSR.loaderData, 0); } catch (e) {}
  return STATE.lpMap = map;
 }
 function comparators(mode) {
  const sort = sortMode().i, lp = lastPlayedMap(), pct = x => x.t ? x.u / x.t : -1;
  if (mode === 'recent') return {vs: (o, s) => (lp.get(s.appid) || 0) - o.lastPlayed, own: (a, b) => b.lastPlayed - a.lastPlayed};
  if (sort === 1) { const c = (a, b) => a.title.localeCompare(b.title, LOCALE, {sensitivity: 'base', numeric: true}); return {vs: c, own: c}; }
  if (sort === 2) { const c = (a, b) => (pct(b) - pct(a)) || (b.u - a.u); return {vs: c, own: c}; }
  const c = (a, b) => b.minutes - a.minutes; return {vs: c, own: c};
 }
 function gameInfo(g) { return {g, title: g.title, minutes: g.minutes, u: g.achievements.unlocked, t: g.achievements.total, lastPlayed: g.lastPlayed}; }
 function ourRow(g, mode, wrapClass) {
  const sig = JSON.stringify([mode, g.title, g.minutes, g.lastPlayed, g.achievements]);
  const old = STATE.rows.get(g.uuid);
  if (old && old.sig === sig && old.wrapClass === wrapClass) return old.wrap;
  const wrap = document.createElement('div'); if (wrapClass) wrap.className = wrapClass; else wrap.style.cssText = 'position:relative;height:' + STATE.tpl.stride + 'px';
  wrap.setAttribute('data-taiga-row', g.uuid); wrap.setAttribute('data-taiga', 'row');
  const tpl = STATE.tpl.row ? STATE.tpl.row.cloneNode(true) : fromHtml(FB.row).firstElementChild;
  wrap.appendChild(fillRow(tpl, g, mode));
  if (old) old.wrap.replaceWith(wrap);
  STATE.rows.set(g.uuid, {sig, wrapClass, wrap}); return wrap;
 }
 function clearOurs(keep) {
  for (const [uuid, r] of STATE.rows) if (!keep || !keep.has(uuid)) { r.wrap.remove(); STATE.rows.delete(uuid); }
  if (!keep) document.querySelectorAll('[data-taiga-shifted]').forEach(w => { w.style.transform = ''; w.removeAttribute('data-taiga-shifted'); });
 }
 function renderList(d) {
  const mode = activeTab(), list = findList(), anchor = list || document.getElementById('tabs_baseline');
  let games = visibleGames(d);
  games = mode === 'all' ? games : mode === 'recent' ? games.filter(g => g.recent) : mode === 'perfect' ? games.filter(g => g.achievements.perfect) : [];
  const q = searchText(); if (q) games = games.filter(g => norm(g.title).includes(q));
  const block = document.getElementById('taiga-community-games');
  if (!games.length || !anchor) { clearOurs(); if (block) block.remove(); if (list) list.style.minHeight = ''; return; }
  templates(list);
  if (!STATE.tpl.row && !FB.row) return;
  const cmp = comparators(mode), ours = games.map(gameInfo).sort(cmp.own), keep = new Set(games.map(g => g.uuid)), stride = STATE.tpl.stride;
  // Lista da Steam com todos os cartões desenhados: os nossos entram no meio, na posição certa do filtro.
  const wrappers = list ? [...list.children].filter(w => !w.hasAttribute('data-taiga-row')) : [];
  const full = list && Math.abs(wrappers.length * stride - (parseFloat(list.style.height) || 0)) < stride / 2;
  if (full) {
   if (block) block.remove();
   clearOurs(keep);
   if (wrappers[0]) STATE.wrapClass = wrappers[0].className;
   const steam = wrappers.map(w => ({w, top: parseFloat(w.style.top) || 0, info: steamInfo(w.firstElementChild || w)})).sort((a, b) => a.top - b.top);
   let i = 0, j = 0, m = 0;
   while (i < steam.length || j < ours.length) {
    if (j < ours.length && (i >= steam.length || cmp.vs(ours[j], steam[i].info) < 0)) {
     const w = ourRow(ours[j].g, mode, STATE.wrapClass || (steam[0] && steam[0].w.className) || ''), top = m * stride + 'px';
     if (!w.className) { w.style.position = 'absolute'; w.style.left = '0'; w.style.right = '0'; }
     if (w.style.top !== top) w.style.top = top;
     if (w.parentNode !== list) list.appendChild(w);
     j++;
    } else {
     const shift = (m - i) * stride, t = shift ? 'translateY(' + shift + 'px)' : '';
     if (steam[i].w.style.transform !== t) { steam[i].w.style.transform = t; if (t) steam[i].w.setAttribute('data-taiga-shifted', '1'); else steam[i].w.removeAttribute('data-taiga-shifted'); }
     i++;
    }
    m++;
   }
   const minH = (steam.length + ours.length) * stride + 'px'; if (list.style.minHeight !== minH) list.style.minHeight = minH;
   return;
  }
  // A Steam ainda está desenhando a lista (ordem e altura mudam nos primeiros instantes): espera assentar antes de
  // mostrar os nossos, senão eles aparecem no topo e pulam para a posição certa logo depois (a "piscada").
  const now = Date.now(); if (!STATE.listSince || STATE.listHref !== location.href) { STATE.listSince = now; STATE.listHref = location.href; }
  if (now - STATE.listSince < 2500) { if (!block) { clearOurs(keep); schedule(300); return; } }
  // Lista muito grande (a Steam só desenha parte dela): os nossos ficam num bloco antes da lista.
  clearOurs(keep);
  let box = block;
  if (!box) { box = document.createElement('div'); box.id = 'taiga-community-games'; box.setAttribute('data-taiga', 'list'); }
  ours.forEach(o => { const w = ourRow(o.g, mode, ''); w.style.top = ''; if (w.parentNode !== box || box.lastElementChild !== w) box.appendChild(w); });
  const bar = (() => { const input = [...document.querySelectorAll('input')].find(i => !i.closest('[data-taiga]')), ul = sortMode().bar; let a = input; while (a && ul && !a.contains(ul)) a = a.parentElement; return a && a !== document.body ? a : null; })();
  if (list) { if (box.nextElementSibling !== list) list.parentNode.insertBefore(box, list); } else if (bar) { if (box.previousElementSibling !== bar) bar.after(box); } else if (box.previousElementSibling !== anchor) anchor.after(box);
 }

 // ── página de conquistas ──
 function templateCandidates() {
  const seen = new Map();
  document.querySelectorAll('a[href*="/achievements/"]').forEach(a => {
   if (a.closest('[data-taiga]') || a.closest('[popover]')) return; const href = a.getAttribute('href') || ''; if (!/\/(id|profiles)\/[^/]+\/achievements\//.test(href)) return; const m = href.match(/\/achievements\/(\d+)/); if (!m) return;
   const c = ((a.nextElementSibling && a.nextElementSibling.textContent) || '').match(/(\d+)\s*\/\s*(\d+)/); seen.set(m[1], {id: m[1], u: c ? +c[1] : 0, t: c ? +c[2] : 0});
  });
  let saved = []; try { saved = JSON.parse(localStorage.getItem('taiga-ach-templates') || '[]'); } catch (e) {}
  for (const s of saved) if (!seen.has(s.id)) seen.set(s.id, s);
  const list = [...seen.values()].sort((a, b) => ((b.u > 0 && b.u < b.t) - (a.u > 0 && a.u < a.t)) || ((b.u > 0) - (a.u > 0)));
  try { localStorage.setItem('taiga-ach-templates', JSON.stringify(list.slice(0, 12))); } catch (e) {}
  return list;
 }
 // Página real de conquistas carregada num quadro invisível (mesmo site): dá a marcação e o estilo atuais da Steam.
 function loadFrame(url) {
  return new Promise(resolve => {
   const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
   f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:2400px;visibility:hidden;pointer-events:none;border:0';
   let done = false; const finish = doc => { if (done) return; done = true; clearInterval(timer); resolve(doc ? {doc, frame: f} : null); if (!doc) f.remove(); };
   const start = Date.now(); const timer = setInterval(() => {
    try {
     const w = f.contentWindow, doc = f.contentDocument;
     if (doc && doc.querySelector('[data-index] h1') && (!w.SSR || w.SSR.hydrated)) finish(doc);
     // Página carregada sem lista de conquistas (jogo sem conquistas, erro ou perfil privado): desiste logo.
     else if (doc && doc.readyState === 'complete' && Date.now() - start > 6000 && (!w.SSR || w.SSR.hydrated) && !doc.querySelector('[data-index]')) finish(null);
    } catch (e) { finish(null); }
    if (Date.now() - start > 20000) finish(null);
   }, 250);
   f.src = url; document.body.appendChild(f);
  });
 }
 // Aparência ligada/desligada do interruptor da Steam: lida no modelo (liga e volta ao estado original).
 async function switchStates(doc) {
  const sw = doc.querySelector('[role="switch"]'); if (!sw) return null;
  const snap = () => ({cls: sw.getAttribute('class') || '', checked: sw.getAttribute('aria-checked'), kids: [...sw.querySelectorAll('*')].map(k => k.getAttribute('class') || '')});
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
   const a = snap(); sw.click(); await wait(250); const b = snap();
   if (b.checked !== a.checked) { sw.click(); await wait(120); }
   const on = a.checked === 'true' ? a : b, off = a.checked === 'true' ? b : a;
   return on.checked === 'true' && off.checked !== 'true' ? {on, off} : null;
  } catch (e) { return null; }
 }
 async function achievementTemplate() {
  if (STATE.achTpl) return STATE.achTpl;
  const base = profileBase();
  for (const c of templateCandidates().slice(0, 3)) {
   const url = base + '/achievements/' + c.id + '/';
   const r = await loadFrame(url);
   if (r) {
    const root = r.doc.querySelector('[data-react-nav-root]') || r.doc.body.firstElementChild;
    STATE.achTpl = {appId: c.id, root: document.importNode(root, true), links: [...r.doc.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href), bodyClass: r.doc.body.className, bodyStyle: r.doc.body.getAttribute('style') || '', sw: await switchStates(r.doc)};
    r.frame.remove(); return STATE.achTpl;
   }
   try {
    const html = await (await fetch(url, {credentials: 'include'})).text(); const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.querySelector('[data-react-nav-root]'); if (root && root.querySelector('h1')) { STATE.achTpl = {appId: c.id, sw: null, root: document.importNode(root, true), links: [...doc.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href')), bodyClass: doc.body.className, bodyStyle: doc.body.getAttribute('style') || ''}; return STATE.achTpl; }
   } catch (e) {}
  }
  return null;
 }
 function replaceTextNodes(root, from, to) {
  if (!from) return; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n => { if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.split(from).join(to); });
  root.querySelectorAll('[alt]').forEach(i => { if (i.getAttribute('alt') === from) i.setAttribute('alt', to); });
 }
 function leafSpans(root) { return [...root.querySelectorAll('span')].filter(s => !s.querySelector('span') && s.textContent.trim()); }
 function fillAchRow(row, a, unlocked, prefix) {
  row.removeAttribute('data-index');
  const img = row.querySelector('img'); if (img) { img.src = (unlocked ? a.icon : a.lockedIcon || a.icon) || ''; img.alt = a.title; img.removeAttribute('loading'); if (!unlocked && (!a.lockedIcon || a.lockedIcon === a.icon)) img.style.filter = 'grayscale(1) brightness(.6)'; }
  const h1 = row.querySelector('h1'); if (h1) h1.textContent = a.title;
  const desc = h1 && h1.parentElement && h1.parentElement.nextElementSibling; if (desc) desc.textContent = a.description || '';
  const spans = leafSpans(row).filter(s => s !== desc && !(h1 && h1.contains(s)));
  const pct = spans.find(s => /%\s*$/.test(s.textContent)), date = spans.find(s => s !== pct && /\b(19|20)\d{2}\b/.test(s.textContent));
  if (date) { if (unlocked && a.date) date.textContent = prefix + fmtDateTime(a.date); else { const box = date.parentElement; (box && box.children.length === 1 ? box : date).remove(); } }
  if (pct) { if (a.globalPercent !== null && a.globalPercent !== undefined) pct.textContent = num(a.globalPercent, 1) + '%'; else { const box = pct.parentElement; (box && box.querySelector('svg') ? box : pct).remove(); } }
  return row;
 }
 function closeAchievements() {
  const view = document.getElementById('taiga-ach-view'); if (!view) return;
  view.remove(); document.querySelectorAll('[data-taiga-hidden]').forEach(el => { el.style.display = el.dataset.taigaHidden === '-' ? '' : el.dataset.taigaHidden; el.removeAttribute('data-taiga-hidden'); });
  if (STATE.bodyBackup) { document.body.className = STATE.bodyBackup.cls; if (STATE.bodyBackup.style === null) document.body.removeAttribute('style'); else document.body.setAttribute('style', STATE.bodyBackup.style); STATE.bodyBackup = null; }
 }
 async function showAchievements(uuid) {
  const existing = document.getElementById('taiga-ach-view'); if (existing && existing.dataset.uuid === uuid) return;
  const friendGame = STATE.friend && STATE.friend.games.find(x => x.uuid === uuid);
  const load = friendGame ? Promise.resolve({...friendGame, achievements: friendGame.achievementList || [], hero: friendGame.images.hero || friendGame.images.cover || '', cover: friendGame.images.cover || friendGame.images.header || ''}) : call('community_achievements', {uuid});
  const [tpl, d] = await Promise.all([achievementTemplate(), load]);
  if (hashUuid() !== uuid) return;
  closeAchievements();
  if (!tpl) { location.hash = ''; return; }
  for (const href of tpl.links) if (href && !document.querySelector('link[rel="stylesheet"][href="' + CSS.escape(href) + '"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); }
  const view = tpl.root.cloneNode(true); view.id = 'taiga-ach-view'; view.dataset.uuid = uuid; view.setAttribute('data-taiga', 'achievements'); view.removeAttribute('data-react-nav-root');
  const h1 = view.querySelector('h1'), tplTitle = h1 ? h1.textContent.trim() : '';
  const list = d.achievements, unlocked = list.filter(a => a.unlocked).sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0)), locked = list.filter(a => !a.unlocked).sort((a, b) => (b.globalPercent ?? -1) - (a.globalPercent ?? -1));
  const total = list.length, u = unlocked.length, perfect = total > 0 && u === total, pctAll = total ? Math.floor(u * 100 / total) : 0;
  // Modelos das linhas (antes de mexer no texto).
  const rows = [...view.querySelectorAll('[data-index]')];
  const isRow = r => r.querySelector('h1') && r.querySelector('img'), isHeader = r => !r.querySelector('img') && /\(\d+\)/.test(r.textContent);
  const headers = rows.filter(isHeader), firstLockedHeader = headers[1] || null;
  const before = r => !firstLockedHeader || (r.compareDocumentPosition(firstLockedHeader) & Node.DOCUMENT_POSITION_FOLLOWING);
  const uRows = rows.filter(r => isRow(r) && before(r)), lRows = rows.filter(r => isRow(r) && !before(r));
  const pick = (arr, fb) => arr.length ? arr.map(r => r.cloneNode(true)) : fb.filter(Boolean).map(fromHtml);
  const uTpl = pick(uRows.slice(0, 2), [FB.achRow0, FB.achRow1]), lTpl = lRows.length ? pick(lRows.slice(0, 2), []) : FB.achLocked0 ? pick([], [FB.achLocked0, FB.achLocked1]) : uTpl;
  const hU = headers[0] ? headers[0].cloneNode(true) : fromHtml(FB.achHeader || '<div></div>'), hL = firstLockedHeader ? firstLockedHeader.cloneNode(true) : FB.achLockedHeader ? fromHtml(FB.achLockedHeader) : null;
  const sep = rows.find(r => !r.textContent.trim() && !r.querySelector('img'));
  const datePrefix = (() => { const s = uRows[0] && leafSpans(uRows[0]).find(x => /\b(19|20)\d{2}\b/.test(x.textContent) && !/%\s*$/.test(x.textContent)); const t = s ? s.textContent.replace(/\d.*$/, '') : ''; return DICT[LANG.slice(0, 2)] ? L.on : t || L.on; })();
  // Cabeçalho do jogo.
  replaceTextNodes(view, tplTitle, d.title);
  view.querySelectorAll('a[href*="store.steampowered.com"]').forEach(a => a.removeAttribute('href'));
  // Partes que são do jogo modelo, não do nosso: "N amigos jogam este jogo" e Classificações.
  view.querySelectorAll('a[href*="/leaderboards"], a[href*="/stats/"]').forEach(a => a.remove());
  const keep = view.querySelector('[data-index]'), h1Node = view.querySelector('h1');
  const removeBlock = el => { let b = el; while (b.parentElement && b.parentElement !== view && !(h1Node && b.parentElement.contains(h1Node)) && !(keep && b.parentElement.contains(keep))) b = b.parentElement; if (b !== view && !(h1Node && b.contains(h1Node)) && !(keep && b.contains(keep))) b.remove(); };
  const FRIENDS = /^\s*\d+\s+(amigos?|friends?|ami\(e\)s?|amis?|freunde?|freund)\b/i;
  [...view.querySelectorAll('*')].filter(el => (el.textContent || '').trim().length < 90 && FRIENDS.test(el.textContent || '')).sort((a, b) => b.querySelectorAll('*').length - a.querySelectorAll('*').length).forEach(el => { if (el.isConnected) removeBlock(el); });
  // Link "Enviar comentários sobre o beta" da página nova de conquistas da Steam: não vale para os nossos jogos.
  view.querySelectorAll('a, button').forEach(a => { const t = (a.textContent || '').trim(); if (/\bbeta\b|feedback|coment[áa]rios?|commentaires|r[üu]ckmeldung|comentarios/i.test(t) && t.length < 80) a.remove(); });
  view.querySelectorAll('[data-miniprofile]').forEach(el => { if (el.isConnected) removeBlock(el); });
  view.querySelectorAll('a[href*="/achievements/"]').forEach(a => a.setAttribute('href', hashHref(uuid)));
  // Todas as imagens do jogo do modelo (fundo e capa, qualquer formato) viram as do nosso jogo.
  // Capa (em pé): a área "capsule" do modelo, reconhecida pelo nome da área, pela proporção 2/3 ou pela imagem vertical.
  const capsule = [...view.querySelectorAll('[style]')].find(el => /grid-area:\s*capsule|aspect-ratio:\s*2\s*\/\s*3/.test(el.getAttribute('style') || '')) || (view.querySelector('img[src*="library_600x900"], img[src*="library_capsule"]') || {closest: () => null}).closest('a') || null;
  const art = /store_item_assets\/steam\/apps\/\d+\/|\/steam\/apps\/\d+\//;
  const pickArt = el => (capsule && capsule.contains(el)) ? (d.cover || d.hero || '') : (d.hero || d.cover || '');
  view.querySelectorAll('picture source').forEach(x => x.remove());
  view.querySelectorAll('img').forEach(im => { if (art.test(im.getAttribute('src') || '')) { const u = pickArt(im); if (u) im.src = u; else im.style.visibility = 'hidden'; im.removeAttribute('srcset'); } });
  view.querySelectorAll('[style*="background-image"]').forEach(el => { if (art.test(el.getAttribute('style') || '')) { const u = pickArt(el); el.style.backgroundImage = u ? 'url("' + u + '")' : 'none'; } });
  const listStart = rows[0];
  const header = [...view.querySelectorAll('span')].filter(s => !listStart || (s.compareDocumentPosition(listStart) & Node.DOCUMENT_POSITION_FOLLOWING));
  header.forEach(s => {
   if (s.querySelector('span')) { const first = s.firstChild; if (first && first.nodeType === 3 && /\d+\s*\/\s*\d+/.test(first.nodeValue)) first.nodeValue = first.nodeValue.replace(/\d+\s*\/\s*\d+/, u + '/' + total); const inner = s.querySelector('span'); if (inner && /\(\d+%\)/.test(inner.textContent)) inner.textContent = '(' + pctAll + '%)'; return; }
   const t = s.textContent;
   if (/:\s*\d+\s*\/\s*\d+/.test(t)) s.textContent = t.replace(/\d+\s*\/\s*\d+/, u + ' / ' + total);
   else if (/:/.test(t) && /\s-\s*$/.test(t)) s.textContent = t.replace(/:\s*.*?(\s-\s*)$/, ': ' + fmtPlay(d.minutes) + '$1');
   else if (/:/.test(t) && s.previousElementSibling && /\s-\s*$/.test(s.previousElementSibling.textContent)) s.textContent = t.replace(/:\s*.*$/, ': ' + fmtPlay(d.minutesTwoWeeks));
   else if (/^\d+\s+\S+$/.test(t.trim()) && !/%/.test(t)) { const rare = list.filter(a => a.globalPercent !== null && a.globalPercent < 10).length; if (list.some(a => a.globalPercent !== null)) s.textContent = t.replace(/\d+/, String(rare)); else s.remove(); }
  });
  view.querySelectorAll('[style*="--grid-columns"]').forEach(b => { if (/^\s*\d+fr\s+\d+fr\s*$/.test(b.style.getPropertyValue('--grid-columns'))) b.style.setProperty('--grid-columns', u + 'fr ' + (total - u) + 'fr'); });
  if (!perfect) view.querySelectorAll('[style*="--award-base"]').forEach(a => { const box = a.closest('div'); (box || a).remove(); });
  const icons = [...unlocked, ...locked].map(a => a.icon).filter(Boolean);
  view.querySelectorAll('svg pattern image').forEach((im, i) => { if (icons.length) im.setAttribute('href', icons[i % icons.length]); else im.remove(); });
  // Filtros: estatísticas globais só quando conhecidas; a busca funciona; o seletor de lista some.
  view.querySelectorAll('[role="combobox"]').forEach(cb => { const box = cb.parentElement; (box || cb).style.display = 'none'; });
  // Lista completa (sem rolagem virtual).
  const first = rows[0];
  if (first) {
   const inner = first.parentElement, outer = inner.parentElement;
   if (outer) outer.style.height = 'auto'; inner.style.position = 'static'; inner.style.transform = 'none';
   inner.innerHTML = '';
   if (sep) inner.appendChild(sep.cloneNode(true));
   const section = (head, items, tpls, isUnlocked) => {
    if (!items.length) return [];
    if (head) { const h = head.cloneNode(true); h.dataset.taigaSecHead = isUnlocked ? 'u' : 'l'; const sp = leafSpans(h)[0] || h; sp.textContent = /\(\d+\)/.test(sp.textContent) ? sp.textContent.replace(/\(\d+\)/, '(' + items.length + ')') : (isUnlocked ? L.unlocked : L.locked) + ' (' + items.length + ')'; inner.appendChild(h); }
    return items.map((a, i) => { const r = fillAchRow(tpls[i % tpls.length].cloneNode(true), a, isUnlocked, datePrefix); r.dataset.taigaSec = isUnlocked ? 'u' : 'l'; r.dataset.taigaSearch = norm(a.title + ' ' + a.description); inner.appendChild(r); return r; });
   };
   const all = [...section(hU, unlocked, uTpl, true), ...section(hL, locked, lTpl, false)];
   // Busca e "Exibir as que faltam" (no lugar de "Exibir estatísticas globais"): ligado, só as não alcançadas.
   let missingOnly = false; const input = view.querySelector('input');
   const filter = () => { const q = input ? norm(input.value) : ''; all.forEach(r => { r.style.display = (!q || r.dataset.taigaSearch.includes(q)) && !(missingOnly && r.dataset.taigaSec === 'u') ? '' : 'none'; }); inner.querySelectorAll('[data-taiga-sec-head="u"]').forEach(h => { h.style.display = missingOnly ? 'none' : ''; }); };
   if (input) { input.value = ''; input.addEventListener('input', filter); }
   const sw = view.querySelector('[role="switch"]');
   if (sw) {
    const label = sw.parentElement && [...sw.parentElement.querySelectorAll('span')].find(x => !x.querySelector('span') && x.textContent.trim()); if (label) label.textContent = L.missing;
    const setState = on => {
     missingOnly = on; const st = tpl.sw && (on ? tpl.sw.on : tpl.sw.off);
     if (st) { sw.setAttribute('class', st.cls); [...sw.querySelectorAll('*')].forEach((k, i) => { if (st.kids[i] !== undefined) k.setAttribute('class', st.kids[i]); }); } else sw.style.opacity = on ? '1' : '.55';
     sw.setAttribute('aria-checked', on ? 'true' : 'false'); filter();
    };
    sw.addEventListener('click', e => { e.preventDefault(); setState(!missingOnly); });
    sw.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setState(!missingOnly); } });
    setState(false);
   }
  }
  // Mostra no lugar da página atual; "Voltar" da Steam (ou do mouse) desfaz pelo histórico.
  const root = document.querySelector('[data-react-nav-root]') || document.body.firstElementChild;
  if (root) { root.dataset.taigaHidden = root.style.display || '-'; root.style.display = 'none'; root.after(view); } else document.body.prepend(view);
  STATE.bodyBackup = {cls: document.body.className, style: document.body.getAttribute('style')};
  if (tpl.bodyClass) document.body.className = tpl.bodyClass; if (tpl.bodyStyle) document.body.setAttribute('style', tpl.bodyStyle);
  window.scrollTo(0, 0);
 }

 // ── ciclo ──
 let timer = null, busy = false, again = false;
 // Agenda sem adiar sem fim: enquanto a Steam monta a página chegam mudanças o tempo todo, e um "espera parar de
 // mudar" atrasava o número de jogos até o fim do carregamento. Um pedido já marcado só é antecipado, nunca adiado.
 let dueAt = 0;
 function schedule(ms) { const wait = ms === undefined ? 120 : ms, at = Date.now() + wait; if (timer && dueAt <= at) return; clearTimeout(timer); dueAt = at; timer = setTimeout(() => { timer = null; apply(); }, wait); }
 async function apply() {
  if (busy) { again = true; return; } busy = true;
  try {
   const r = route(); if (!r) { closeAchievements(); return; }
   // Antes do fim do HTML não dá para saber se a página é montada pelo React (SSR); mexer antes da hidratação faria a Steam redesenhar tudo.
   const ssr = !!(document.getElementById('valve-ssr-data') || (window.SSR && !window.SSR.hydrated));
   // Perfil (página clássica, sem React): o número de jogos é trocado assim que aparece, mesmo com a página ainda carregando.
   const early = r === 'profile' && !ssr && document.body && document.querySelector('.profile_count_link_total');
   if (!early && (!document.body || document.readyState === 'loading' || ssr)) { schedule(40); return; }
   const sid = await profileSteamId(); if (!sid) return;
   const mine = await data(); let d;
   if (mine.steamId && sid === mine.steamId) { d = mine; STATE.friend = null; }
   else { d = await friendData(sid); if (!d || !d.games || !d.games.length) return; STATE.friend = d; }
   if (r === 'profile') profileCount(d);
   if (r === 'games') {
    tabCounts(d);
    const uuid = hashUuid();
    if (uuid) await showAchievements(uuid); else { closeAchievements(); renderList(d); }
   }
  } catch (e) {} finally { busy = false; if (again) { again = false; schedule(150); } }
 }
 new MutationObserver(records => { if (records.every(r => r.target.closest && r.target.closest('[data-taiga]'))) return; schedule(); }).observe(document, {childList: true, subtree: true});
 let lastHref = location.href;
 setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; STATE.loader = null; STATE.lpMap = null; schedule(30); } }, 250);
 // A Steam reordena os cartões só trocando a posição deles (sem criar elementos): confere a ordem a cada 300 ms.
 setInterval(() => {
  if (route() !== 'games' || hashUuid()) return; const list = findList(); if (!list) return;
  const sig = [...list.children].filter(w => !w.hasAttribute('data-taiga-row')).map(w => w.style.top + '|' + ((w.querySelector('a[href*="/app/"]') || {}).href || '')).join(',') + '|' + list.style.height;
  if (sig !== STATE.orderSig) { STATE.orderSig = sig; schedule(0); }
 }, 300);
 setInterval(() => { if (document.visibilityState === 'visible') data(true).then(() => schedule(0)).catch(() => {}); }, 90000);
 window.addEventListener('hashchange', () => schedule(0));
 window.addEventListener('popstate', () => schedule(0));
 schedule(0);
})();
