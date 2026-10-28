import type { AppConfig } from '../../types/config'
import type { Translator } from './types'

const LANG_MAP: Record<string, string> = {
  中文: 'zh-CN',
  英文: 'en',
  English: 'en',
  日本語: 'ja',
  日文: 'ja',
  韩语: 'ko',
  한국어: 'ko',
  Français: 'fr',
  法文: 'fr',
  Deutsch: 'de',
  德文: 'de',
  Español: 'es',
  西班牙文: 'es',
  Русский: 'ru',
  俄文: 'ru',
  auto: 'autodetect'
}

const API_URL = 'https://api.mymemory.translated.net/get'
const MAX_RETRIES = 2

function decodeHtmlEntities(str: string): string {
  const doc = new DOMParser().parseFromString(str, 'text/html')
  return doc.body.textContent || str
}

export class MyMemoryTranslator implements Translator {
  private cfg: AppConfig['translate']

  constructor(cfg: AppConfig['translate']) {
    this.cfg = cfg
  }

  private toCode(lang: string): string {
    if (!lang) return 'autodetect'
    if (LANG_MAP[lang]) return LANG_MAP[lang]
    if (LANG_MAP[lang.toLowerCase()]) return LANG_MAP[lang.toLowerCase()]
    if (lang.length <= 5) return lang
    return lang
  }

  private baseCode(code: string): string {
    return (code || '').split('-')[0].toLowerCase()
  }

  public async translate(
    text: string,
    onPartial?: (partial: string) => void
  ): Promise<string> {
    const raw = (text || '').trim()
    if (!raw) return ''

    const src = this.toCode(this.cfg.source_lang || 'auto')
    const tgt = this.toCode(this.cfg.target_lang || '中文')

    if (src !== 'autodetect' && this.baseCode(src) === this.baseCode(tgt)) {
      return raw
    }

    const data = await this.request(raw, src, tgt)
    let translated = this.parseTranslation(data)

    // MyMemory 在 source=autodetect 时只返回 detectedLanguage，需要以识别出的语言再请求一次
    if (src === 'autodetect') {
      const detected = data?.responseData?.detectedLanguage || ''
      if (detected && this.baseCode(detected) !== this.baseCode(tgt)) {
        try {
          const data2 = await this.request(raw, detected, tgt)
          const t2 = this.parseTranslation(data2)
          if (t2.trim()) {
            translated = t2
          }
        } catch {}
      }
    }

    if (!translated.trim()) {
      throw new Error('MyMemory 返回译文为空')
    }

    const finalRes = translated.trim()
    onPartial?.(finalRes)
    return finalRes
  }

  private async request(text: string, src: string, tgt: string): Promise<any> {
    const url = `${API_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${src}|${tgt}`)}`
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (this.cfg.timeout || 30) * 1000)

      try {
        const res = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`MyMemory HTTP ${res.status}: ${await res.text()}`)
        }

        return await res.json()
      } catch (err: any) {
        clearTimeout(timeoutId)
        lastError = err.name === 'AbortError' ? new Error('MyMemory 请求超时') : err
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error('MyMemory 翻译失败')
  }

  private parseTranslation(data: any): string {
    const status = data?.responseStatus
    const details = data?.responseDetails || ''

    if (status && status !== 200 && status !== '200') {
      throw new Error(`MyMemory 错误 (${status}): ${details}`)
    }

    const raw = data?.responseData?.translatedText || ''
    if (raw.startsWith('MYMEMORY WARNING')) {
      throw new Error(`MyMemory 提示: ${raw}`)
    }

    return decodeHtmlEntities(raw)
  }
}
