import os from 'node:os';
import fs from 'node:fs';

// Launchers can start the app from a temporary directory that disappears later.
export function ensureWorkingDirectory(fallback=os.homedir()){
 try{
  const current=process.cwd();
  // Node can cache a cwd string even after the underlying directory was deleted.
  fs.statSync(current);
  return current;
 }catch(error){
  if(error.code!=='ENOENT')throw error;
  process.chdir(fallback);
  return process.cwd();
 }
}
