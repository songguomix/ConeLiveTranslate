export interface AppConfig {
  stt: {
    backend: 'openai' | 'mimo'
    base_url: string
    api_key: string
    model: string
    language: string
    timeout: number
  }
  translate: {
    backend: 'mymemory' | 'openai'
    base_url: string
    api_key: string
    model: string
    source_lang: string
    target_lang: string
    timeout: number
  }
  tts: {
    enabled: boolean
    backend: 'mimo' | 'openai'
    base_url: string
    api_key: string
    model: string
    voice: string
    style: string
    volume: number
    output_device_name: string
    timeout: number
  }
  audio: {
    device_name: string
    sample_rate: number
    channels: number
    frames_per_buffer: number
    energy_threshold: number
    chunk_duration: number
  }
  ui: {
    opacity: number
    bg_color: string
    bg_alpha: number
    accent_color: string
    font_family: string
    font_size_original: number
    font_size_translated: number
    font_color: string
    width: number
    height: number
    x?: number
    y?: number
  }
  enabled: boolean
}

export interface DesktopSource {
  id: string
  name: string
}

export interface IElectronAPI {
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>
  onConfigChanged: (callback: (config: AppConfig) => void) => () => void
  openDashboard: () => void
  closeDashboard: () => void
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  minimizeFloating: () => void
  closeFloating: () => void
  setAlwaysOnTop: (top: boolean) => Promise<boolean>
  isAlwaysOnTop: () => Promise<boolean>
  getDesktopSources: () => Promise<DesktopSource[]>
  sendState: (state: string) => void
  onToggleListen: (callback: () => void) => () => void
  onClearSubtitles: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  platform: 'win32' | 'darwin' | 'linux'
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
