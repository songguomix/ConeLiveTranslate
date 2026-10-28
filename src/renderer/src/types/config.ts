export type { AppConfig, DesktopSource } from '../../../preload/index.d'

export type EngineStatus =
  | 'idle'
  | 'listening'
  | 'recording'
  | 'recognizing'
  | 'translating'
  | 'error'

export interface StateStyle {
  color: string
  label: string
}

export const STATE_STYLES: Record<EngineStatus, StateStyle> = {
  idle: { color: '#8E8E93', label: '已停止' },
  listening: { color: '#34C759', label: '监听中' },
  recording: { color: '#FF3B30', label: '录音中' },
  recognizing: { color: '#FF9500', label: '识别中' },
  translating: { color: '#0A84FF', label: '翻译中' },
  error: { color: '#FF3B30', label: '错误' }
}
