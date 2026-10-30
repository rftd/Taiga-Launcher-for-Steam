import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
// Exercise the frontend modules with only their Steam layout/services replaced.
const source=name=>stripTypeScriptTypes(fs.readFileSync(new URL('../../../third_party/nativegamelink/frontend/'+name,import.meta.url),'utf8'),{mode:'transform'}).replace(/import\s[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g,'').replace(/\bexport\s+/g,'');
test('Steam keeps an achievement section with an unknown initial total and paints a later local response',()=>{
 const nodes=new Map(),published=[];let cached=null;
 const node=id=>({id,dataset:{},isConnected:true,innerHTML:'',querySelector:()=>null,removeAttribute(){},remove(){nodes.delete(id);},addEventListener(){}});
 const doc={getElementById:id=>nodes.get(id)||null};const layout={anchorRegion:node('anchor'),sidebarColumn:node('column')};
 const order={column:layout.sidebarColumn,steamAppId:'1800000001',shortcutAppId:'3000000001',publish:n=>{published.push(n);return true;}};
 const ctx=vm.createContext({console,doc,layout,escapeHtml:s=>String(s),loc:(_k,f)=>f,gdlText:(_k,f)=>f,getLinkedSidebarOrder:()=>order,ensureLinkedSidebarOrder:()=>order,buildHistoricalSidebarSections:()=>[],syncControllerSidebarSection:()=>null,getCachedLocalAchievementsForShortcut:()=>cached,getCachedLocalAchievementsForGame:()=>cached,getOwnedAchievementSidebar:()=>null,adoptEarlyAchievementSidebar(){},ensureAchievementSidebarStyles(){},ensureAchievementModalStyles(){},makeLinkedAchievementsClickable(){},cacheLocalAchievements:d=>{cached=d;},localAchievementDataSignature:d=>String(d.total),ensureLocalPlaybarStat(){},buildNativeSidebarSection:(_doc,_layout,o)=>{const n=node(o.sectionId),content=node(o.innerId);content.innerHTML=o.innerHtml;nodes.set(n.id,n);nodes.set(content.id,content);return n;}});
 vm.runInContext(source('features/achievements/sidebar.ts'),ctx);vm.runInContext(source('features/library/sidebar-sections.ts'),ctx);
 vm.runInContext("renderLinkedSidebarCore(doc,layout,{steamAppId:'1800000001',shortcutAppId:'3000000001',data:{name:'Emulated game',achievements:{total:0}}})",ctx);
 const section=nodes.get('gdl-achievements-section');assert.ok(section,'unknown total must not remove the section before local IPC resolves');assert.ok(published.includes(section));assert.match(nodes.get('gdl-achievements-content').innerHTML,/aria-busy="true"/);
 ctx.late={found:true,appid:'1800000001',state_appid:'3000000001',total:2,unlocked:1,achievements:[{name:'A',earned:true},{name:'B',earned:false}]};
 // Sidebar markup has separate rendering coverage; preserve the real commit path.
 vm.runInContext('renderLocalAchievementSidebarHtml=data=>JSON.stringify(data.achievements);renderLocalAchievementSidebar(doc,late)',ctx);
 assert.equal(nodes.get('gdl-achievements-section'),section);assert.match(nodes.get('gdl-achievements-content').innerHTML,/"name":"A"/);assert.equal(cached.total,2);
});
