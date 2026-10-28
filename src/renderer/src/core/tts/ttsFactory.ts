import type { AppConfig } from '../../types/config'
import type { TTSClient } from './types'
import { MimoTTSClient } from './mimoTtsClient'
import { OpenAITTSClient } from './openaiTtsClient'

export function createTTS(cfg: AppConfig['tts']): TTSClient {
  const backend = (cfg.backend || 'mimo').toLowerCase()
  if (backend === 'openai') {
    return new OpenAITTSClient(cfg)
  }
  return new MimoTTSClient(cfg)
}
