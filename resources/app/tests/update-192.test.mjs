// TaigaSteam 1.9.2, a página do jogo na Steam (NativeGameLink) não pode sumir.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {encodeVDF,uint} from '../lib/vdf.mjs';
import {SteamInjector} from '../lib/steam-inject.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-192-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const write=(f,c)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);return f;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shortcut=(i,sid,name,exe)=>({type:0,key:String(i),value:[{type:2,key:'appid',value:uint(sid)},{type:1,key:'AppName',value:name},{type:1,key:'Exe',value:'"'+exe+'"'},{type:1,key:'StartDir',value:'"'+path.dirname(exe)+'"'},{type:1,key:'LaunchOptions',value:''}]});

test('Game added with Steam open keeps its page: the NGL orphan sweep cannot dismiss it; PC games without AppID get a page',async t=>{
 const {createApp}=await import('../server.mjs');
 const d=tmp(t),data=path.join(d,'data'),steam=path.join(d,'Steam'),acct='12345';write(path.join(steam,'steam.exe'),'');
 const onDisk=write(path.join(d,'games','Old','old.exe'),'MZ'),fnaf=write(path.join(d,'games','FNAF','fnaf.exe'),'MZ'),indie=write(path.join(d,'games','Indie','indie.exe'),'MZ');
 // Só o jogo antigo está no shortcuts.vdf; os outros dois foram adicionados ao vivo (a Steam ainda não gravou o arquivo).
 write(path.join(steam,'userdata',acct,'config','shortcuts.vdf'),encodeVDF([{type:0,key:'shortcuts',value:[shortcut(0,3000000001,'Old',onDisk)]}]));
 write(path.join(data,'config.json'),JSON.stringify({steamDir:steam,account:acct,language:'pt-BR',languageChosen:true,roots:[]}));
 write(path.join(data,'games.json'),JSON.stringify({version:1,games:[
  {id:'old',uuid:'11111111-1111-4111-8111-111111111111',title:'Old',profile:'pc',path:onDisk,bindings:{[acct]:3000000001},metadataSteamAppId:10,art:{},metadata:{}},
  {id:'fnaf',uuid:'22222222-2222-4222-8222-222222222222',title:'Five Nights at Freddy\'s: Into the Pit',profile:'pc',path:fnaf,bindings:{[acct]:3000000002},metadataSteamAppId:2638370,art:{},metadata:{}},
  {id:'indie',uuid:'33333333-3333-4333-8333-333333333333',title:'Indie',profile:'pc',path:indie,bindings:{[acct]:3000000003},nglDismissed:true,art:{},metadata:{summary:'A small game.',summaryLanguage:'en'}}]}));
 const port=41000+Math.floor(Math.random()*8000),app=createApp({dataDir:data,port});t.after(()=>new Promise(r=>app.server.close(r)));
 // Migração: a página desligada pela limpeza automática volta.
 let maps=JSON.parse(await app.nglBackend.call('get_all_mappings',{}));
 assert.equal(maps['shortcut:3000000002'],'2638370');
 assert.ok(Number(maps['shortcut:3000000003'])>=1900000000,'jogo de PC sem AppID da Steam também tem página (AppID virtual)');
 // A lista de atalhos que o NGL usa para a limpeza inclui os jogos adicionados ao vivo.
 const list=JSON.parse(await app.nglBackend.call('list_shortcuts',{}));
 assert.deepEqual(list.shortcuts.map(s=>s.shortcut_app_id).sort(),['3000000001','3000000002','3000000003']);
 // Mesmo que a limpeza peça a remoção, um atalho ainda não gravado não perde a página.
 await app.nglBackend.call('update_mappings',{request_json:JSON.stringify({set:{},remove:['shortcut:3000000002','shortcut:3000000003']})});
 maps=JSON.parse(await app.nglBackend.call('get_all_mappings',{}));
 assert.equal(maps['shortcut:3000000002'],'2638370');assert.ok(maps['shortcut:3000000003']);
 // Um pedido explícito para um atalho que está no disco continua valendo.
 const gamesFile=()=>JSON.parse(fs.readFileSync(path.join(data,'games.json'),'utf8')).games;
 await app.nglBackend.call('update_mappings',{request_json:JSON.stringify({set:{},remove:['shortcut:3000000001']})});
 assert.equal(gamesFile().find(g=>g.id==='old').nglDismissed,undefined,'limpeza automática não desliga jogo do Taiga Launcher');
 await app.nglBackend.call('update_mappings',{request_json:JSON.stringify({set:{},remove:['shortcut:3000000001'],explicit:true})});
 assert.equal(gamesFile().find(g=>g.id==='old').nglDismissed,true);
 assert.equal(gamesFile().find(g=>g.id==='fnaf').nglDismissed,undefined);
});

