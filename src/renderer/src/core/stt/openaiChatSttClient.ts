import type { AppConfig } from '../../types/config'
import type { STTClient } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

export class OpenAIChatSTTClient implements STTClient {
  private cfg: AppConfig['stt']

  constructor(cfg: AppConfig['stt']) {
    this.cfg = cfg
  }

  public async transcribe(wavBytes: Uint8Array): Promise<string> {
    let base = (this.cfg.base_url || '').replace(/\/+$/, '')
    base = base.replace(/\/audio$/, '')
    let url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`

    const b64 = uint8ArrayToBase64(wavBytes)
    const prompt =
      this.cfg.language && this.cfg.language !== 'auto'
        ? `Transcribe the audio speech verbatim into ${this.cfg.language}. Output ONLY the transcribed text, nothing else.`
        : 'Transcribe the audio speech verbatim. Output ONLY the transcribed text, nothing else.'

    const payload = {
      model: this.cfg.model || 'gpt-4o-audio-preview',
      modalities: ['text'],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'input_audio',
              input_audio: {
                data: b64,
                format: 'wav'
              }
            }
          ]
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

        // 若 404 (该服务商未开放 /chat/completions audio，仅提供 /transcriptions)，自动兜底 Whisper 端点
        if (res.status === 404) {
          const fallbackUrl = `${base}/transcriptions`
          const formData = new FormData()
          formData.append(
            'file',
            new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' }),
            'audio.wav'
          )
          formData.append('model', this.cfg.model || 'whisper-1')
          if (this.cfg.language && this.cfg.language !== 'auto') {
            formData.append('language', this.cfg.language)
          }

          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.cfg.api_key}` },
            body: formData,
            signal: controller.signal
          })

          if (fallbackRes.ok) {
            clearTimeout(timeoutId)
            const d = await fallbackRes.json()
            return (d.text || d.result || '').trim()
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
        const content = data?.choices?.[0]?.message?.content
        if (typeof content === 'string') {
          return content.trim()
        }
        if (Array.isArray(content)) {
          return content
            .map((item) =>
              typeof item === 'object' ? item.text || item.content || '' : String(item)
            )
            .join('')
            .trim()
        }
        return (data.text || data.result || '').trim()
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
