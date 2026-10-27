const {app,BrowserWindow,Menu,dialog,session,shell,nativeTheme,nativeImage,Tray,Notification,safeStorage}=require('electron');
// Logins e chaves do config.json protegidos pelo Windows (DPAPI): só este usuário, neste PC, consegue ler.
const secretBox={available:()=>{try{return safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');}catch{return false;}},encrypt:s=>safeStorage.encryptString(s).toString('base64'),decrypt:b=>safeStorage.decryptString(Buffer.from(b,'base64'))};
const path=require('node:path');
const fs=require('node:fs');
const {conversionScript}=require('./image-conversion.cjs');
const desktopLocale=require('../locales/runtime.cjs').create('pt-BR'),T=(key,params)=>desktopLocale.t(key,params);
const BASE='http://127.0.0.1:48767';
let mainWindow,service,tray,quitting=false;
// Abrir junto com o Windows (minimizado na bandeja). Regravado a cada abertura: vale mesmo se a pasta do programa mudar.
function applyStartup(on){if(process.defaultApp)return;if(process.platform==='linux'){import('../lib/linux.mjs').then(l=>l.applyStartup(on,process.env.APPIMAGE||process.execPath)).catch(()=>{});return;}if(process.platform!=='win32')return;try{app.setLoginItemSettings({openAtLogin:!!on,path:process.execPath,args:['--hidden']});}catch{}}
const demoArg=args=>{const i=args.indexOf('--taiga-demo');return i>=0&&/^(?:demo|external)-[a-z0-9-]+$/.test(args[i+1]||'')?args[i+1]:null;};
let pendingDemo=demoArg(process.argv);
function showDemo(){if(!pendingDemo||!mainWindow||mainWindow.webContents.isLoading())return;const id=pendingDemo;pendingDemo=null;mainWindow.webContents.executeJavaScript('window.taigaUI?.openDemo('+JSON.stringify(id)+')').catch(()=>{});}

app.setName('Taiga Launcher');
const launchIndex=process.argv.indexOf('--taiga-launch');
if(launchIndex>=0){
 app.disableHardwareAcceleration();const temporary=fs.mkdtempSync(path.join(app.getPath('temp'),'taigasteam-launch-'));app.setPath('userData',temporary);
 app.whenReady().then(async()=>{process.chdir(app.getPath('home'));const {standaloneLaunch}=await import('../lib/launch-engine.mjs');await standaloneLaunch(process.argv[launchIndex+1]);}).catch(error=>dialog.showErrorBox('Taiga Launcher',error.message)).finally(()=>app.quit());
 app.on('will-quit',()=>{try{fs.rmSync(temporary,{recursive:true,force:true});}catch{}});
}else if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',(_event,args)=>{pendingDemo=demoArg(args)||pendingDemo;if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();showDemo();}});
 app.whenReady().then(async()=>{
  // Never keep the launcher/AppImage's temporary extraction directory as cwd.
  fs.mkdirSync(app.getPath('userData'),{recursive:true});process.chdir(app.getPath('userData'));
  // Ícone novo do programa: o Windows guarda o antigo em cache; depois de uma atualização, pede para ele recarregar.
  try{const fsx=require('fs'),px=require('path'),mark=px.join(app.getPath('userData'),'icon-version.txt'),ver=app.getVersion()+':'+fsx.statSync(px.join(__dirname,'icon.ico')).size;if(process.platform==='win32'&&(()=>{try{return fsx.readFileSync(mark,'utf8')!==ver;}catch{return true;}})()){require('child_process').spawn('ie4uinit.exe',['-show'],{detached:true,stdio:'ignore',windowsHide:true}).on('error',()=>{}).unref();fsx.writeFileSync(mark,ver);}}catch{}
  nativeTheme.themeSource='system';
  if(process.platform==='win32')app.setAppUserModelId('Taiga.PSP.Companion');
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  const {createApp}=await import('../server.mjs');
  const picker=async kind=>{
   if(!['game','folder','steam','steam-folder','steam-file','scripts','emulator','launcher','core','art'].includes(kind))throw Error('Seleção inválida.');
   let folder=['folder','steam','steam-folder','scripts'].includes(kind);
   if(kind==='steam'){const result=await dialog.showMessageBox(mainWindow,{type:'question',message:T("ui.0440bdcb45cf"),buttons:[T("ui.0b198d775df7"),T("ui.8eb27b4800cb"),T("ui.c111e0ab9ddb")],defaultId:0,cancelId:2});if(result.response===2)return [];folder=result.response===0;}
   const options={title:folder?T("ui.7b13e3c76969"):/^steam/.test(kind)?T("ui.3a2e0774511a"):kind==='art'?T("ui.8ca64363dbe0"):kind==='emulator'?T("ui.45f6dc5af547"):T("ui.69c95504c015"),properties:folder?['openDirectory']:kind==='game'?['openFile','multiSelections']:['openFile']};
   if(!folder&&process.platform==='win32')options.filters=/^steam/.test(kind)?[{name:'Steam',extensions:['exe','lnk']}]:kind==='art'?[{name:'Artes',extensions:['png','jpg','jpeg','ico']}]:kind==='game'?[{name:'Jogos',extensions:['exe','iso','cso','pbp','chd','cue','bin','m3u','gcm','rvz','wbfs','ciso','nes','sfc','smc','gb','gbc','gba','nds','3ds','z64','n64','v64','gen','md','sms','gg','wud','wux','wua','rpx','xex','cci']}]:kind==='core'?[{name:'Núcleo RetroArch',extensions:['dll']}]:kind==='emulator'?[{name:T("ui.24915949cc88"),extensions:['exe','lnk']}]:[{name:T("ui.24915949cc88"),extensions:['exe']}];
   const result=await dialog.showOpenDialog(mainWindow,options);return result.canceled?[]:result.filePaths;
  };
  // Login da Epic (como o SuccessStory/Heroic): página oficial numa janela separada; o código de autorização é lido
  // na página de retorno da própria Epic e a janela fecha sozinha.
  const epicLogin=async()=>{const {EPIC_LOGIN_URL,EPIC_REDIRECT,authorizationCode}=await import('../lib/epic-auth.mjs');return new Promise(resolve=>{
   const win=new BrowserWindow({width:520,height:760,parent:mainWindow||undefined,modal:false,autoHideMenuBar:true,title:'Epic Games',webPreferences:{partition:'persist:epic-login',contextIsolation:true,nodeIntegration:false,sandbox:true}});
   win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/\s*(Electron|Taiga Launcher|taigasteam)\/\S+/gi,''));
   let done=false;const finish=code=>{if(done)return;done=true;resolve(code);if(!win.isDestroyed())win.close();};
   const check=async()=>{try{const url=win.webContents.getURL();if(!EPIC_REDIRECT.test(url))return;const text=await win.webContents.executeJavaScript('document.body?document.body.innerText:""');const code=authorizationCode(text);if(code)finish(code);}catch{}};
   win.webContents.on('did-finish-load',check);win.webContents.on('did-navigate',check);
   win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\/([a-z0-9-]+\.)*epicgames\.com\//i.test(url))win.loadURL(url);return {action:'deny'};});
   // Já logado de uma vez anterior: a Epic pula direto para o retorno.
   win.on('closed',()=>finish(null));win.loadURL(EPIC_LOGIN_URL);
  });};
  // Login da Microsoft/Xbox (como o Playnite): página oficial; o token volta no endereço de retorno.
  // Página pública carregada numa janela invisível (sites que recusam pedidos fora de um navegador, ex.: Exophase).
  const pageFetch=(url,expect='trophies')=>new Promise((resolve,reject)=>{if(!/^https:\/\/(www|api)\.exophase\.com\//.test(String(url)))return reject(Error('Endereço não permitido.'));const w=new BrowserWindow({show:false,width:1200,height:900,webPreferences:{offscreen:true,javascript:true,images:false,backgroundThrottling:false,partition:'persist:taiga-pages'}});try{w.webContents.setUserAgent(w.webContents.getUserAgent().replace(/\s*(Electron|taiga[\w-]*|TaigaLauncher)\/\S+/gi,''));}catch{}let done=false;const finish=(v,e)=>{if(done)return;done=true;clearTimeout(t);try{w.destroy();}catch{}e?reject(e):resolve(v);};const t=setTimeout(()=>finish(null,Error('Tempo esgotado.')),60000);
   let grabbing=false;const grab=async()=>{if(grabbing)return;grabbing=true;for(let i=0;i<50&&!done;i++){try{if(expect==='json'){const text=await w.webContents.executeJavaScript('document.body?document.body.innerText:""');if(/^\s*\{/.test(text))return finish(text);}else{const html=await w.webContents.executeJavaScript('document.documentElement.outerHTML');if(/<li\b[^>]*\bdata-average=|<ul\b[^>]*class="[^"]*\b(trophy|achievement)\b/i.test(html))return finish(html);}}catch{}await new Promise(r=>setTimeout(r,1000));}finish('');};
   w.webContents.on('did-finish-load',grab);w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.loadURL(url).catch(e=>finish(null,e));});
  // Conta PlayStation: login na página oficial da Sony; o cookie "npsso" da sessão é o que o programa precisa.
  const psnLogin=()=>new Promise(resolve=>{const part=session.fromPartition('persist:psn-login');const win=new BrowserWindow({width:520,height:760,parent:mainWindow||undefined,autoHideMenuBar:true,title:'PlayStation',webPreferences:{partition:'persist:psn-login',contextIsolation:true,nodeIntegration:false,sandbox:true}});
   let done=false;const finish=v=>{if(done)return;done=true;clearInterval(timer);resolve(v);if(!win.isDestroyed())win.close();};
   const timer=setInterval(async()=>{try{const list=await part.cookies.get({name:'npsso'});const c=list.find(x=>/sony\.com$/i.test(String(x.domain||'').replace(/^\./,''))&&/^[A-Za-z0-9]{40,128}$/.test(x.value));if(c)finish(c.value);}catch{}},1000);
   win.on('closed',()=>finish(null));win.webContents.setWindowOpenHandler(({url})=>{win.loadURL(url);return {action:'deny'};});win.loadURL('https://my.account.sony.com/');});
  const xboxLogin=async()=>{const {XBOX_LOGIN_URL,XBOX_REDIRECT_RE,tokenFromRedirect}=await import('../lib/xbox-auth.mjs');return new Promise(resolve=>{
   const win=new BrowserWindow({width:520,height:720,parent:mainWindow||undefined,modal:false,autoHideMenuBar:true,title:'Microsoft',webPreferences:{partition:'persist:xbox-login',contextIsolation:true,nodeIntegration:false,sandbox:true}});
   let done=false;const finish=v=>{if(done)return;done=true;resolve(v);if(!win.isDestroyed())win.close();};
   const check=url=>{if(XBOX_REDIRECT_RE.test(url||'')){const t=tokenFromRedirect(url);finish(t);}};
   win.webContents.on('will-redirect',(_e,url)=>check(url));win.webContents.on('did-navigate',(_e,url)=>check(url));win.webContents.on('did-redirect-navigation',(_e,url)=>check(url));
   win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\/([a-z0-9-]+\.)*(live|microsoft|microsoftonline|xbox)\.com\//i.test(url))win.loadURL(url);return {action:'deny'};});
   win.on('closed',()=>finish(null));win.loadURL(XBOX_LOGIN_URL);
  });};
  // Miniaturas para a página da Comunidade (cartões e conquistas): JPEG reduzido, nunca maior que o original.
  const imageThumb=async(bytes,{width=460}={})=>{const img=nativeImage.createFromBuffer(bytes);if(img.isEmpty())return null;const size=img.getSize();const out=size.width>width?img.resize({width,quality:'best'}):img;return width<=128?out.toPNG():out.toJPEG(85);};
  // Fundo sem SteamGridDB: a capa reduzida a poucos pixels e ampliada de novo vira um degradê desfocado com as cores
  // do jogo (1920x620, no formato do fundo da Steam).
  const heroFromCover=async bytes=>{const img=nativeImage.createFromBuffer(bytes);if(img.isEmpty())return null;const s=img.getSize();const tiny=img.resize({width:10,height:Math.max(4,Math.round(10*s.height/s.width)),quality:'good'});const big=tiny.resize({width:1920,height:Math.round(1920*s.height/s.width),quality:'best'});const h=big.getSize().height;const crop=big.crop({x:0,y:Math.max(0,Math.round((h-620)/2)),width:1920,height:Math.min(620,h)});return crop.toJPEG(88);};
  service=createApp({systemLanguages:(()=>{try{const l=app.getPreferredSystemLanguages();if(l&&l.length)return l;}catch{}try{return [app.getLocale()];}catch{return [];}})(),onStartupChange:on=>applyStartup(on),psnLogin,onApplyUpdate:script=>{const {spawn}=require('child_process');spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script],{detached:true,stdio:'ignore',windowsHide:true}).unref();setTimeout(()=>{quitting=true;app.quit();},300);},secretBox,epicLogin,xboxLogin,pageFetch,imageThumb,heroFromCover,picker,fileIcon:async file=>{try{const img=await app.getFileIcon(file,{size:'large'});return img.isEmpty()?null:img.toPNG();}catch{return null;}},readShortcut:file=>{try{return process.platform==='win32'?shell.readShortcutLink(file).target:'';}catch{return '';}},startInjector:true,launcherExecutable:process.env.APPIMAGE||process.execPath,onLanguageChange:language=>{desktopLocale.setLanguage(language);if(mainWindow)buildMenu();},onAchievementUnlocked:(game,achievement,source)=>{if(Notification.isSupported())new Notification({title:desktopLocale.t('achievement.unlocked')+' · '+game.title,body:achievement.title+' · '+source,silent:true}).show();},imageConvert:async bytes=>{if(!mainWindow||mainWindow.isDestroyed())throw Error('Abra o programa para converter a logo.');const encoded=await mainWindow.webContents.executeJavaScript(conversionScript(bytes.toString('base64')));const png=Buffer.from(encoded,'base64');if(png.length>12000000)throw Error('Logo convertida muito grande. Escolha outra imagem.');return png;},imageValidate:async bytes=>{if(nativeImage.createFromBuffer(bytes).isEmpty())throw Error('A imagem não pôde ser aberta. Use PNG, JPG ou ICO válido.');},iconResize:async bytes=>{const img=nativeImage.createFromBuffer(bytes);if(img.isEmpty())throw Error('Ícone inválido.');return img.resize({width:256,height:256,quality:'best'}).toPNG();},onOpenManager:()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}},onSteamNeedsIntegration:()=>{if(!Notification.isSupported())return;const n=new Notification({title:desktopLocale.t('inj.notifyTitle'),body:desktopLocale.t('inj.notifyBody')});n.on('click',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});n.show();}});
  await new Promise((resolve,reject)=>{service.server.once('error',reject);service.server.listen(48767,'127.0.0.1',resolve);});
  mainWindow=new BrowserWindow({width:1360,height:910,minWidth:900,minHeight:650,show:false,title:'Taiga Launcher',backgroundColor:'#121214',icon:path.join(__dirname,'icon.png'),autoHideMenuBar:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,preload:path.join(__dirname,'preload.cjs')}});
  desktopLocale.setLanguage(service.getLanguage());function buildMenu(){const menu=Menu.buildFromTemplate([{label:T("ui.aaf3890f825b"),submenu:[{label:T("ui.6d241c1d8918"),accelerator:'CmdOrCtrl+O',click:()=>mainWindow.webContents.executeJavaScript("window.taigaUI?.addGame()")},{label:T("ui.871f24c4cdaf"),accelerator:'CmdOrCtrl+,',click:()=>mainWindow.webContents.executeJavaScript("window.taigaUI?.settings()")},{type:'separator'},{label:T("ui.3ffa2a9e9b4d"),role:'quit'}]},{label:T("ui.2b5f23437f58"),submenu:[{label:T("ui.95d2c5ee416c"),role:'undo'},{label:T("ui.274ae2147e50"),role:'redo'},{type:'separator'},{label:T("ui.5f33afb1fada"),role:'cut'},{label:T("ui.885410773340"),role:'copy'},{label:T("ui.0b05605e06b1"),role:'paste'},{label:T("ui.3f15201e6326"),role:'selectAll'}]},{label:T("ui.7177004af80d"),submenu:[{label:T("ui.29bd1ffce463"),role:'minimize'},{label:T("ui.e8011276d020"),role:'togglefullscreen'},{type:'separator'},{label:T("ui.920e9ae504c0"),role:'resetZoom'},{label:T("ui.3db2c9b3d1fb"),role:'zoomIn'},{label:T("ui.5a8d8b8afc6b"),role:'zoomOut'}]},{label:T("ui.0085ce04a077"),submenu:[{label:T("ui.00e12234ed13"),click:()=>shell.openPath(path.join(path.dirname(process.execPath),'LEIA-ME.txt'))},{label:T("ui.015b15b58807"),click:()=>shell.openPath(service.dataDir)},{label:T("ui.d901a843b555"),click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'Taiga Launcher',message:'Taiga Launcher · '+require('../package.json').version,detail:T('about.detail')})}]}]);
  Menu.setApplicationMenu(menu);}buildMenu();
  // Links do programa (Discord, perfis, cadastro) abrem no navegador; só https e só destes sites.
  mainWindow.webContents.setWindowOpenHandler(({url})=>{try{const u=new URL(url);if(u.protocol==='https:'&&/(^|\.)(discord\.gg|discord\.com|github\.com|steamcommunity\.com|retroachievements\.org|gog\.com|steamgriddb\.com)$/i.test(u.hostname))shell.openExternal(u.href);}catch{}return {action:'deny'};});
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==BASE&&url!==BASE+'/')event.preventDefault();});
  mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
  mainWindow.webContents.on('page-title-updated',event=>event.preventDefault());
  mainWindow.webContents.on('will-prevent-unload',event=>{const response=dialog.showMessageBoxSync(mainWindow,{type:'question',buttons:[T("ui.8f6e4a6fa10c"),T("ui.1cba6871468a")],defaultId:0,cancelId:0,message:T("ui.e5ae7049a850"),detail:T("ui.5a785c8a4ac1")});if(response===1)event.preventDefault();});
  // Aberto pelo Windows ao ligar o PC: fica só na bandeja (a Steam já recebe as páginas do jogo); o usuário abre pelo ícone.
  const atLogin=process.argv.includes('--hidden')||(()=>{try{return app.getLoginItemSettings().wasOpenedAtLogin;}catch{return false;}})();
  applyStartup(service.startWithWindows());
  mainWindow.once('ready-to-show',()=>{if(!atLogin)mainWindow.show();});
  tray=new Tray(path.join(__dirname,process.platform==='linux'?'icon.png':'icon.ico'));tray.setToolTip('Taiga Launcher · '+T('tray.active'));const show=()=>{if(mainWindow){mainWindow.show();mainWindow.focus();}};tray.on('double-click',show);tray.setContextMenu(Menu.buildFromTemplate([{label:T("ui.f6c1d76ee2f7"),click:show},{type:'separator'},{label:T("ui.8c80cf084687"),click:()=>app.quit()}]));
  mainWindow.on('close',event=>{if(!quitting){event.preventDefault();mainWindow.hide();}});
  mainWindow.on('closed',()=>{mainWindow=null;});
  await mainWindow.loadURL(BASE);showDemo();
 }).catch(error=>{dialog.showErrorBox(T('start.failed'),error.code==='EADDRINUSE'?T('start.portInUse'):error.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;});
 app.on('window-all-closed',()=>app.quit());
 app.on('will-quit',()=>{service?.server.close();service?.server.closeAllConnections();});
}