test('Live add never creates a second shortcut: same-name shortcut is reused, art goes one image at a time',async()=>{
 const apps=new Map([[2915423700,{appid:2915423700,app_type:1073741824,display_name:'God of War III: Remastered'}],[2915423799,{appid:2915423799,app_type:1073741824,display_name:'Outro'}]]);const calls=[];
 const SteamClient={Apps:{AddShortcut:async()=>{calls.push('add');return 2915423711;},SetShortcutName:async()=>{},SetShortcutExe:async()=>{},SetShortcutStartDir:async()=>{},SetShortcutLaunchOptions:async()=>{},SetCustomArtworkForApp:async(id,b,e,type)=>{calls.push('art'+type);}}};
 const ctx=vm.createContext({window:{SteamClient,appStore:{allApps:[...apps.values()],GetAppOverviewByAppID:id=>apps.get(id)||null}},setTimeout,Promise,JSON,String,Number,Array,Set});
 const fn=vm.runInContext(fs.readFileSync(new URL('../steam/live-sync.js',import.meta.url),'utf8'),ctx);
 const r=JSON.parse(await fn({appid:0,name:'God of War III: Remastered',exe:'"x"',startDir:'"y"',options:'',art:[],taken:[]},''));
 assert.equal(r.ok,true);assert.equal(r.appid,2915423700);assert.equal(r.created,false);assert.ok(!calls.includes('add'));
 // Atalho com o mesmo nome que pertence a outro jogo do TaigaSteam não é tomado.
 apps.set(2915423711,{appid:2915423711,app_type:1073741824,display_name:'God of War III: Remastered'});
 const r2=JSON.parse(await fn({appid:0,name:'God of War III: Remastered',exe:'"x"',startDir:'"y"',options:'',art:[],taken:[2915423700]},''));
 assert.equal(r2.created,true);assert.equal(r2.appid,2915423711);
 const a=JSON.parse(await fn({appid:2915423711,artOnly:true,art:[{type:1,ext:'png',b64:'AA=='}]},''));assert.equal(a.ok,true);assert.ok(calls.includes('art1'));
});

test('Injector re-injects a window whose page plugin failed, and reports script build errors',async t=>{
 const injected=new Map(),logs=[];let state='error',buildFails=false;
 class FakeWS extends EventTarget{constructor(url){super();this.url=url;this.readyState=0;setTimeout(()=>{this.readyState=1;this.dispatchEvent(new Event('open'));},5);}
  close(){this.readyState=3;}
  send(raw){const m=JSON.parse(raw),reply=result=>setTimeout(()=>{const e=new Event('message');e.data=JSON.stringify({id:m.id,result});this.dispatchEvent(e);},1);
   if(m.method==='Target.getTargets')return reply({targetInfos:[{targetId:'S',type:'page',title:'SharedJSContext',url:'https://steamloopback.host/'}]});
   if(m.method==='Target.attachToTarget')return reply({sessionId:'s-'+m.params.targetId});
   if(m.method==='Runtime.evaluate'){const e=m.params.expression;if(e.startsWith('window.__TAIGA_INJECTED__==='))return reply({result:{value:injected.has(m.sessionId)&&state!=='error'}});if(e==='document.readyState')return reply({result:{value:'complete'}});if(/;window.__TAIGA_INJECTED__="[a-z:.0-9]+";true$/.test(e)){injected.set(m.sessionId,(injected.get(m.sessionId)||0)+1);state='ready';return reply({result:{value:true}});}}
   reply({});}}
 const inj=new SteamInjector({port:8080,WebSocketImpl:FakeWS,interval:50,verifyEvery:100,log:m=>logs.push(m),health:{shared:"window.__TAIGA_NGL_STATE__!=='error'"},fetchImpl:async()=>({ok:true,json:async()=>({webSocketDebuggerUrl:'ws://127.0.0.1:8080/devtools/browser/abc'})}),scripts:async()=>{if(buildFails)throw Error('catálogo quebrado');return {shared:'2'};}});
 t.after(()=>inj.stop());inj.start();await sleep(600);
 assert.equal(injected.get('s-S'),1);
 state='error';await sleep(600);
 assert.equal(injected.get('s-S'),2,'falhou depois de injetado: injeta de novo sozinho');
 assert.ok(logs.some(l=>/reinjetando/.test(l)));
 buildFails=true;state='error';await sleep(600);
 assert.ok(logs.some(l=>/catálogo quebrado/.test(l)),'erro ao montar o script aparece no registro');
 inj.stop();
});

