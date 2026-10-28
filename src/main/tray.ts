import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import { join } from 'path'
import { getFloatingWindow, openDashboardWindow } from './windows'

let tray: Tray | null = null
let isListening = false

export function createTray(): Tray {
  let iconPath = join(__dirname, '../../icon.png')
  // 打包环境或源码环境寻找图标
  if (app.isPackaged) {
    iconPath = join(process.resourcesPath, 'icon.png')
  }

  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    // 兜底小图标
    icon = nativeImage.createFromNamedImage('NSStatusAvailable')
  }

  if (process.platform === 'darwin') {
    // macOS 菜单栏图标尺寸通常为 16x16 或 22x22
    icon = icon.resize({ width: 18, height: 18 })
  }

  tray = new Tray(icon)
  tray.setToolTip('ConeLiveTranslate · 实时语音翻译')

  updateTrayMenu()

  tray.on('click', () => {
    const win = getFloatingWindow()
    if (win) {
      if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
      }
    }
  })

  return tray
}

export function updateTrayState(state: string): void {
  isListening = state !== 'idle'
  updateTrayMenu()
}

export function updateTrayMenu(): void {
  if (!tray) return

  const floatingWin = getFloatingWindow()
  const isVisible = floatingWin ? floatingWin.isVisible() : true

  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏悬浮字幕窗' : '显示悬浮字幕窗',
      click: () => {
        if (!floatingWin) return
        if (floatingWin.isVisible()) {
          floatingWin.hide()
        } else {
          floatingWin.show()
          floatingWin.focus()
        }
        updateTrayMenu()
      }
    },
    {
      label: '打开设置 (Dashboard)',
      click: () => {
        openDashboardWindow()
      }
    },
    { type: 'separator' },
    {
      label: isListening ? '⏹ 停止实时翻译' : '▶ 开始实时翻译',
      click: () => {
        if (floatingWin && !floatingWin.isDestroyed()) {
          floatingWin.webContents.send('action-toggle-listen')
        }
      }
    },
    {
      label: '🗑 清空字幕内容',
      click: () => {
        if (floatingWin && !floatingWin.isDestroyed()) {
          floatingWin.webContents.send('action-clear-subtitles')
        }
      }
    },
    { type: 'separator' },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true
        })
      }
    },
    { type: 'separator' },
    {
      label: '退出 ConeLiveTranslate',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
}
