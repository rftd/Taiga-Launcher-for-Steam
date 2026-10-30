import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {createApp} from '../server.mjs';
test('Failed plugin initialization permits reinjection while a waiting loader remains single',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-steam-retry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const app=createApp({dataDir:dir,port:0});t.after(()=>app.server.close());const {shared}=await app.injector.scripts();
 const timers=[],win={console,setTimeout:f=>timers.push(f),clearTimeout(){},addEventListener(){},document:{readyState:'complete',querySelector:()=>null,querySelectorAll:()=>[]}};win.window=win;const ctx=vm.createContext(win);
 vm.runInContext(shared,ctx);assert.equal(ctx.__TAIGA_NGL_STATE__,'waiting');const before=timers.length;vm.runInContext(shared,ctx);assert.equal(timers.length,before);
 ctx.__TAIGA_NGL_STATE__='error';ctx.__TAIGA_NGL_ERROR__='previous initialization failed';ctx.__TAIGA_NGL_MODULE__={broken:true};vm.runInContext(shared,ctx);
 assert.equal(ctx.__TAIGA_NGL_STATE__,'waiting');assert.equal(ctx.__TAIGA_NGL_MODULE__,undefined);assert.equal(ctx.__TAIGA_NGL_ERROR__,null);assert.ok(timers.length>before);
});
test('Native notification resolves a differently named Steam webpack chunk',async()=>{
 const source=fs.readFileSync(new URL('../steam/shared.notify.js',import.meta.url),'utf8');
 class Proto{getClassName(){return 'CClientNotificationAchievement';}static fromObject(){return {serializeBinary:()=>new Uint8Array([1])};}}
 const store={m_rgNotificationToasts:[],m_rgNotificationTray:[],OnNotification(id){this.m_rgNotificationToasts.push({notificationID:id});}};
 const chunk=[];chunk.push=entry=>entry[2]({c:{1:{exports:{Proto}},2:{exports:{store}}}});
 const win={webpackChunkclientui:chunk,setTimeout(){},SteamClient:{Sounds:{PlaySound(){}}}};win.window=win;
 const ctx=vm.createContext(win);vm.runInContext(source,ctx);assert.equal(await ctx.__TAIGA_NOTIFY__({id:'fixture',title:'Fixture'}),true);assert.equal(store.m_rgNotificationToasts.length,1);
 const other={__TAIGA_NGL_HOST__:{modules:()=>new Map([['proto',{Proto}],['store',{store}]])},setTimeout(){}};other.window=other;const hostCtx=vm.createContext(other);vm.runInContext(source,hostCtx);assert.equal(await hostCtx.__TAIGA_NOTIFY__({id:'host-fixture'}),true);
});

test('Refresh panel reinjects an unhealthy shared plugin rather than only refreshing its catalog',async()=>{
 const {SteamInjector}=await import('../lib/steam-inject.mjs');const expressions=[],scheduled=[];
 const injector=new SteamInjector({health:{shared:'pluginHealthy'},refreshExpression:async()=>'refreshCatalog()'});
 injector.sessions.set('target','session');injector.kinds.set('target','shared');injector.injected.set('target','shared');
 injector.send=async(method,args)=>{expressions.push(args.expression);return {result:{value:false}};};injector.schedule=(id)=>scheduled.push(id);
 await injector.reloadNow();assert.ok(expressions.some(e=>e.includes('delete window.__TAIGA_INJECTED__')));assert.ok(!expressions.includes('refreshCatalog()'));assert.deepEqual(scheduled,['target']);assert.equal(injector.injected.has('target'),false);
});
