import type { AppConfig } from '../../types/config'
import type { STTClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])

export class WhisperClient implements STTClient {
  private cfg: AppConfig['stt']

  constructor(cfg: AppConfig['stt']) {
    this.cfg = cfg
  }

  public async transcribe(wavBytes: Uint8Array): Promise<string> {
    let base = (this.cfg.base_url || '').replace(/\/+$/, '')
    base = base.replace(/\/audio$/, '')
    // 默认 OpenAI 标准兼容尾缀：/transcriptions（不要 audio）
    let url = base.endsWith('/transcriptions') ? base : `${base}/transcriptions`

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), (this.cfg.timeout || 30) * 1000)

      try {
        const formData = new FormData()
        formData.append('file', new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' }), 'audio.wav')
        formData.append('model', this.cfg.model || 'whisper-1')
        if (this.cfg.language && this.cfg.language !== 'auto') {
          formData.append('language', this.cfg.language)
        }

        let res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.cfg.api_key}`
          },
          body: formData,
          signal: controller.signal
        })

        // 若 404 且当前请求未包含 /audio/，自动兜底兼容 /audio/transcriptions
        if (res.status === 404 && !url.includes('/audio/')) {
          const fallbackUrl = `${base}/audio/transcriptions`
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cfg.api_key}`
            },
            body: formData,
            signal: controller.signal
          })
          if (fallbackRes.ok || fallbackRes.status !== 404) {
            url = fallbackUrl
            res = fallbackRes
          }
        }

        clearTimeout(timeoutId)

        if (RETRYABLE_CODES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = new Error(`STT HTTP ${res.status}: ${await res.text()}`)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`STT HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        const data = await res.json()
        if (typeof data === 'object' && data !== null) {
          return (data.text || data.result || '').trim()
        }
        return String(data).trim()
      } catch (err: any) {
        clearTimeout(timeoutId)
        if (err.name === 'AbortError') {
          lastError = new Error('STT 请求超时')
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

    throw lastError || new Error('STT 失败: 重试耗尽')
  }
}
