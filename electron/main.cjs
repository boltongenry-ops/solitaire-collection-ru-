const {app,BrowserWindow,Menu}=require('electron');
const path=require('node:path');
app.setName('Пасьянс — Коллекция');
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
let window;
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.whenReady().then(()=>{
  Menu.setApplicationMenu(null);
  window=new BrowserWindow({width:1440,height:960,minWidth:900,minHeight:680,title:'Пасьянс — Коллекция',backgroundColor:'#102d29',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){window.setFullScreen(!window.isFullScreen());event.preventDefault();}});
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.loadFile(path.join(__dirname,'../dist/index.html'));
});
app.on('window-all-closed',()=>app.quit());
