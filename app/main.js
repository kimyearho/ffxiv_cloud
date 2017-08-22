const {app, BrowserWindow} = require('electron');
const {ipcMain} = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const {download} = require('electron-dl');

// 윈도우 객체를 전역에 유지합니다.
let win = null;

function createWindow () {

    // 새로운 브라우저 창을 생성합니다.
    win = new BrowserWindow({width: 1100, height: 530, resizable: true, icon: __dirname + '/public/assets/img/logo.ico'});
    win.setMenu(null);

    // 그리고 현재 디렉터리의 index.html을 로드합니다.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'login.html'),
        protocol: 'file:',
        slashes: true
    }))

    // 창이 닫히면 호출됩니다.
    win.on('closed', () => {
        win = null
    });

    // 랜더러 비동기 통신 ( 로그인 성공 )
    ipcMain.on('LOGIN_SUCCESS', (event, arg) => {
        win.loadURL('file://'+app.getAppPath()+'/index.html');
        win.webContents.on('did-finish-load', (event) => {
            win.webContents.send('session_id', [arg])
        });
    });

    // 랜더러 비동기 통신 ( UI 적용 )
    ipcMain.on('DOWNLOAD_UI', (e, args) => {
        let pathToFileName = args.path + '/' + args.fileName;
        if (fs.existsSync(pathToFileName)) {
            fs.unlinkSync(pathToFileName);
        }
        let option = { directory : args.path };
        download(BrowserWindow.getFocusedWindow(), args.url, option)
            .then(dl => progressCallback(dl.getState(), dl.getFilename(), args.code, args.path))
            .catch(console.error);
    });

    function progressCallback(state, fileName, charCode, path) {
        if(state == 'completed') {
            console.log('Download Completed.');
            win.webContents.send('DOWNLOAD_COMPLETED', { fileName: fileName, charCode: charCode, path: path });
        }
    }
}

app.on('ready', () => {
    createWindow();
});

// 모든 창이 닫히면 애플리케이션 종료.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
});
