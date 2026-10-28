import type { AppConfig } from '../../types/config'
import type { Translator } from './types'
import { MyMemoryTranslator } from './myMemoryClient'
import { OpenAITranslator } from './openaiClient'

export function createTranslator(cfg: AppConfig['translate']): Translator {
  const backend = (cfg.backend || 'mymemory').toLowerCase()
  if (backend === 'openai') {
    return new OpenAITranslator(cfg)
  }
  return new MyMemoryTranslator(cfg)
}