// ── 1.9.3: troféus de ports (SpartanPort e parecidos) ──
import crypto from 'node:crypto';
import {readTRP,decryptESFM,parsePortTrophyLines,portTrophyDefinitions,PortTrophyStore,readPortTrophies,PortLogWatcher,portLogFiles} from '../lib/port-trophies.mjs';
import {consoleTitleNear} from '../lib/console-port.mjs';
import {otherFormats} from '../lib/local-achievements.mjs';
const sfoOf = (title, code) => { const keys = ['TITLE', 'TITLE_ID'], vals = [title, code]; const kt = Buffer.from(keys.join('\0') + '\0'), dt = Buffer.concat(vals.map(v => { const b = Buffer.alloc(64); b.write(v); return b; })); const h = Buffer.alloc(20 + keys.length * 16); h.writeUInt32LE(0x46535000, 0); h.writeUInt32LE(0x101, 4); h.writeUInt32LE(20 + keys.length * 16, 8); h.writeUInt32LE(20 + keys.length * 16 + kt.length, 12); h.writeUInt32LE(keys.length, 16); let ko = 0; keys.forEach((k, i) => { const p = 20 + i * 16; h.writeUInt16LE(ko, p); h.writeUInt16LE(0x204, p + 2); h.writeUInt32LE(vals[i].length + 1, p + 4); h.writeUInt32LE(64, p + 8); h.writeUInt32LE(i * 64, p + 12); ko += k.length + 1; }); return Buffer.concat([h, kt, dt]); };
const PNG = n => Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('icon' + n)]);
const trp = files => { const head = Buffer.alloc(0x60), entries = Buffer.alloc(files.length * 0x40); head.writeUInt32BE(0xDCA24D00, 0); head.writeUInt32BE(files.length, 0x10); head.writeUInt32BE(0x40, 0x14); let pos = 0x60 + entries.length; const bodies = []; files.forEach(([name, data], i) => { entries.write(name, i * 0x40, 'latin1'); entries.writeBigUInt64BE(BigInt(pos), i * 0x40 + 32); entries.writeBigUInt64BE(BigInt(data.length), i * 0x40 + 40); bodies.push(data); pos += data.length; }); return Buffer.concat([head, entries, ...bodies]); };
const esfm = (xml, key, comm) => { const c = Buffer.alloc(16); Buffer.from(comm).copy(c); const e = crypto.createCipheriv('aes-128-cbc', key, Buffer.alloc(16)); e.setAutoPadding(false); const setKey = Buffer.concat([e.update(c), e.final()]); const iv = crypto.randomBytes(16), plain = Buffer.from(xml), padded = Buffer.concat([plain, Buffer.alloc((16 - plain.length % 16) % 16)]); const enc = crypto.createCipheriv('aes-128-cbc', setKey, iv); enc.setAutoPadding(false); return Buffer.concat([iv, enc.update(padded), enc.final()]); };
const XML = lang => `<?xml version="1.0"?><trophyconf version="1.1"><title-name>God of War III</title-name><trophy id="000" hidden="no" ttype="P"><name>${lang} Platina</name><detail>Todos</detail></trophy><trophy id="001" hidden="no" ttype="B"><name>${lang} Um</name><detail>Primeiro</detail></trophy><trophy id="002" hidden="yes" ttype="G"><name>${lang} Dois</name><detail>Segundo</detail></trophy></trophyconf>`;

