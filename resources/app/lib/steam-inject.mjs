// Injetor próprio do Taiga Launcher: dispensa SFP e Millennium.
//
// Mesma rota usada pelo SFP (PhantomGamers, MIT) e pelo Millennium (MIT): a Steam aberta com
// -cef-enable-debugging expõe o protocolo DevTools do CEF em 127.0.0.1:<porta>. O Taiga Launcher se conecta ao
// navegador da Steam, descobre as janelas (alvos) e executa o script do painel diretamente nelas:
//  - "Steam" (biblioteca no modo desktop) e "Steam Big Picture Mode": painel da página do jogo;
//  - "SharedJSContext": contexto principal da Steam, usado para notificações nativas de conquista.
// Como o Millennium, conecta-se uma vez ao navegador e anexa sessões planas (flatten) a cada alvo;
// como o SFP, reinjeta quando a janela recarrega ou é recriada. Nada é gravado na pasta da Steam.
export const DEFAULT_DEBUG_PORT = 8080;
export const steamLaunchArgs = (port = DEFAULT_DEBUG_PORT) => ['-cef-enable-debugging', '-devtools-port', String(port)];
const MARKER = '__TAIGA_INJECTED__';

export function targetKind(info) {
 if (!info) return null;
 const title = String(info.title || ''), url = String(info.url || '');
 // Como o Millennium: o contexto principal é reconhecido só pelo título (o tipo do alvo varia entre versões da Steam).
 if (title === 'SharedJSContext' || /^https:\/\/steamloopback\.host\/index\.html\?.*SharedJSContext/i.test(url)) return 'shared';
 // Perfil na Comunidade Steam aberto dentro do cliente (Jogos, Recém-jogados, Concluídos, Conquistas).
 if (['page', 'webview', 'iframe'].includes(info.type) && /^https:\/\/steamcommunity\.com\/(id|profiles)\/[^/?#]+/i.test(url)) return 'community';
 if (info.type !== 'page') return null;
 if (title === 'Steam Big Picture Mode' || /^MainMenu_|^QuickAccess_/.test(title)) return title === 'Steam Big Picture Mode' ? 'bigpicture' : null;
 if (title === 'Steam' && /^https:\/\/steamloopback\.host\//.test(url)) return 'library';
 return null;
}

export class SteamInjector {
 constructor({port = DEFAULT_DEBUG_PORT, ports = null, scripts, fetchImpl = (...a) => fetch(...a), WebSocketImpl = globalThis.WebSocket, log = () => {}, interval = 3000, enabled = () => true, kindOf = targetKind, host = '127.0.0.1', onCall = null, refreshExpression = null, version = '', health = {}, verifyEvery = 20000} = {}) {
  Object.assign(this, {port, ports, scripts, fetchImpl, WebSocketImpl, log, interval, enabled, kindOf, host, onCall, refreshExpression, version, health, verifyEvery});
  this.lastVerify = Date.now(); this.failures = new Map();
  this.calls = 0; this.lastCallError = '';
  this.ws = null; this.nextId = 1; this.pending = new Map(); this.sessions = new Map(); this.kinds = new Map(); this.injected = new Map(); this.ensuring = new Map();
  this.lastError = ''; this.connecting = null; this.timer = null; this.checks = new Map(); this.generation = 0;
 }
 start() { if (this.timer) return; this.tick(); this.timer = setInterval(() => this.tick(), this.interval); this.timer.unref?.(); }
 stop() { clearInterval(this.timer); this.timer = null; this.disconnect(); }
 status() { return {enabled: !!this.enabled(), connected: !!this.ws && this.ws.readyState === 1, port: this.activePort || this.port, windows: [...this.injected.entries()].map(([id, kind]) => kind), lastError: this.lastError, calls: this.calls, lastCallError: this.lastCallError}; }
 async tick() {
  if (!this.enabled()) { if (this.ws) this.disconnect(); return; }
  // Conectado: confere de novo as janelas que ainda não receberam o script (ex.: a Steam ainda estava carregando).
  // De tempos em tempos confere também as janelas já injetadas (o script pode ter falhado depois, ou a Steam
  // recarregou a interface sem avisar): a página do jogo não pode sumir sem ser reposta.
  if (this.ws && this.ws.readyState === 1) { const verify = Date.now() - this.lastVerify >= this.verifyEvery; if (verify) this.lastVerify = Date.now(); for (const id of this.sessions.keys()) if ((verify || !this.injected.has(id)) && !this.checks.has(id)) this.schedule(id, 0); return; }
  if (this.ws || this.connecting) return;
  this.connecting = this.connect().catch(error => { this.lastError = String(error?.message || error).slice(0, 200); this.disconnect(); }).finally(() => { this.connecting = null; });
  await this.connecting;
 }
 async connect() {
  if (!this.WebSocketImpl) throw Error('WebSocket indisponível neste ambiente.');
  let info = null, lastError = null;
  for (const port of [...new Set([this.port, ...(this.ports || [])].map(Number).filter(Boolean))]) {
   try { const res = await this.fetchImpl(`http://127.0.0.1:${port}/json/version`, {signal: AbortSignal.timeout(1500)}); if (!res.ok) throw Error('HTTP ' + res.status); const v = await res.json(); if (/Steam|Valve|CEF/i.test(JSON.stringify(v)) || v?.webSocketDebuggerUrl) { info = v; this.activePort = port; break; } } catch (e) { lastError = e; }
  }
  if (!info) throw Error('A Steam não respondeu na porta ' + this.port + '.');
  const url = info?.webSocketDebuggerUrl;
  if (!/^ws:\/\/(127\.0\.0\.1|localhost):\d+\/devtools\/browser\//.test(String(url || ''))) throw Error('Endereço de depuração da Steam inválido.');
  const ws = new this.WebSocketImpl(url), generation = ++this.generation;
  this.ws = ws;
  await new Promise((resolve, reject) => {
   const timer = setTimeout(() => reject(Error('Tempo esgotado ao conectar à Steam.')), 5000);
   ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once: true});
   ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('Falha ao conectar à Steam.')); }, {once: true});
  });
  ws.addEventListener('message', event => this.onMessage(event.data));
  ws.addEventListener('close', () => { if (this.generation === generation) this.disconnect(); });
  this.lastError = '';
  this.log('Conectado à Steam (porta ' + this.port + ').');
  await this.send('Target.setDiscoverTargets', {discover: true});
  const {targetInfos = []} = await this.send('Target.getTargets');
  await Promise.all(targetInfos.map(t => this.handleTarget(t)));
 }
 disconnect() {
  const ws = this.ws; this.ws = null;
  for (const {reject} of this.pending.values()) reject(Error('Conexão com a Steam encerrada.'));
  this.pending.clear(); this.sessions.clear(); this.kinds.clear(); this.injected.clear();
  try { ws?.close(); } catch {}
 }
 send(method, params = {}, sessionId) {
  const ws = this.ws;
  if (!ws || ws.readyState !== 1) return Promise.reject(Error('Steam não conectada.'));
  const id = this.nextId++;
  return new Promise((resolve, reject) => {
   const timer = setTimeout(() => { this.pending.delete(id); reject(Error('A Steam não respondeu a ' + method + '.')); }, 15000);
   this.pending.set(id, {resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); }});
   ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
 }
 onMessage(raw) {
  let msg; try { msg = JSON.parse(String(raw)); } catch { return; }
  if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.reject(Error(msg.error.message || 'Erro da Steam.')) : p.resolve(msg.result || {}); return; }
  const info = msg.params?.targetInfo;
  if (msg.method === 'Target.targetCreated' || msg.method === 'Target.targetInfoChanged') this.handleTarget(info).catch(() => {});
  else if (msg.method === 'Target.targetDestroyed' || msg.method === 'Target.detachedFromTarget') { const id = msg.params?.targetId || [...this.sessions].find(([, s]) => s === msg.params?.sessionId)?.[0]; if (id) { this.sessions.delete(id); this.kinds.delete(id); this.injected.delete(id); } }
  else if (msg.method === 'Runtime.bindingCalled' && msg.params?.name === '__taiga_ffi__' && msg.sessionId) this.handleCall(msg.sessionId, msg.params).catch(() => {});
  else if (msg.method === 'Runtime.executionContextsCleared' && msg.sessionId) { const id = [...this.sessions].find(([, s]) => s === msg.sessionId)?.[0]; if (id) { this.injected.delete(id); this.schedule(id, this.kinds.get(id) === 'community' ? 60 : 700); } }
 }
 // A janela pode recarregar várias vezes seguidas: espera assentar antes de conferir.
 schedule(targetId, delay = 700) {
  clearTimeout(this.checks.get(targetId));
  const timer = setTimeout(() => { this.checks.delete(targetId); this.ensure(targetId).catch(() => {}); }, delay); timer.unref?.();
  this.checks.set(targetId, timer);
 }
 async handleTarget(info) {
  const kind = this.kindOf(info);
  // A janela saiu de uma página atendida (ex.: da Comunidade para a Loja): para de injetar e de aceitar pedidos dela.
  if (!kind) { if (info?.targetId && this.kinds.has(info.targetId)) { this.kinds.delete(info.targetId); this.injected.delete(info.targetId); } return; }
  this.kinds.set(info.targetId, kind);
  // Eventos de criação/alteração podem chegar juntos: anexa uma única vez por janela.
  if (this.attaching?.has(info.targetId)) { await this.attaching.get(info.targetId).catch(() => {}); }
  if (!this.sessions.has(info.targetId)) {
   this.attaching ||= new Map();
   let release; const gate = new Promise(r => { release = r; }); this.attaching.set(info.targetId, gate);
   try {
   const {sessionId} = await this.send('Target.attachToTarget', {targetId: info.targetId, flatten: true});
   this.sessions.set(info.targetId, sessionId);
   await this.send('Runtime.enable', {}, sessionId).catch(() => {});
   // Ponte do frontend para o backend (como o FFI do Millennium): window.__taiga_ffi__(json).
   if ((kind === 'shared' || kind === 'community') && this.onCall) await this.send('Runtime.addBinding', {name: '__taiga_ffi__'}, sessionId).catch(() => {});
   // Comunidade: imagens dos jogos do Taiga Launcher chegam como data: (sem depender da política de conteúdo do site).
   if (kind === 'community') {
    await this.send('Page.setBypassCSP', {enabled: true}, sessionId).catch(() => {});
    // Também no começo de cada página nova da Comunidade (antes de a Steam desenhar), para os números e cartões
    // aparecerem sem atraso; o script espera a página ficar pronta sozinho.
    try { const src = (await this.scripts())?.community; if (src) await this.send('Page.addScriptToEvaluateOnNewDocument', {source: `${src}\n;window.${MARKER}=${JSON.stringify('community' + (this.version ? ':' + (typeof this.version === 'function' ? this.version() : this.version) : ''))};`}, sessionId); } catch {}
   }
   } finally { this.attaching.delete(info.targetId); release(); }
  }
  this.schedule(info.targetId, 300);
 }
 async ensure(targetId) {
  // A slow CDP reply can overlap the next poll; coalesce checks for the same window.
  if (this.ensuring.has(targetId)) return this.ensuring.get(targetId);
  const pending = this.ensureTarget(targetId); this.ensuring.set(targetId, pending);
  try { return await pending; } finally { if (this.ensuring.get(targetId) === pending) this.ensuring.delete(targetId); }
 }
 async ensureTarget(targetId) {
  const sessionId = this.sessions.get(targetId), kind = this.kinds.get(targetId);
  if (!sessionId || !kind) return false;
  // A marca leva a versão: depois de atualizar o Taiga Launcher, a Steam já aberta recebe o script novo.
  const ver = typeof this.version === 'function' ? this.version() : this.version;
  const mark = JSON.stringify(kind + (ver ? ':' + ver : ''));
  const healthy = this.health?.[kind] ? ` && (${this.health[kind]})` : '';
  const check = await this.send('Runtime.evaluate', {expression: `window.${MARKER}===${mark} && document.readyState !== 'loading'${healthy}`, returnByValue: true}, sessionId);
  if (check?.result?.value === true) { this.injected.set(targetId, kind); this.failures.delete(targetId); return true; }
  if (this.injected.has(targetId)) { this.injected.delete(targetId); this.log('Janela ' + kind + ' perdeu o painel; reinjetando.'); }
  // Falhas seguidas: espera mais entre as tentativas (sem desistir).
  const fails = this.failures.get(targetId) || 0; if (fails >= 3 && Date.now() - (this.failedAt?.get(targetId) || 0) < Math.min(300000, 15000 * fails)) return false;
  const ready = await this.send('Runtime.evaluate', {expression: 'document.readyState', returnByValue: true}, sessionId);
  if (ready?.result?.value === 'loading') { this.schedule(targetId, 500); return false; }
  // A Steam acabou de abrir: a interface dela ainda está montando. Injetar agora (script grande no contexto principal)
  // travava o steamwebhelper ("não está respondendo") quando o Taiga Launcher já estava aberto antes da Steam.
  // Espera a janela ter alguns segundos de vida (no contexto principal, também o SteamClient pronto).
  try {
   const minAge = kind === 'shared' ? 15000 : 4000;
   const st = await this.send('Runtime.evaluate', {expression: `({age: performance.now(), client: !!(window.SteamClient && window.SteamClient.Apps)})`, returnByValue: true}, sessionId);
   const v = st?.result?.value;
   const age = Number(v?.age) || 0, client = !!v?.client;
   if (v && typeof v === 'object' && typeof v.age === 'number' && age < minAge || (v && typeof v === 'object' && typeof v.age === 'number' && kind === 'shared' && !client)) { this.schedule(targetId, Math.max(1000, Math.min(minAge - age, 15000))); return false; }
  } catch {}
  let scripts = null;
  try { scripts = await this.scripts(); } catch (e) { this.lastError = 'Falha ao montar o script (' + kind + '): ' + String(e?.message || e).slice(0, 180); this.log(this.lastError); this.fail(targetId); return false; }
  const source = scripts?.[kind];
  if (!source) { if (kind === 'shared') { this.lastError = 'Script do contexto da Steam vazio.'; this.log(this.lastError); } return false; }
  // A marca só é gravada depois que o script inteiro rodou: se ele falhar, a próxima verificação tenta de novo.
  const result = await this.send('Runtime.evaluate', {expression: `${source}\n;window.${MARKER}=${mark};true`, allowUnsafeEvalBlockedByCSP: true, returnByValue: true}, sessionId);
  if (result?.exceptionDetails) { this.lastError = 'Erro no script (' + kind + '): ' + String(result.exceptionDetails.exception?.description || result.exceptionDetails.text || '').slice(0, 180); this.log(this.lastError); this.fail(targetId); return false; }
  this.injected.set(targetId, kind);
  this.log('Painel injetado em ' + kind + '.');
  return true;
 }
 fail(targetId) { this.failures.set(targetId, (this.failures.get(targetId) || 0) + 1); (this.failedAt ||= new Map()).set(targetId, Date.now()); }
 // Reinjeta tudo (ex.: catálogo ou idioma mudou).
 async reload() {
  for (const id of this.sessions.keys()) {
   if (this.kinds.get(id) === 'shared' && this.refreshExpression && this.injected.has(id)) { const expr = await this.refreshExpression(); await this.send('Runtime.evaluate', {expression: expr, returnByValue: true}, this.sessions.get(id)).catch(() => {}); continue; }
   await this.send('Runtime.evaluate', {expression: `delete window.${MARKER};true`}, this.sessions.get(id)).catch(() => {}); this.injected.delete(id); this.schedule(id, 100);
  }
 }
 // Avalia uma expressão no contexto compartilhado da Steam (SharedJSContext).
 async evaluateShared(expression) {
  const id = [...this.sessions.keys()].find(k => this.kinds.get(k) === 'shared' && this.injected.has(k)); if (!id) return undefined;
  const r = await this.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, this.sessions.get(id)).catch(() => null);
  return r?.result?.value;
 }
 async handleCall(sessionId, params) {
  let req; try { req = JSON.parse(String(params.payload || '')); } catch { return; }
  const id = Number(req?.id); if (!Number.isInteger(id)) return;
  let ok = true, payload;
  const targetId = [...this.sessions].find(([, s]) => s === sessionId)?.[0], kind = targetId ? this.kinds.get(targetId) : null;
  try { payload = await this.onCall(String(req.method || ''), req.args && typeof req.args === 'object' ? req.args : {}, kind); this.calls++; }
  catch (e) { ok = false; payload = String(e?.message || e).slice(0, 500); this.lastCallError = String(req.method) + ': ' + payload; }
  const expression = `window.__taiga_ffi_resolve__&&window.__taiga_ffi_resolve__(${id},${ok},${JSON.stringify(typeof payload === 'string' ? payload : JSON.stringify(payload ?? null))})`;
  await this.send('Runtime.evaluate', {expression, ...(params.executionContextId ? {contextId: params.executionContextId} : {})}, sessionId).catch(() => {});
 }
 // Notificação nativa da Steam (toast de conquista) pelo contexto compartilhado; desktop/Big Picture como reserva.
 async notify(payload) {
  const order = ['shared', 'bigpicture', 'library'];
  const targets = [...this.sessions.keys()].filter(id => this.injected.has(id)).sort((a, b) => order.indexOf(this.kinds.get(a)) - order.indexOf(this.kinds.get(b)));
  for (const id of targets) {
   try {
    const r = await this.send('Runtime.evaluate', {expression: `(async()=>{const f=window.__TAIGA_NOTIFY__;return f?await f(${JSON.stringify(payload)}):false})()`, awaitPromise: true, returnByValue: true}, this.sessions.get(id));
    if (r?.result?.value === true) return true;
    this.log('Notificação nativa não mostrada (' + (this.kinds.get(id) || '?') + '): ' + String(r?.result?.value ?? r?.exceptionDetails?.text ?? 'sem resposta').slice(0, 160));
   } catch (e) { this.log('Notificação nativa: ' + String(e?.message || e).slice(0, 160)); }
  }
  return false;
 }
}
