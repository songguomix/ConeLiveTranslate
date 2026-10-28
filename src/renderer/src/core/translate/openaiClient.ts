import type { AppConfig } from '../../types/config'
import type { Translator } from './types'

const MAX_RETRIES = 2
const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504])

export class OpenAITranslator implements Translator {
  private cfg: AppConfig['translate']

  constructor(cfg: AppConfig['translate']) {
    this.cfg = cfg
  }

  public async translate(
    text: string,
    onPartial?: (partial: string) => void
  ): Promise<string> {
    const raw = (text || '').trim()
    if (!raw) return ''

    let base = (this.cfg.base_url || '').replace(/\/+$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`

    const src = this.cfg.source_lang || 'auto'
    const target = this.cfg.target_lang || '中文'
    const srcHint = src === 'auto' ? '' : `原文语言为 ${src}。`
    const sysPrompt = `你是一个专业翻译引擎。${srcHint}请将用户输入翻译为${target}。只输出译文，不要解释、不要添加引号或注释，保持原文的语气与标点风格。`

    const enableStream = Boolean(onPartial)
    const payload = {
      model: this.cfg.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: raw }
      ],
      temperature: 0.2,
      stream: enableStream
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
          lastError = new Error(`Translate HTTP ${res.status}: ${await res.text()}`)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Translate HTTP ${res.status}: ${errText.slice(0, 300)}`)
        }

        // 流式响应解析 (低延迟实时吐字)
        const contentType = res.headers.get('content-type') || ''
        if (enableStream && res.body && (contentType.includes('text/event-stream') || contentType.includes('application/octet-stream') || !contentType.includes('application/json'))) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let accumulated = ''
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data:')) continue
              const dataStr = trimmed.slice(5).trim()
              if (dataStr === '[DONE]') break
              try {
                const parsed = JSON.parse(dataStr)
                const delta = parsed?.choices?.[0]?.delta?.content || ''
                if (delta) {
                  accumulated += delta
                  onPartial?.(accumulated)
                }
              } catch {}
            }
          }
          if (accumulated.trim()) {
            return accumulated.trim()
          }
        }

        // 非流式响应解析兜底
        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content
        if (typeof content !== 'string') {
          throw new Error(`翻译响应解析失败: ${JSON.stringify(data).slice(0, 300)}`)
        }
        const finalTrimmed = content.trim()
        onPartial?.(finalTrimmed)
        return finalTrimmed
      } catch (err: any) {
        clearTimeout(timeoutId)
        lastError = err.name === 'AbortError' ? new Error('翻译请求超时') : err
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error('翻译失败: 重试耗尽')
  }
}
