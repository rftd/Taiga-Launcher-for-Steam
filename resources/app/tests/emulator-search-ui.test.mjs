import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('Forced emulator list refresh ignores an older in-flight empty response',async()=>{
 const reads=[],UI={view:'emulators',emuDownloads:[],emuList:null},ctx=vm.createContext({UI,Promise,render(){},api:()=>new Promise(resolve=>reads.push(resolve))});
 vm.runInContext(source.slice(source.indexOf('function loadEmulators(force)'),source.indexOf('\nfunction emulatorsView()')),ctx);
 const old=ctx.loadEmulators(),fresh=ctx.loadEmulators(true);assert.equal(reads.length,2);reads[1]({items:[{profile:'dolphin',name:'Dolphin'}]});await fresh;reads[0]({items:[]});await old;
 assert.equal(UI.emuList[0].profile,'dolphin');assert.equal(UI.emuLoading,false);
});
test('Emulators search button opens the discovery results instead of discarding them',()=>{
 const start=source.indexOf("case 'emulators-discover':"),branch=source.slice(start,source.indexOf('\n',start));let shown=0;
 const ctx=vm.createContext({UI:{emuMenu:true},T:s=>s,discoverEmulatorDialog:()=>{shown++;},task:f=>f()});
 vm.runInContext("switch('emulators-discover'){"+branch+'}',ctx);assert.equal(shown,1);
});
