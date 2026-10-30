import fs from 'node:fs';import path from 'node:path';
// Coleções do usuário na Steam (cloud-storage-namespace-1.json), gravadas com a Steam fechada.
//  - "Taiga Launcher": a coleção principal (id fixo taiga-steamtaiga; "SteamTaiga" é o nome antigo).
//  - extra: coleções por loja ({name, add, remove}), como "Epic Games" e "Xbox". Uma coleção comum já existente com o
//    mesmo nome é reaproveitada; senão é criada com um id próprio (taiga-store-<nome>).
const files=(dir,account)=>{const base=path.join(dir,'userdata',account,'config/cloudstorage');return {file:path.join(base,'cloud-storage-namespace-1.json'),versionsFile:path.join(base,'cloud-storage-namespaces.json')};};
const slug=name=>String(name).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'loja';
function parseCollection(e){if(!e||e.is_deleted||!e.value)return null;try{const c=JSON.parse(e.value);return !c.filterSpec&&Array.isArray(c.added)?c:null;}catch{return null;}}
export function collectionWrites(dir,account,add,remove=[],extra=[]){
 const {file,versionsFile}=files(dir,account);
 const read=(p,fallback)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):fallback;
 const entries=read(file,[]),versions=read(versionsFile,[]);if(!Array.isArray(entries)||entries.some(e=>!Array.isArray(e)||typeof e[0]!=='string'||!e[1]||typeof e[1]!=='object')||!Array.isArray(versions)||versions.some(v=>!Array.isArray(v)||v.length!==2))throw Error('Formato das coleções Steam não reconhecido; nenhum arquivo foi aplicado.');
 let max=Math.max(0,...entries.map(([,e])=>Number(e.version)||0),...versions.filter(v=>Array.isArray(v)&&Number(v[0])===1).map(v=>Number(v[1])||0));let changed=false;
 const apply=(index,key,fresh,addIds,removeIds)=>{
  const previous=index<0?{}:entries[index][1];const value=previous.value?JSON.parse(previous.value):fresh;if(value.name==='SteamTaiga')value.name='Taiga Launcher';
  const removed=new Set(removeIds.map(Number)),added=new Set(addIds.map(Number));
  value.added=[...new Set([...(value.added||[]).map(Number).filter(id=>!removed.has(id)),...added])];value.removed=[...new Set([...(value.removed||[]).map(Number).filter(id=>!added.has(id)),...removed])];
  if(previous.value===JSON.stringify(value))return;
  max++;const entry=[key,{...previous,key,timestamp:Math.floor(Date.now()/1000),version:String(max),value:JSON.stringify(value),conflictResolutionMethod:'custom',strMethodId:'union-collections'}];delete entry[1].is_deleted;
  if(index<0)entries.push(entry);else entries[index]=entry;changed=true;
 };
 // Coleção principal.
 {const index=entries.findIndex(([key,e])=>key.startsWith('user-collections.')&&['SteamTaiga','Taiga Launcher'].includes(parseCollection(e)?.name)),key=index<0?'user-collections.taiga-steamtaiga':entries[index][0];
  if(index<0&&add.length&&entries.some(([k])=>k==='user-collections.taiga-steamtaiga'))throw Error('Existe uma coleção Taiga Launcher em formato incompatível. Confira a coleção na Steam antes de aplicar.');
  if(index>=0||add.length)apply(index,key,{id:'taiga-steamtaiga',name:'Taiga Launcher',added:[],removed:[]},add,remove);}
 // Coleções por loja.
 for(const spec of extra||[]){const name=String(spec?.name||'').trim();if(!name||name==='Taiga Launcher')continue;const addIds=spec.add||[],removeIds=spec.remove||[];
  const id='taiga-store-'+slug(name);let index=entries.findIndex(([key,e])=>key==='user-collections.'+id&&!e.is_deleted);if(index<0)index=entries.findIndex(([key,e])=>key.startsWith('user-collections.')&&parseCollection(e)?.name===name);
  if(index<0&&!addIds.length)continue;const key=index<0?'user-collections.'+id:entries[index][0];
  apply(index,key,{id,name,added:[],removed:[]},addIds,removeIds);}
 if(!changed)return [];
 const vi=versions.findIndex(v=>Array.isArray(v)&&Number(v[0])===1);if(vi<0)versions.push([1,String(max)]);else versions[vi]=[1,String(max)];
 return [[file,Buffer.from(JSON.stringify(entries))],[versionsFile,Buffer.from(JSON.stringify(versions))]];
}

// Apaga a coleção "Taiga Launcher" (ou a antiga "SteamTaiga") da conta: usado em "Remover tudo da Steam".
// storeNames: coleções por loja criadas pelo Taiga Launcher (id taiga-store-*), apagadas junto; main=false apaga só elas.
export function collectionDelete(dir,account,{storeNames=[],main=true}={}){
 const {file,versionsFile}=files(dir,account);
 if(!fs.existsSync(file))return [];const entries=JSON.parse(fs.readFileSync(file,'utf8')),versions=fs.existsSync(versionsFile)?JSON.parse(fs.readFileSync(versionsFile,'utf8')):[];
 const storeKeys=new Set((storeNames||[]).map(n=>'user-collections.taiga-store-'+slug(n)));
 const hits=entries.map((e,i)=>[e,i]).filter(([[key,e]])=>{if(!String(key).startsWith('user-collections.')||e?.is_deleted)return false;
  if(storeKeys.has(key))return true;if(!main)return false;
  if(key==='user-collections.taiga-steamtaiga')return true;try{const c=JSON.parse(e.value);return ['SteamTaiga','Taiga Launcher'].includes(c.name)&&!c.filterSpec;}catch{return false;}});
 if(!hits.length)return [];let max=Math.max(0,...entries.map(([,e])=>Number(e?.version)||0),...versions.filter(v=>Array.isArray(v)&&Number(v[0])===1).map(v=>Number(v[1])||0));
 for(const [[key],i] of hits){max++;entries[i]=[key,{key,timestamp:Math.floor(Date.now()/1000),is_deleted:true,version:String(max)}];}
 const vi=versions.findIndex(v=>Array.isArray(v)&&Number(v[0])===1);if(vi<0)versions.push([1,String(max)]);else versions[vi]=[1,String(max)];
 return [[file,Buffer.from(JSON.stringify(entries))],[versionsFile,Buffer.from(JSON.stringify(versions))]];
}
