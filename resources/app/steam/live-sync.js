/* Taiga Launcher, adiciona, atualiza ou remove um atalho com a Steam aberta (SharedJSContext), sem reiniciar.
   Mesmas funções do cliente da Steam usadas pela própria janela "Adicionar um jogo não Steam" e por plugins
   do Millennium/Decky: SteamClient.Apps.AddShortcut, SetShortcut*, SetCustomArtworkForApp e a coleção do usuário.
   Recebe um item por vez e devolve JSON {ok, appid} ou {ok:false, error}. */
(async function (item, collectionName) {
 'use strict';
 const apps = window.SteamClient && window.SteamClient.Apps;
 const overview = id => { try { return window.appStore && window.appStore.GetAppOverviewByAppID(Number(id) >>> 0) || null; } catch (e) { return null; } };
 const wait = ms => new Promise(r => setTimeout(r, ms));
 const call = async (fn, ...args) => { if (typeof apps[fn] !== 'function') return false; try { await Promise.resolve(apps[fn](...args)); return true; } catch (e) { return false; } };
 // collectionName: o nome da coleção principal ("Taiga Launcher") ou uma lista; os outros nomes são as coleções por
 // loja ("Epic Games", "Xbox"...), criadas quando ainda não existem.
 const collectionNames = (Array.isArray(collectionName) ? collectionName : [collectionName]).filter(Boolean);
 async function collectionNamed(name) {
  const cs = window.collectionStore; if (!name || !cs) return null;
  try {
   const main = name === 'Taiga Launcher';
   let col = main ? ((typeof cs.GetCollection === 'function' && (cs.GetCollection('taiga-steamtaiga') || cs.GetCollection('uc-taiga-steamtaiga'))) || null) : null;
   // "SteamTaiga" era o nome antigo da coleção (antes de o programa virar Taiga Launcher).
   const names = main ? [name, 'SteamTaiga'] : [name];
   if (!col) col = Array.from(cs.userCollections || []).find(c => c && !c.bIsDynamic && (names.includes(c.displayName) || names.includes(c.m_strName))) || null;
   if (!col && typeof cs.NewUnsavedCollection === 'function') { col = cs.NewUnsavedCollection(name, undefined, []); if (col && typeof col.Save === 'function') await col.Save(); }
   return col;
  } catch (e) { return null; }
 }
 async function collections() { const out = []; for (const n of collectionNames) { const c = await collectionNamed(n); if (c) out.push(c); } return out; }
 try {
  if (!apps || typeof apps.AddShortcut !== 'function') return JSON.stringify({ok: false, error: 'steamclient_unavailable'});
  if (item.remove) {
   if (item.appid && overview(item.appid)) { for (const col of await collections()) { try { if (col.AsDragDropCollection) col.AsDragDropCollection().RemoveApps([overview(item.appid)]); if (col.Save) await col.Save(); } catch (e) {} } await call('RemoveShortcut', Number(item.appid) >>> 0); }
   return JSON.stringify({ok: true, appid: Number(item.appid) || 0, removed: true});
  }
  // Só as artes (enviadas uma por vez: imagens grandes numa chamada só estouravam o tempo e geravam duplicatas).
  if (item.artOnly) {
   const id = Number(item.appid) >>> 0; if (!id || !overview(id)) return JSON.stringify({ok: false, error: 'not_found'});
   for (const art of item.art || []) { if (typeof apps.SetCustomArtworkForApp === 'function') { try { await apps.SetCustomArtworkForApp(id, art.b64, art.ext, art.type); } catch (e) {} } }
   return JSON.stringify({ok: true, appid: id});
  }
  let appid = item.appid && overview(item.appid) ? Number(item.appid) >>> 0 : 0, created = false;
  // Nunca cria um segundo atalho para o mesmo jogo: um atalho não Steam com o mesmo nome, que não pertence a
  // outro jogo do Taiga Launcher, é reaproveitado (ex.: a chamada anterior criou o atalho mas a resposta se perdeu).
  if (!appid) {
   try {
    const taken = new Set((item.taken || []).map(n => Number(n) >>> 0));
    const all = Array.from((window.appStore && (window.appStore.allApps || window.appStore.m_mapApps && window.appStore.m_mapApps.values && Array.from(window.appStore.m_mapApps.values()))) || []);
    const same = all.find(o => o && Number(o.app_type) === 1073741824 && String(o.display_name || '').trim() === String(item.name || '').trim() && !taken.has(Number(o.appid) >>> 0));
    if (same) appid = Number(same.appid) >>> 0;
   } catch (e) {}
  }
  if (!appid) { appid = Number(await apps.AddShortcut(item.name, item.exe, item.startDir, item.options)) >>> 0; created = true; }
  if (!appid) return JSON.stringify({ok: false, error: 'add_failed'});
  // A Steam às vezes ignora parte dos argumentos de AddShortcut: grava cada campo explicitamente.
  await call('SetShortcutName', appid, item.name);
  await call('SetShortcutExe', appid, item.exe);
  await call('SetShortcutStartDir', appid, item.startDir);
  await call('SetShortcutLaunchOptions', appid, item.options);
  if (item.icon) await call('SetShortcutIcon', appid, item.icon);
  for (const art of item.art || []) { if (typeof apps.SetCustomArtworkForApp === 'function') { try { await apps.SetCustomArtworkForApp(appid, art.b64, art.ext, art.type); } catch (e) {} } }
  for (let i = 0; i < 20 && !overview(appid); i++) await wait(100);
  for (const col of await collections()) { try { const ov = overview(appid); if (ov && col.AsDragDropCollection) { col.AsDragDropCollection().AddApps([ov]); if (col.Save) await col.Save(); } } catch (e) {} }
  return JSON.stringify({ok: !!overview(appid), appid, created});
 } catch (e) { return JSON.stringify({ok: false, error: String(e && e.message || e).slice(0, 300)}); }
})
