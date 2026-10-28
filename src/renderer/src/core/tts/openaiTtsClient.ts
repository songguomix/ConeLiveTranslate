import type { AppConfig } from '../../types/config'
import type { TTSClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])

export class OpenAITTSClient implements TTSClient {
  private cfg: AppConfig['tts']

  constructor(cfg: AppConfig['tts']) {
    this.cfg = cfg
  }

  public async synthesize(text: string): Promise<Uint8Array> {
    const raw = (text || '').trim()
    if (!raw) return new Uint8Array(0)

    let base = (this.cfg.base_url || '').replace(/\/+$/, '')
    base = base.replace(/\/audio$/, '')
    // 默认 OpenAI 标准兼容尾缀：/speech（不要 audio）
    let url = base.endsWith('/speech') ? base : `${base}/speech`

    const payload = {
      model: this.cfg.model || 'tts-1',
      input: raw,
      voice: this.cfg.voice || 'alloy',
      response_format: 'wav'
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (this.cfg.timeout || 30) * 1000)

      try {
        let res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfg.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })

        // 若 404 且当前请求未包含 /audio/，自动兜底尝试 /audio/speech
        if (res.status === 404 && !url.includes('/audio/')) {
          const fallbackUrl = `${base}/audio/speech`
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cfg.api_key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          })
          if (fallbackRes.ok || fallbackRes.status !== 404) {
            url = fallbackUrl
            res = fallbackRes
          }
        }

        clearTimeout(timeoutId)

        if (RETRYABLE_CODES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`TTS HTTP ${res.status}: ${await res.text()}`)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`TTS HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        const arrayBuffer = await res.arrayBuffer()
        if (arrayBuffer.byteLength === 0) {
          throw new Error('TTS 返回空音频数据')
        }

        return new Uint8Array(arrayBuffer)
      } catch (err: any) {
        clearTimeout(timeoutId)
        lastError = err.name === 'AbortError' ? new Error('TTS 请求超时') : err
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error('TTS 失败: 重试耗尽')
  }
}
