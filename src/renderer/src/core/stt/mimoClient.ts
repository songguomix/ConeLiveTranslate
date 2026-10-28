import type { AppConfig } from '../../types/config'
import type { STTClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])
const SUPPORTED_LANGS = new Set(['zh', 'en', 'auto'])

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export class MimoSTTClient implements STTClient {
  private cfg: AppConfig['stt']

  constructor(cfg: AppConfig['stt']) {
    this.cfg = cfg
  }

  public async transcribe(wavBytes: Uint8Array): Promise<string> {
    const base = (this.cfg.base_url || '').replace(/\/+$/, '')
    const url = `${base}/chat/completions`

    const b64 = uint8ArrayToBase64(wavBytes)
    const rawLang = (this.cfg.language || 'auto').toLowerCase()
    const lang = SUPPORTED_LANGS.has(rawLang) ? rawLang : 'auto'

    const payload = {
      model: this.cfg.model || 'mimo-v2.5-asr',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:audio/wav;base64,${b64}`
              }
            }
          ]
        }
      ],
      asr_options: { language: lang }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (this.cfg.timeout || 30) * 1000)

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfg.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (RETRYABLE_CODES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`MiMo STT HTTP ${res.status}: ${await res.text()}`)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`MiMo STT HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        const data = await res.json()
        return this.extractText(data)
      } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          lastError = new Error('MiMo STT 请求超时')
        } else {
          lastError = err
        }
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error('MiMo STT 失败: 重试耗尽')
  }

  private extractText(data: any): string {
    try {
      const content = data?.choices?.[0]?.message?.content
      if (typeof content === 'string') {
        return content.trim()
      }
      if (Array.isArray(content)) {
        return content
          .map((seg) => (typeof seg === 'object' ? seg.text || seg.content || '' : String(seg)))
          .join('')
          .trim()
      }
      return ''
    } catch (e: any) {
      throw new Error(`MiMo STT 响应解析失败: ${e?.message || e}`)
    }
  }
}
