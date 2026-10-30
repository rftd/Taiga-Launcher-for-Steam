// Logins e chaves guardados no config.json protegidos pelo Windows (DPAPI, via safeStorage do Electron): só o mesmo
// usuário do Windows, neste PC, consegue ler. Sem o Electron (testes, servidor avulso) os valores ficam como estão.
export const SECRET_FIELDS = ['epicAuth', 'xboxAuth', 'psnAuth', 'raToken', 'raKey', 'raPassword', 'steamKey', 'own_sgdbKey', 'own_igdbId', 'own_igdbSecret', 'ps4TrophyKey', 'profileKey', 'commentsAuth'];
const PREFIX = 'enc:v1:';

export function openSecrets(config, box) {
 if (!box?.available?.()) return config;
 for (const k of SECRET_FIELDS) {
  const v = config[k];
  if (typeof v !== 'string' || !v.startsWith(PREFIX)) continue;
  try { const raw = box.decrypt(v.slice(PREFIX.length)); const parsed = JSON.parse(raw); config[k] = parsed; } catch { config[k] = k.endsWith('Auth') ? null : ''; }
 }
 return config;
}

// Cópia do config para gravar em disco, com os campos sensíveis cifrados.
export function sealSecrets(config, box) {
 const out = {};
 for (const k of Object.keys(config)) out[k] = config[k];
 if (!box?.available?.()) return out;
 for (const k of SECRET_FIELDS) {
  const v = out[k];
  if (v === undefined || v === null || v === '' || (typeof v === 'string' && v.startsWith(PREFIX))) continue;
  try { out[k] = PREFIX + box.encrypt(JSON.stringify(v)); } catch {}
 }
 return out;
}
