import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ensureWorkingDirectory} from '../lib/working-directory.mjs';

test('A healthy working directory is preserved',()=>{
 assert.equal(ensureWorkingDirectory('/unused-fallback'),process.cwd());
});

// Windows prevents deleting the current directory; Linux allows it but getcwd fails.
for(const cached of [false,true])test('Import confirmation recovers when the launcher working directory disappears'+(cached?' after cwd was cached':''),{skip:process.platform==='win32'},()=>{
 const server=new URL('../server.mjs',import.meta.url).href;
 const fixtures=new URL('./fixtures.mjs',import.meta.url).href;
 const script=`
 import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
 import {createApp} from ${JSON.stringify(server)};import {iso} from ${JSON.stringify(fixtures)};
 const original=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-deleted-cwd-'));
 const launchDir=path.join(root,'launch'),game=path.join(root,'game.iso');fs.mkdirSync(launchDir);fs.writeFileSync(game,iso());
 const port=49638,{server}=createApp({dataDir:path.join(root,'data'),port});
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const config=JSON.parse(fs.readFileSync(path.join(root,'data/config.json')));
  const call=async(route,body)=>{
   const response=await fetch('http://127.0.0.1:'+port+'/api/'+route,{method:'POST',headers:{Authorization:'Bearer '+config.adminToken,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
  };
  const scan=await call('scan',{paths:[game]});assert.equal(scan.items.length,1);
  process.chdir(launchDir);if(${cached})process.cwd();fs.rmdirSync(launchDir);
  if(!${cached})assert.throws(()=>process.cwd(),{code:'ENOENT'});
  const result=await call('import-confirm',{scanId:scan.scanId,items:scan.items,deferred:true});assert.equal(result.added,1);
  assert.doesNotThrow(()=>process.cwd());
  const again=await call('scan',{paths:[game]});assert.equal(again.items.length,0);assert.equal(again.existing.length,1);
  console.log('deleted-cwd import passed');
 }finally{process.chdir(original);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
 `;
 const output=execFileSync(process.execPath,['--input-type=module','--eval',script],{env:{...process.env,TAIGA_OFFLINE:'1'},timeout:20000,encoding:'utf8'});
 assert.match(output,/deleted-cwd import passed/);
});
