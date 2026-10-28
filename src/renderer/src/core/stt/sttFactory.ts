import type { AppConfig } from '../../types/config'
import type { STTClient } from './types'
import { OpenAIChatSTTClient } from './openaiChatSttClient'
import { WhisperClient } from './whisperClient'
import { MimoSTTClient } from './mimoClient'

export function createSTT(cfg: AppConfig['stt']): STTClient {
  const backend = (cfg.backend || 'openai').toLowerCase()
  if (backend === 'mimo') {
    return new MimoSTTClient(cfg)
  }
  if (backend === 'whisper') {
    return new WhisperClient(cfg)
  }
  // 默认统一使用 /chat/completions (OpenAIChatSTTClient)
  return new OpenAIChatSTTClient(cfg)
}
