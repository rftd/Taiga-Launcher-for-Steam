// Preserve command exit codes and expose actionable failures in Actions annotations.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=path.join(root,'resources/app');
const task=process.argv[2];
const commands={
 test:['--env-file=tests/test.env','--test','--test-reporter=spec','--test-reporter-destination=stdout','--test-reporter='+pathToFileURL(path.join(root,'tools/ci-test-reporter.mjs')).href,'--test-reporter-destination=stdout',...fs.readdirSync(path.join(app,'tests')).filter(file=>file.endsWith('.test.mjs')).sort().map(file=>path.join('tests',file))],
 appimage:[path.join(root,'tools/build-appimage.mjs')],
 windows:[path.join(root,'tools/build-desktop.mjs'),'win32','x64'],
};
if(!commands[task])throw Error('Unknown CI task');
const logs=path.join(root,'dist/ci-logs');fs.mkdirSync(logs,{recursive:true});
const log=fs.createWriteStream(path.join(logs,task+'.log'));
let tail='';
const child=spawn(process.execPath,commands[task],{cwd:app,stdio:['ignore','pipe','pipe']});
function collect(chunk,output){output.write(chunk);log.write(chunk);tail=(tail+chunk.toString()).slice(-24000);}
child.stdout.on('data',chunk=>collect(chunk,process.stdout));
child.stderr.on('data',chunk=>collect(chunk,process.stderr));
child.on('error',error=>{tail+=error.stack;});
child.on('close',(code,signal)=>{
 log.end();const status=code??1;
 if(status!==0){
  const detail=('Task '+task+' failed (exit '+status+(signal?', signal '+signal:'')+').\n'+(task==='test'?'See individual test annotations and dist/ci-logs/test.log.':tail)).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.log('::error title='+task+' failure::'+detail);
 }
 process.exitCode=status;
});
