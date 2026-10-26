// Portable Electron directories for Windows and Linux; no user data or API keys.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'resources/app'),require=createRequire(path.join(source,'package.json'));
const {packager}=await import(pathToFileURL(require.resolve('@electron/packager')).href);
const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
const platform=process.argv[2]||process.platform,arch=process.argv[3]||process.arch;
if(!['linux','win32'].includes(platform))throw Error('Supported targets: linux, win32');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-desktop-'));
try{
 fs.cpSync(source,stage,{recursive:true,filter:file=>!['node_modules','tests','tools','chaves.json','chaves.example.json','package-lock.json'].includes(path.basename(file))});
 // Packager's validation needs the pinned Electron version, but the staged app has no dev dependencies.
 const paths=await packager({dir:stage,out:path.join(root,'dist'),platform,arch,name:'Taiga Launcher',executableName:platform==='win32'?'Taiga Launcher':'taiga-launcher',electronVersion:pkg.devDependencies.electron,prune:false,overwrite:true,icon:path.join(source,'desktop',platform==='win32'?'icon.ico':'icon.png'),download:{cacheRoot:process.env.electron_config_cache},afterCopy:[async ({buildPath})=>{for(const name of ['LICENSE','NOTICE','LEIA-ME.txt'])fs.copyFileSync(path.join(root,name),path.join(buildPath,name));}]});
 for(const out of paths)console.log(out);
}finally{fs.rmSync(stage,{recursive:true,force:true});}
