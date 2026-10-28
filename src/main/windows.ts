import { app, BrowserWindow, shell, screen } from 'electron'
import { join } from 'path'
import { getConfigManager } from './config'

const isDev = !app.isPackaged

let floatingWindow: BrowserWindow | null = null
let dashboardWindow: BrowserWindow | null = null

export function getFloatingWindow(): BrowserWindow | null {
  return floatingWindow
}

export function getDashboardWindow(): BrowserWindow | null {
  return dashboardWindow
}

export function createFloatingWindow(): BrowserWindow {
  const configManager = getConfigManager()
  const cfg = configManager.get()

  floatingWindow = new BrowserWindow({
    width: cfg.ui.width || 520,
    height: cfg.ui.height || 180,
    x: cfg.ui.x,
    y: cfg.ui.y,
    minWidth: 320,
    minHeight: 100,
    maxWidth: 1920,
    maxHeight: 1080,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    resizable: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  // 设置 macOS 置顶等级
  if (process.platform === 'darwin') {
    floatingWindow.setAlwaysOnTop(true, 'screen-saver')
    floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    floatingWindow.setAlwaysOnTop(true)
  }

  // 记录位置和大小变化
  const saveBounds = () => {
    if (!floatingWindow || floatingWindow.isDestroyed()) return
    const bounds = floatingWindow.getBounds()
    configManager.set({
      ui: {
        ...configManager.get().ui,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    })
  }

  floatingWindow.on('moved', saveBounds)
  floatingWindow.on('resized', saveBounds)

  floatingWindow.on('closed', () => {
    floatingWindow = null
  })

  // 加载页面
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#floating`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'floating'
    })
  }

  return floatingWindow
}

export function openDashboardWindow(): BrowserWindow {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show()
    dashboardWindow.focus()
    return dashboardWindow
  }

  dashboardWindow = new BrowserWindow({
    width: 800,
    height: 640,
    minWidth: 700,
    minHeight: 560,
    resizable: true,
    title: 'ConeLiveTranslate · 设置',
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    backgroundColor: '#1C1C1E',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  dashboardWindow.on('closed', () => {
    dashboardWindow = null
  })

  // 外部链接默认在系统默认浏览器中打开
  dashboardWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    dashboardWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#dashboard`)
  } else {
    dashboardWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'dashboard'
    })
  }

  return dashboardWindow
}
