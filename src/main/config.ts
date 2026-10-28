import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppConfig } from '../preload/index.d'

export const DEFAULT_CONFIG: AppConfig = {
  stt: {
    backend: 'openai',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-4o-audio-preview',
    language: 'auto',
    timeout: 30
  },
  translate: {
    backend: 'mymemory',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-4o-mini',
    source_lang: 'auto',
    target_lang: '中文',
    timeout: 30
  },
  tts: {
    enabled: false,
    backend: 'openai',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-4o-audio-preview',
    voice: 'alloy',
    style: '',
    volume: 1.0,
    output_device_name: '',
    timeout: 30
  },
  audio: {
    device_name: '',
    sample_rate: 16000,
    channels: 1,
    frames_per_buffer: 1024,
    energy_threshold: 300,
    chunk_duration: 2.0
  },
  ui: {
    opacity: 0.92,
    bg_color: '#1C1C1E',
    bg_alpha: 216,
    accent_color: '#0A84FF',
    font_family:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    font_size_original: 16,
    font_size_translated: 18,
    font_color: '#FFFFFF',
    width: 520,
    height: 180,
    x: 100,
    y: 100
  },
  enabled: false
}

class ConfigManager {
  private configPath: string
  private config: AppConfig

  constructor() {
    const userData = app.getPath('userData')
    if (!fs.existsSync(userData)) {
      fs.mkdirSync(userData, { recursive: true })
    }
    this.configPath = path.join(userData, 'config.json')
    this.config = this.load()
  }

  public get(): AppConfig {
    return { ...this.config }
  }

  public set(newConfig: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      stt: { ...this.config.stt, ...(newConfig.stt || {}) },
      translate: { ...this.config.translate, ...(newConfig.translate || {}) },
      tts: { ...this.config.tts, ...(newConfig.tts || {}) },
      audio: { ...this.config.audio, ...(newConfig.audio || {}) },
      ui: { ...this.config.ui, ...(newConfig.ui || {}) }
    }
    this.save()
  }

  private load(): AppConfig {
    // 优先尝试读取已有的 Electron 配置
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const data = JSON.parse(raw)
        return this.mergeWithDefaults(data)
      } catch (e) {
        console.error('[Config] Failed to load config:', e)
      }
    }

    // 兜底：尝试迁移旧版 Python 的 ~/.cone_live_translate/config.json
    const legacyPath = path.join(os.homedir(), '.cone_live_translate', 'config.json')
    if (fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8')
        const data = JSON.parse(raw)
        console.log('[Config] Successfully migrated legacy Python config from', legacyPath)
        const merged = this.mergeWithDefaults(data)
        this.saveDirect(merged)
        return merged
      } catch (e) {
        console.error('[Config] Failed to migrate legacy config:', e)
      }
    }

    // 默认配置
    this.saveDirect(DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG }
  }

  private mergeWithDefaults(data: any): AppConfig {
    return {
      stt: { ...DEFAULT_CONFIG.stt, ...(data.stt || {}) },
      translate: { ...DEFAULT_CONFIG.translate, ...(data.translate || {}) },
      tts: { ...DEFAULT_CONFIG.tts, ...(data.tts || {}) },
      audio: { ...DEFAULT_CONFIG.audio, ...(data.audio || {}) },
      ui: { ...DEFAULT_CONFIG.ui, ...(data.ui || {}) },
      enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_CONFIG.enabled
    }
  }

  private save(): void {
    this.saveDirect(this.config)
  }

  private saveDirect(cfg: AppConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2), 'utf-8')
    } catch (e) {
      console.error('[Config] Failed to save config:', e)
    }
  }
}

let instance: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!instance) {
    instance = new ConfigManager()
  }
  return instance
}
