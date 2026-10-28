import type { AppConfig } from '../../types/config'
import type { STTClient } from './types'
import { WhisperClient } from './whisperClient'
import { MimoSTTClient } from './mimoClient'

export function createSTT(cfg: AppConfig['stt']): STTClient {
  const backend = (cfg.backend || 'openai').toLowerCase()
  if (backend === 'mimo') {
    return new MimoSTTClient(cfg)
  }
  return new WhisperClient(cfg)
}
