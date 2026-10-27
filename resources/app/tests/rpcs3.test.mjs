import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readRPCS3,parseTrophyProgress,rpcs3Roots} from '../lib/rpcs3-achievements.mjs';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';

const temp=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-rpcs3-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;};
const write=(root,name,bytes)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return file;};
// RPCS3 Loader/TROPUSR.h: 48-byte header, 32-byte table headers,
// type 4 entries of 0x50+16 bytes and type 6 entries of 0x60+16 bytes.
function progress(){
 const count=2,table4=112,table6=table4+count*96,bytes=Buffer.alloc(table6+count*112);
 bytes.writeUInt32BE(0x818f54ad,0);bytes.writeUInt32BE(2,8);
 for(const [n,type,size,offset]of [[0,4,0x50,table4],[1,6,0x60,table6]]){const at=48+n*32;bytes.writeUInt32BE(type,at);bytes.writeUInt32BE(size,at+4);bytes.writeUInt32BE(1,at+8);bytes.writeUInt32BE(count,at+12);bytes.writeBigUInt64BE(BigInt(offset),at+16);}
 for(let id=0;id<count;id++){const at=table6+id*112;bytes.writeUInt32BE(6,at);bytes.writeUInt32BE(0x60,at+4);bytes.writeUInt32BE(id,at+8);bytes.writeUInt32BE(id,at+16);bytes.writeUInt32BE(id===0?1:0,at+20);if(id===0){const tick=63835596800000000n;bytes.writeBigUInt64BE(tick,at+32);bytes.writeBigUInt64BE(tick,at+40);}}
 return bytes;
}
function install(root,set='NPWR01234_00',title='Original PS3 title'){
 const folder=path.join(root,'dev_hdd0/home/00000001/trophy',set);
 write(folder,'TROPCONF.SFM',`<trophyconf><title-name>${title}</title-name><trophy id="000" hidden="no" ttype="B"><name>First trophy</name><detail>Start</detail></trophy><trophy id="001" hidden="yes" ttype="G"><name>Second trophy</name><detail>Finish</detail></trophy></trophyconf>`);
 write(folder,'TROPUSR.DAT',progress());return folder;
}
function gameAt(root,set='NPWR01234_00'){
 write(root,'PS3_GAME/TROPDIR/'+set+'/TROPHY.TRP','fixture');
 return {id:'ps3-fixture',title:'Renamed library entry',profile:'ps3',path:write(root,'PS3_GAME/USRDIR/EBOOT.BIN','fixture')};
}
test('RPCS3 Flatpak data is discovered and matched by the game NPWR set, preserving local files',t=>{
 const home=temp(t),root=path.join(home,'.var/app/net.rpcs3.RPCS3/config/rpcs3'),folder=install(root),game=gameAt(path.join(home,'game'));
 install(root,'NPWR99999_00','Another game');const before=fs.readFileSync(path.join(folder,'TROPUSR.DAT'));
 const data=readRPCS3(game,{language:'en'},path.join(home,'taiga'),{home,env:{},platform:'linux'});
 assert.equal(data.status,'ok');assert.equal(data.trophySet,'NPWR01234_00');assert.equal(data.total,2);assert.equal(data.unlocked,1);assert.equal(data.achievements[0].id,'000');assert.equal(data.achievements[0].unlocked,true);assert.equal(data.achievements[1].unlocked,false);
 assert.equal(data.achievements[0].date,'63835596800000000');assert.deepEqual(fs.readFileSync(path.join(folder,'TROPUSR.DAT')),before);
});
test('RPCS3 native XDG configuration resolves a quoted custom dev_hdd0 path',t=>{
 const home=temp(t),configHome=path.join(home,'config'),root=path.join(configHome,'rpcs3'),external=path.join(home,'Disk #1'),folder=install(external);
 write(root,'vfs.yml',`"/dev_hdd0/": '${path.join(external,'dev_hdd0')}'\n`);
 const data=readRPCS3({title:'Original PS3 title',profile:'ps3'},{language:'en'},path.join(home,'taiga'),{home,env:{XDG_CONFIG_HOME:configHome},platform:'linux'});
 assert.equal(data.status,'ok');assert.equal(data.unlocked,1);assert.ok(fs.existsSync(folder));
});
test('Explicit RPCS3 data, dev_hdd0, trophy collection and set paths all work',t=>{
 const home=temp(t),root=path.join(home,'RPCS3'),folder=install(root),game=gameAt(path.join(home,'game'));
 for(const selected of [root,path.join(root,'dev_hdd0'),path.dirname(folder),folder,path.join(folder,'TROPUSR.DAT')]){
  const data=readRPCS3({...game,achievementSettings:{path:selected}},{language:'en'},path.join(home,'taiga'),{home,env:{},platform:'linux'});
  assert.equal(data.status,'ok',selected);assert.equal(data.unlocked,1);
 }
 const explicit=path.join(home,'empty');fs.mkdirSync(explicit);assert.deepEqual(rpcs3Roots(game,{rpcs3Root:explicit},{home,env:{},platform:'linux'}),[explicit]);
});
test('RPCS3 does not attach a different trophy set merely because its name matches',t=>{
 const home=temp(t),root=path.join(home,'RPCS3');install(root,'NPWR99999_00','Renamed library entry');
 const data=readRPCS3(gameAt(path.join(home,'game')),{rpcs3Root:root},path.join(home,'taiga'));
 assert.equal(data.status,'unmapped');assert.equal(data.achievements.length,0);
});
test('Separate native and Flatpak progress is ambiguous until a root is selected',t=>{
 const home=temp(t),native=path.join(home,'.config/rpcs3'),flatpak=path.join(home,'.var/app/net.rpcs3.RPCS3/config/rpcs3');install(native);install(flatpak);const game=gameAt(path.join(home,'game')),options={home,env:{},platform:'linux'};
 assert.equal(readRPCS3(game,{},path.join(home,'taiga'),options).status,'ambiguous');
 assert.equal(readRPCS3(game,{rpcs3Root:flatpak},path.join(home,'taiga'),options).status,'ok');
});
test('RPCS3 real-sized progress tables reject truncated or unsafe offsets',()=>{
 const bytes=progress();assert.equal(parseTrophyProgress(bytes).get('0').unlocked,true);assert.throws(()=>parseTrophyProgress(bytes.subarray(0,bytes.length-1)));
 bytes.writeBigUInt64BE(0xffffffffffffffffn,96);assert.throws(()=>parseTrophyProgress(bytes));
});
test('Achievement manager discovers RPCS3 Flatpak automatically and converts PS3 timestamps',{skip:process.platform!=='linux'},async t=>{
 const home=temp(t),root=path.join(home,'.var/app/net.rpcs3.RPCS3/config/rpcs3');install(root);const game=gameAt(path.join(home,'game'));
 const manager=new AchievementProviderManager({config:()=>({language:'en'}),dir:path.join(home,'taiga'),env:{HOME:home},providers:{}});
 const data=await manager.get(game);assert.equal(data.provider,'rpcs3');assert.equal(data.status,'ok');assert.equal(data.unlocked,1);assert.equal(data.achievements[0].date,1700000000);
});
