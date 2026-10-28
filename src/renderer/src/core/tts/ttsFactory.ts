import type { AppConfig } from '../../types/config'
import type { TTSClient } from './types'
import { MimoTTSClient } from './mimoTtsClient'
import { OpenAIChatTTSClient } from './openaiChatTtsClient'
import { OpenAITTSClient } from './openaiTtsClient'

export function createTTS(cfg: AppConfig['tts']): TTSClient {
  const backend = (cfg.backend || 'openai').toLowerCase()
  if (backend === 'mimo') {
    return new MimoTTSClient(cfg)
  }
  if (backend === 'speech') {
    return new OpenAITTSClient(cfg)
  }
  // 默认统一使用 /chat/completions (OpenAIChatTTSClient)
  return new OpenAIChatTTSClient(cfg)
}
