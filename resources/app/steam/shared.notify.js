/* Taiga Launcher, notificação nativa de conquista no contexto principal da Steam (SharedJSContext).
   Mesma técnica do NativeGameLink for Steam (MIT): monta a mensagem protobuf CClientNotificationAchievement
   encontrada no webpack da Steam e entrega ao NotificationStore como uma notificação de conquista (tipo 5),
   com o som padrão. Se a Steam mudar e algo não for encontrado, devolve false e o Taiga Launcher usa a
   notificação própria da página. */
(()=>{
 'use strict';
 const TYPE=5,DURATION=5000;let proto=null,storeRef=null,nextId=-7000,active=null;
 function webpackModules(){
  const out=[],add=e=>{if(!e)return;out.push(e);if(typeof e==='object')for(const v of Object.values(e))if(v&&(typeof v==='object'||typeof v==='function'))out.push(v);};
  // O host já resolve módulos nas versões da Steam que não expõem o cache req.c.
  try{const modules=window.__TAIGA_NGL_HOST__?.modules?.();if(modules?.values)for(const e of modules.values())add(e);}catch{}
  if(out.length)return out;
  const chunk=window.__TAIGA_NGL_HOST__?.webpackChunk?.()||window.webpackChunksteamui||window.webpackChunk||Object.keys(window).filter(k=>/^webpackChunk/.test(k)).map(k=>window[k]).find(v=>typeof v?.push==='function');
  if(!chunk||typeof chunk.push!=='function')return out;let req=null;try{chunk.push([[Symbol('taiga-notify')],{},r=>{req=r;}]);}catch{return out;}
  for(const id of Object.keys(req?.c||{}))try{add(req.c[id]?.exports);}catch{}
  return out;
 }
 function findProto(){if(proto)return proto;for(const c of webpackModules()){try{if(typeof c?.fromObject==='function'&&typeof c?.prototype?.getClassName==='function'&&c.prototype.getClassName.call(c.prototype)==='CClientNotificationAchievement'){proto=c;break;}}catch{}}return proto;}
 function findStore(){if(storeRef)return storeRef;const ok=s=>typeof s?.OnNotification==='function'&&Array.isArray(s.m_rgNotificationToasts)&&Array.isArray(s.m_rgNotificationTray);if(ok(window.NotificationStore))return storeRef=window.NotificationStore;for(const c of webpackModules())if(ok(c))return storeRef=c;return null;}
 function retireTray(store,id){try{for(const group of [...store.m_rgNotificationTray]){const list=group.notifications||[];const i=list.findIndex(n=>n.notificationID===id);if(i<0)continue;list.splice(i,1);if(!list.length)store.m_rgNotificationTray.splice(store.m_rgNotificationTray.indexOf(group),1);}store.m_cbkNotificationTray?.Dispatch?.(store.m_rgNotificationTray);}catch{}}
 function sound(){try{const s=window.SteamClient?.Sounds;if(typeof s?.PlaySound==='function')s.PlaySound(5);else if(typeof s?.PlayNavSound==='function')s.PlayNavSound(5);}catch{}}
 window.__TAIGA_NOTIFY__=async payload=>{
  try{
   // Primeiro o caminho nativo do NativeGameLink (reconhece a janela do jogo, o Big Picture e a área de trabalho).
   try{const ngl=window.__TAIGA_NGL_NATIVE_TOAST__;if(typeof ngl==='function'&&ngl(payload.appid||0,{name:String(payload.id||''),display_name:String(payload.title||''),description:String(payload.description||''),icon:String(payload.icon||''),icon_gray:String(payload.icon||''),hidden:false,global_percent:Number(payload.globalPercent)||0,earned:true,earned_time:Math.floor((Date.parse(payload.date||'')||Date.now())/1000),progress:0,max_progress:0})){sound();return true;}}catch{}
   const P=findProto(),store=findStore();if(!P)return 'sem-proto';if(!store)return 'sem-store';
   const msg=P.fromObject({achievement_id:String(payload.id||''),appid:Number(payload.appid)||0,name:String(payload.title||''),description:String(payload.description||''),image_url:String(payload.icon||''),achieved:true,rtime_unlocked:Math.floor((Date.parse(payload.date||'')||Date.now())/1000),min_progress:0,current_progress:0,max_progress:0,global_achieved_pct:Number(payload.globalPercent)||0});
   const binary=msg?.serializeBinary?.();if(!binary)return 'sem-binario';
   const id=nextId--;
   if(active){try{store.ExpireToast?.(active);}catch{}active=null;}
   store.OnNotification(id,TYPE,binary);retireTray(store,id);
   const toast=store.m_rgNotificationToasts.find(n=>n.notificationID===id);if(!toast)return 'sem-toast';
   active=toast;setTimeout(()=>{if(active===toast){try{store.ExpireToast?.(toast);}catch{}active=null;}},DURATION);
   sound();return true;
  }catch(e){return 'erro: '+String(e&&e.message||e).slice(0,120);}
 };
})();
