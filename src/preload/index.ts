import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, DesktopSource } from './index.d'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  saveConfig: (config: AppConfig): Promise<void> => ipcRenderer.invoke('save-config', config),
  onConfigChanged: (callback: (config: AppConfig) => void) => {
    const handler = (_event: any, cfg: AppConfig) => callback(cfg)
    ipcRenderer.on('config-changed', handler)
    return () => {
      ipcRenderer.removeListener('config-changed', handler)
    }
  },
  openDashboard: () => ipcRenderer.send('open-dashboard'),
  closeDashboard: () => ipcRenderer.send('close-dashboard'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options)
  },
  minimizeFloating: () => ipcRenderer.send('minimize-floating'),
  closeFloating: () => ipcRenderer.send('close-floating'),
  setAlwaysOnTop: (top: boolean): Promise<boolean> => ipcRenderer.invoke('set-always-on-top', top),
  isAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('is-always-on-top'),
  getDesktopSources: (): Promise<DesktopSource[]> => ipcRenderer.invoke('get-desktop-sources'),
  sendState: (state: string) => ipcRenderer.send('update-state', state),
  onToggleListen: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('action-toggle-listen', handler)
    return () => {
      ipcRenderer.removeListener('action-toggle-listen', handler)
    }
  },
  onClearSubtitles: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('action-clear-subtitles', handler)
    return () => {
      ipcRenderer.removeListener('action-clear-subtitles', handler)
    }
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('action-open-settings', handler)
    return () => {
      ipcRenderer.removeListener('action-open-settings', handler)
    }
  },
  platform: process.platform as 'win32' | 'darwin' | 'linux'
}

contextBridge.exposeInMainWorld('electronAPI', api)
