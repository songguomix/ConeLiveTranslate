import type { AppConfig } from '../../types/config'
import type { TTSClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/^data:audio\/\w+;base64,/, '').trim()
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export class OpenAIChatTTSClient implements TTSClient {
  private cfg: AppConfig['tts']

  constructor(cfg: AppConfig['tts']) {
    this.cfg = cfg
  }

  public async synthesize(text: string): Promise<Uint8Array> {
    const raw = (text || '').trim()
    if (!raw) return new Uint8Array(0)

    let base = (this.cfg.base_url || '').replace(/\/+$/, '')
    base = base.replace(/\/audio$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`

    const payload = {
      model: this.cfg.model || 'gpt-4o-audio-preview',
      modalities: ['text', 'audio'],
      audio: {
        voice: this.cfg.voice || 'alloy',
        format: 'wav'
      },
      messages: [
        {
          role: 'user',
          content: this.cfg.style
            ? `${this.cfg.style}\nRead the following text out loud verbatim:\n${raw}`
            : `Read the following text out loud verbatim with natural intonation:\n${raw}`
        }
      ]
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

        // 若 404 (该服务商未开放 /chat/completions audio，仅提供 /speech)，自动兜底兼容 /speech
        if (res.status === 404) {
          const fallbackUrl = `${base}/speech`
          const fallbackPayload = {
            model: this.cfg.model || 'tts-1',
            input: raw,
            voice: this.cfg.voice || 'alloy',
            response_format: 'wav'
          }
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.cfg.api_key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(fallbackPayload),
            signal: controller.signal
          })
          if (fallbackRes.ok) {
            clearTimeout(timeoutId)
            const buf = await fallbackRes.arrayBuffer()
            return new Uint8Array(buf)
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

        const data = await res.json()
        const audio = data?.choices?.[0]?.message?.audio
        const b64 = typeof audio === 'object' ? audio?.data : audio
        if (!b64 || typeof b64 !== 'string') {
          throw new Error(`TTS 响应未包含有效音频数据: ${JSON.stringify(data).slice(0, 300)}`)
        }

        return base64ToUint8Array(b64)
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
