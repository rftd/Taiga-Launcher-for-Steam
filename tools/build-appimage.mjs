import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const projectDir=path.join(root,'resources/app');
const require=createRequire(path.join(projectDir,'package.json'));
if(process.platform!=='linux')throw Error('Build the AppImage on Linux.');
const arch=process.argv[2]||process.arch;
if(arch!=='x64')throw Error('The first AppImage target is Linux x64.');
execFileSync(process.execPath,[path.join(root,'tools/build-desktop.mjs'),'linux',arch],{stdio:'inherit'});
const {build,Platform,Arch}=await import(pathToFileURL(require.resolve('electron-builder')).href);
const artifacts=await build({projectDir,prepackaged:path.join(root,'dist','Taiga Launcher-linux-x64'),targets:Platform.LINUX.createTarget('AppImage',Arch.x64),config:{
 appId:'io.github.rftd.taigalauncher',productName:'Taiga Launcher',executableName:'taiga-launcher',
 artifactName:'Taiga-Launcher-${version}-${arch}.${ext}',
 directories:{output:path.join(root,'dist/appimage')},
 linux:{category:'Game',icon:path.join(projectDir,'desktop/icon.png'),target:['AppImage']},
}});
for(const file of artifacts.filter(file=>file.endsWith('.AppImage'))){
 const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);
 fs.writeFileSync(file+'.sha256',hash.digest('hex')+'  '+path.basename(file)+'\n');
}
