// Preserve typed nodes, field order, nested tags and all unmodified scalar bytes.
export function parseVDF(buf){
 let pos=0;function need(n){if(pos+n>buf.length)throw Error('VDF truncado');}
 function str(){const end=buf.indexOf(0,pos);if(end<0)throw Error('VDF sem terminador');const s=buf.toString('utf8',pos,end);pos=end+1;return s;}
 function obj(depth=0){if(depth>32)throw Error('VDF profundo demais');const nodes=[];
  while(true){need(1);const type=buf[pos++];if(type===8)return nodes;const key=str();let value;
   if(type===0)value=obj(depth+1);else if(type===1)value=str();else {const n=({2:4,3:4,4:4,6:4,7:8,10:8})[type];if(!n)throw Error('Tipo VDF não suportado: '+type);need(n);value=Buffer.from(buf.subarray(pos,pos+n));pos+=n;}
   nodes.push({type,key,value});
  }
 }const root=obj();if(buf.subarray(pos).some(b=>b!==8))throw Error('Conteúdo VDF inesperado');return root;
}
export function encodeVDF(nodes){const chunks=[];const str=s=>{if(s.includes('\0'))throw Error('Texto contém NUL');chunks.push(Buffer.from(s+'\0'));};
 function obj(ns){for(const n of ns){chunks.push(Buffer.from([n.type]));str(n.key);if(n.type===0)obj(n.value);else if(n.type===1)str(n.value);else chunks.push(n.value);}chunks.push(Buffer.from([8]));}obj(nodes);return Buffer.concat(chunks);
}
export const field=(nodes,k)=>nodes.find(n=>n.key.toLowerCase()===k.toLowerCase());
export const value=(nodes,k)=>field(nodes,k)?.value;
export function set(nodes,key,type,val){const old=field(nodes,key);if(old){old.type=type;old.value=val;}else nodes.push({key,type,value:val});}
export function uint(n){const b=Buffer.alloc(4);b.writeUInt32LE(Number(n)>>>0);return b;}
export function crc32(s){let c=0xffffffff;for(const b of Buffer.from(s)){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function shortcutId(exe,title){return (crc32(exe+title)|0x80000000)>>>0;}
export function shortcuts(root){let n=field(root,'shortcuts');if(!n){if(root.length)throw Error('Raiz VDF inesperada');n={type:0,key:'shortcuts',value:[]};root.push(n);}if(n.type!==0)throw Error('Raiz shortcuts inválida');return n.value;}
export function upsert(root,game,exe,startDir,icon=''){
 const list=shortcuts(root),quoted='"'+exe+'"',args=game.launchOptions??'"'+game.path+'"';
 let node=list.find(n=>n.type===0&&(game.launchOptions!==undefined?value(n.value,'LaunchOptions')===args:windowsPath(launchGamePath(value(n.value,'LaunchOptions')))===windowsPath(game.path))&&windowsPath(value(n.value,'exe'))===windowsPath(exe));
 if(!node&&game.appId)node=list.find(n=>n.type===0&&Buffer.isBuffer(value(n.value,'appid'))&&value(n.value,'appid').readUInt32LE(0)===game.appId);
 const occupied=new Set(list.map(n=>{const b=value(n.value,'appid');return Buffer.isBuffer(b)?b.readUInt32LE(0):0;}));
 let id=node?value(node.value,'appid').readUInt32LE(0):shortcutId(quoted,game.title);
 if(!node){while(occupied.has(id))id=((id+1)|0x80000000)>>>0;node={type:0,key:String(list.length),value:[]};list.push(node);}
 const ns=node.value;
 for(const [k,t,v] of [['appid',2,uint(id)],['AppName',1,game.title],['exe',1,quoted],['StartDir',1,'"'+startDir+'"'],['LaunchOptions',1,args]])set(ns,k,t,v);
 if(icon)set(ns,'icon',1,icon);
 for(const [k,v] of [['IsHidden',0],['AllowDesktopConfig',1],['AllowOverlay',1],['OpenVR',0]])if(!field(ns,k))set(ns,k,2,uint(v));
 for(const [k,t,v] of [['icon',1,''],['ShortcutPath',1,''],['Devkit',2,uint(0)],['DevkitGameID',1,''],['DevkitOverrideAppID',2,uint(0)],['LastPlayTime',2,uint(0)],['FlatpakAppID',1,'']])if(!field(ns,k))set(ns,k,t,v);
 if(!field(ns,'tags'))set(ns,'tags',0,[]);
 const tags=value(ns,'tags'),tag=game.external?'Jogo por fora':game.demo?'Demonstração':game.platformName||'PSP';if(!tags.some(n=>n.value===tag))tags.push({type:1,key:String(Math.max(-1,...tags.map(n=>Number(n.key)).filter(Number.isFinite))+1),value:tag});
 list.forEach((n,i)=>n.key=String(i));return id;
}
// Accept slash/case differences and extra PPSSPP flags without creating another shortcut.
export const windowsPath=s=>{const value=String(s||'').replace(/^"|"$/g,'');return process.platform==='win32'||/^(?:[a-z]:[\\/]|\\\\)/i.test(value)?value.replaceAll('/','\\').replace(/\\+/g,'\\').toLowerCase():value;};
export function launchGamePath(options){const s=String(options||'').trim();const quoted=[...s.matchAll(/"([^"\r\n]+\.(?:iso|cso|pbp))"/ig)];if(quoted.length===1)return quoted[0][1];if(/\.(iso|cso|pbp)$/i.test(s)&&!s.startsWith('-'))return s;return '';}
export function shortcutInfo(root){return shortcuts(root).filter(n=>n.type===0).map(n=>{const b=value(n.value,'appid');return {appId:Buffer.isBuffer(b)&&b.length===4?b.readUInt32LE(0):null,title:String(value(n.value,'AppName')||''),exe:String(value(n.value,'exe')||''),options:String(value(n.value,'LaunchOptions')||''),path:launchGamePath(value(n.value,'LaunchOptions')),node:n};});}