test('Port trophies: list from the dump (TRP decrypted with the user key, icons always), unlocks from the port log, platinum computed', async t => {
 const d = tmp(t), port = path.join(d, 'SpartanPort'), dump = path.join(d, 'GOW3'), key = crypto.randomBytes(16), comm = 'NPWR07890_00';
 const exe = write(path.join(port, 'SpartanPort.exe'), 'MZ');
 write(path.join(port, 'settings.json'), JSON.stringify({game_dir: dump, user_dir: path.join(port, 'saves')}));
 write(path.join(dump, 'Sc0', 'param.sfo'), sfoOf('God of War III Remastered', 'CUSA01623'));
 write(path.join(dump, 'sce_sys', 'npbind.dat'), Buffer.concat([Buffer.alloc(40), Buffer.from(comm), Buffer.alloc(20)]));
 write(path.join(dump, 'Sc0', 'trophy', 'trophy00.trp'), trp([['TROPCONF.ESFM', esfm(XML('EN'), key, comm)], ['TROP.ESFM', esfm(XML('EN'), key, comm)], ['TROP_17.ESFM', esfm(XML('PT'), key, comm)], ['TROP000.PNG', PNG(0)], ['TROP001.PNG', PNG(1)], ['TROP002.PNG', PNG(2)]]));
 assert.equal(readTRP(fs.readFileSync(path.join(dump, 'Sc0', 'trophy', 'trophy00.trp'))).length, 6);
 assert.deepEqual(parsePortTrophyLines('Runtime: trophy 1 unlocked\nfoo\nRuntime: trophy 12 unlocked\nUnlocking trophy id 3\n'), [1, 12, 3]);
 const info = consoleTitleNear(exe); assert.equal(info.code, 'CUSA01623'); assert.equal(info.dump, dump); assert.equal(info.platform, 'PlayStation 4');
 // Sem a chave: só os ícones, com nomes genéricos no idioma do programa.
 const data = path.join(d, 'data'); const noKey = portTrophyDefinitions(info, {config: {language: 'pt-BR'}, dataDir: data, env: {}, exeDir: port});
 assert.equal(noKey.detail, 'icons'); assert.equal(noKey.achievements.length, 3); assert.equal(noKey.achievements[1].title, 'Troféu 2'); assert.match(noKey.achievements[0].icon, /^\/art\/[a-f0-9]+\.png$/);
 // Com a chave que o usuário já usa no shadPS4 (keys.json): nomes em português (TROP_17), tipo e oculto.
 write(path.join(port, 'user', 'keys.json'), JSON.stringify({TrophyKeySet: {ReleaseTrophyKey: key.toString('hex')}}));
 const full = portTrophyDefinitions(info, {config: {language: 'pt-BR'}, dataDir: data, env: {}, exeDir: port});
 assert.equal(full.detail, 'full'); assert.equal(full.set, comm); assert.equal(full.sourceLanguage, 'pt-BR'); assert.deepEqual(full.achievements.map(a => [a.title, a.grade, a.hidden]), [['PT Platina', 'P', false], ['PT Um', 'B', false], ['PT Dois', 'G', true]]);
 assert.equal(decryptESFM(esfm(XML('EN'), key, comm), crypto.randomBytes(16), comm), null, 'chave errada não gera lixo');
 // Log do port: troféus entram no progresso; platina sai sozinha.
 const store = new PortTrophyStore(data), game = {uuid: '44444444-4444-4444-8444-444444444444', path: exe, profile: 'pc', title: 'God of War III Remastered'};
 assert.ok(portLogFiles(exe).includes(path.join(port, 'saves', 'last_run.log')));
 const log = write(path.join(port, 'saves', 'last_run.log'), 'Runtime: boot\n'); const seen = [];
 const w = new PortLogWatcher({games: () => [{game, file: log}], onUnlock: (g, id, o) => { seen.push([id, o.live]); store.record(g.uuid, id); }, interval: 30});
 w.start(); await sleep(80); fs.appendFileSync(log, 'Runtime: trophy 1 unlocked\n'); await sleep(120);
 fs.appendFileSync(log, 'Runtime: trophy 2 unlo'); await sleep(80); fs.appendFileSync(log, 'cked\n'); await sleep(120); w.stop();
 assert.deepEqual(seen, [[1, true], [2, true]], 'linha pela metade espera completar');
 const r = readPortTrophies(game, info, {config: {language: 'pt-BR'}, dataDir: data, store, env: {}});
 assert.equal(r.provider, 'port'); assert.deepEqual(r.achievements.map(a => a.unlocked), [true, true, true]);
 assert.equal(store.record(game.uuid, 2), false, 'o mesmo troféu não conta duas vezes');
});

test('More Steam-emulator save formats (SKIDROW, 3DM, RLD!, user_stats, Razor1911) are read', () => {
 assert.deepEqual(otherFormats('[Achievements]\nA=1@0@1700000000\nB=0@0@0'), {A: {earned: 1, earned_time: 1700000000}, B: {earned: 0, earned_time: 0}});
 assert.equal(otherFormats('[State]\nA=0101\n[Time]\nA=00F1536500000000').A.earned_time, 1700000000);
 assert.equal(otherFormats('[Steam]\nAppID=1\n[A]\nState=01000000\nTime=00F15365').A.earned, 1);
 assert.equal(otherFormats('[ACHIEVEMENTS]\n"A" = {unlocked = true, time = 5}').A.earned_time, 5);
 assert.equal(otherFormats('A 1 9\n', 'x/achievement').A.earned, 1);
 assert.equal(otherFormats('[ACH]\nAchieved=1'), null, 'formato comum continua com o leitor padrão');
});


test('Concurrent injector checks share one CDP injection per target',async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});let injections=0,checks=0;
 const inj=new SteamInjector({scripts:async()=>({shared:'2'})});inj.sessions.set('S','s-S');inj.kinds.set('S','shared');
 inj.send=async(_method,{expression})=>{
  if(expression.startsWith('window.__TAIGA_INJECTED__===')){checks++;await gate;return {result:{value:injections>0}};}
  if(expression==='document.readyState')return {result:{value:'complete'}};
  if(expression.endsWith(';true')){injections++;return {result:{value:true}};}
  return {};
 };
 const first=inj.ensure('S'),second=inj.ensure('S');assert.equal(checks,1);release();
 assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.equal(injections,1);assert.equal(inj.ensuring.size,0);
 await inj.ensure('S');assert.equal(injections,1,'healthy windows are not injected twice');
});
