// Conta Microsoft/Xbox (como o Playnite): login na página oficial da Microsoft numa janela separada; o token
// volta no endereço de retorno e vira um token do Xbox Live (XSTS) para ler as conquistas. Somente leitura.
export const XBOX_CLIENT_ID = '000000004C12AE6F';
export const XBOX_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
export const XBOX_REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
export const XBOX_LOGIN_URL = 'https://login.live.com/oauth20_authorize.srf?' + new URLSearchParams({client_id: XBOX_CLIENT_ID, redirect_uri: XBOX_REDIRECT, response_type: 'token', display: 'touch', scope: XBOX_SCOPE, locale: 'pt-BR'});
export const XBOX_REDIRECT_RE = /^https:\/\/login\.live\.com\/oauth20_desktop\.srf/;

// Lê o fragmento "#access_token=…&refresh_token=…&expires_in=…" do endereço de retorno.
export function tokenFromRedirect(url) {
  const hash = String(url || '').split('#')[1] || ''; const p = new URLSearchParams(hash);
  const access = p.get('access_token'); if (!access) return null;
  return {accessToken: access, refreshToken: p.get('refresh_token') || '', expiresAt: Date.now() + Number(p.get('expires_in') || 3600) * 1000};
}
const json = async (fetchImpl, url, init) => { const r = await fetchImpl(url, {...init, signal: AbortSignal.timeout(20000)}); if (!r.ok) throw Error('Xbox respondeu HTTP ' + r.status + '.'); return r.json(); };

export async function refreshMsa(refreshToken, fetchImpl = (...a) => fetch(...a)) {
  const d = await json(fetchImpl, 'https://login.live.com/oauth20_token.srf', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'refresh_token', client_id: XBOX_CLIENT_ID, scope: XBOX_SCOPE, refresh_token: refreshToken, redirect_uri: XBOX_REDIRECT}).toString()});
  return {accessToken: d.access_token, refreshToken: d.refresh_token || refreshToken, expiresAt: Date.now() + Number(d.expires_in || 3600) * 1000};
}
// MSA → token de usuário → XSTS (com xuid, uhs e gamertag).
export async function xstsFromMsa(msa, fetchImpl = (...a) => fetch(...a)) {
  const user = await json(fetchImpl, 'https://user.auth.xboxlive.com/user/authenticate', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-xbl-contract-version': '1'}, body: JSON.stringify({RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT', Properties: {AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: msa.accessToken}})});
  const x = await json(fetchImpl, 'https://xsts.auth.xboxlive.com/xsts/authorize', {method: 'POST', headers: {'Content-Type': 'application/json', 'x-xbl-contract-version': '1'}, body: JSON.stringify({RelyingParty: 'http://xboxlive.com', TokenType: 'JWT', Properties: {UserTokens: [user.Token], SandboxId: 'RETAIL'}})});
  const claim = x.DisplayClaims?.xui?.[0] || {};
  return {token: x.Token, uhs: claim.uhs, xuid: claim.xid || '', gamertag: claim.gtg || '', notAfter: Date.parse(x.NotAfter || '') || Date.now() + 3600000};
}
// Sessão válida: renova o login da Microsoft e o XSTS quando vencem.
export async function validXbox(auth, {fetchImpl = (...a) => fetch(...a), save = () => {}} = {}) {
  if (!auth?.msa?.refreshToken && !auth?.msa?.accessToken) return null;
  let msa = auth.msa, changed = false;
  if (!msa.accessToken || msa.expiresAt - 60000 < Date.now()) { msa = await refreshMsa(msa.refreshToken, fetchImpl); changed = true; }
  let xsts = auth.xsts;
  if (changed || !xsts?.token || xsts.notAfter - 60000 < Date.now()) { xsts = await xstsFromMsa(msa, fetchImpl); changed = true; }
  const next = {...auth, msa, xsts, gamertag: xsts.gamertag || auth.gamertag || '', xuid: xsts.xuid || auth.xuid || ''};
  if (changed) save(next);
  return next;
}
export const xboxHeader = s => 'XBL3.0 x=' + s.xsts.uhs + ';' + s.xsts.token;
// Nome da família do pacote a partir do endereço de abertura "shell:AppsFolder\PFN!App".
export const pfnOf = game => String(game?.store?.url || game?.launch?.args || '').match(/AppsFolder\\([^!\\]+)!/i)?.[1] || String(game?.store?.pfn || '');
