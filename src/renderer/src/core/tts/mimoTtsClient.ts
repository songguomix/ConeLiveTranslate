import type { AppConfig } from '../../types/config'
import type { TTSClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])
const DEFAULT_STYLE = '自然、清晰、口语化的播报语气。'

function base64ToUint8Array(b64: string): Uint8Array {
  // 剥离可能存在的 data:audio/...;base64, 前缀
  const clean = b64.replace(/^data:audio\/\w+;base64,/, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export class MimoTTSClient implements TTSClient {
  private cfg: AppConfig['tts']

  constructor(cfg: AppConfig['tts']) {
    this.cfg = cfg
  }

  public async synthesize(text: string): Promise<Uint8Array> {
    const raw = (text || '').trim()
    if (!raw) return new Uint8Array(0)

    const base = (this.cfg.base_url || '').replace(/\/+$/, '')
    const url = `${base}/chat/completions`

    const style = (this.cfg.style || '').trim() || DEFAULT_STYLE
    const payload = {
      model: this.cfg.model || 'mimo-v2.5-tts',
      messages: [
        { role: 'user', content: style },
        { role: 'assistant', content: raw }
      ],
      audio: { format: 'wav', voice: this.cfg.voice || 'mimo_default' },
      stream: false
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
          lastError = new Error(`MiMo TTS HTTP ${res.status}: ${await res.text()}`)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`MiMo TTS HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        const data = await res.json()
        const audio = data?.choices?.[0]?.message?.audio
        const b64 = typeof audio === 'object' ? audio?.data : audio
        if (!b64 || typeof b64 !== 'string') {
          throw new Error(`MiMo TTS 响应未包含有效音频数据: ${JSON.stringify(data).slice(0, 300)}`)
        }

        return base64ToUint8Array(b64)
      } catch (err: any) {
        clearTimeout(timeoutId)
        lastError = err.name === 'AbortError' ? new Error('MiMo TTS 请求超时') : err
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error('MiMo TTS 失败: 重试耗尽')
  }
}
