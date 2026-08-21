const { app, BrowserWindow, Menu, shell, Notification, nativeImage } = require('electron');
const path = require('path');

const APP_NAME = '달빛워크 어드민';
const APP_URL = process.env.DALBITWORK_APP_URL || 'https://dalbitwork-estimate-5zcu.vercel.app/';
const DOCK_ICON_PATH = path.join(__dirname, 'build', 'icon.png');

// 패키징 전(`electron .`)에도 Dock 아이콘 hover 시 "Electron" 대신 이 이름이 보이도록 가장 먼저 설정
app.setName(APP_NAME);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // 웹앱이 알림 권한을 요청하면 Chromium이 macOS 알림센터로 그대로 띄워줌
    },
  });

  mainWindow.loadURL(APP_URL);

  // 외부 링크(대상=_blank 등)는 앱 창이 아니라 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL) && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // 패키징된 .app은 build.icon(icns)이 자동 적용되지만, `electron .`로 바로 실행할 땐
  // Dock 아이콘이 기본 Electron 로고로 나오므로 개발 중에도 브랜드 아이콘이 보이도록 직접 지정
  if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
    const dockIcon = nativeImage.createFromPath(DOCK_ICON_PATH);
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon);
  }

  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 메인 프로세스에서 직접 알림을 띄울 때 쓸 수 있는 헬퍼 (예: 백그라운드 폴링 알림을 나중에 추가할 때 사용)
function showNativeNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

module.exports = { showNativeNotification };
