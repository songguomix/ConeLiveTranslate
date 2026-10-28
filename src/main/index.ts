import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { createFloatingWindow, openDashboardWindow, getFloatingWindow, getDashboardWindow } from './windows'
import { createTray, updateTrayState, updateTrayMenu } from './tray'
import { getConfigManager } from './config'
import type { AppConfig } from '../preload/index.d'

// 单实例锁定
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const floatingWin = getFloatingWindow()
    if (floatingWin) {
      if (floatingWin.isMinimized()) floatingWin.restore()
      floatingWin.show()
      floatingWin.focus()
    }
  })
}

// 阻止窗口全部关闭时自动退出（保持托盘常驻）
app.on('window-all-closed', () => {
  // 不退出，通过托盘驻留
})

// 注册 IPC 处理程序
function setupIpc(): void {
  const configManager = getConfigManager()

  // 读取配置
  ipcMain.handle('get-config', () => {
    return configManager.get()
  })

  // 保存配置并广播给所有窗口
  ipcMain.handle('save-config', (_event, newConfig: AppConfig) => {
    configManager.set(newConfig)
    const floatingWin = getFloatingWindow()
    const dashboardWin = getDashboardWindow()

    if (floatingWin && !floatingWin.isDestroyed()) {
      floatingWin.webContents.send('config-changed', newConfig)
    }
    if (dashboardWin && !dashboardWin.isDestroyed()) {
      dashboardWin.webContents.send('config-changed', newConfig)
    }
  })

  // 打开设置
  ipcMain.on('open-dashboard', () => {
    openDashboardWindow()
  })

  // 关闭设置
  ipcMain.on('close-dashboard', () => {
    const dashboardWin = getDashboardWindow()
    if (dashboardWin && !dashboardWin.isDestroyed()) {
      dashboardWin.close()
    }
  })

  // 鼠标穿透
  ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options)
    }
  })

  // 最小化 / 隐藏悬浮窗
  ipcMain.on('minimize-floating', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.minimize()
    }
  })

  ipcMain.on('close-floating', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.hide()
      updateTrayMenu()
    }
  })

  // 置顶切换
  ipcMain.handle('set-always-on-top', (event, top: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      if (process.platform === 'darwin') {
        win.setAlwaysOnTop(top, top ? 'screen-saver' : 'normal')
      } else {
        win.setAlwaysOnTop(top)
      }
      return win.isAlwaysOnTop()
    }
    return false
  })

  ipcMain.handle('is-always-on-top', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win.isAlwaysOnTop() : false
  })

  // 获取桌面采集音频/视频源列表（用于系统声音抓取）
  ipcMain.handle('get-desktop-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }
      })
      return sources.map((s) => ({
        id: s.id,
        name: s.name
      }))
    } catch (e) {
      console.error('[Main] getDesktopSources error:', e)
      return []
    }
  })

  // 状态同步
  ipcMain.on('update-state', (_event, state: string) => {
    updateTrayState(state)
  })
}

app.whenReady().then(() => {
  setupIpc()
  createTray()
  createFloatingWindow()

  app.on('activate', () => {
    const floatingWin = getFloatingWindow()
    if (!floatingWin || floatingWin.isDestroyed()) {
      createFloatingWindow()
    } else {
      floatingWin.show()
    }
  })
})
