import { AudioCapture } from './audio/audioCapture'
import { AudioPlayer } from './audio/audioPlayer'
import { createSTT } from './stt/sttFactory'
import { createTranslator } from './translate/translateFactory'
import { createTTS } from './tts/ttsFactory'
import type { AppConfig, EngineStatus } from '../types/config'

export interface PipelineCallbacks {
  onOriginalText: (text: string) => void
  onTranslatedText: (text: string) => void
  onTranslatedPartial?: (text: string) => void
  onStatusChanged: (status: EngineStatus) => void
  onLevelUpdate: (level: number) => void
  onErrorOccurred: (err: string) => void
  onStarted?: () => void
  onStopped?: () => void
}

interface TranslatedResult {
  translated: string
  audio: Uint8Array | null
  error: string | null
}

export class TranslateEngine {
  private config: AppConfig
  private callbacks: PipelineCallbacks

  private isRunning: boolean = false
  private generation: number = 0
  private capture: AudioCapture | null = null
  private player: AudioPlayer

  private seqCount: number = 0
  private inFlight: number = 0

  // 双阶段按序发射队列：原文与译文解耦，消除翻译等待导致的原文显示延迟
  private nextOriginalEmit: number = 0
  private originalResults: Map<number, string> = new Map()

  private nextTranslatedEmit: number = 0
  private translatedResults: Map<number, TranslatedResult> = new Map()

  private ttsAvailable: boolean = false
  private ttsActive: boolean = false
  private ttsErrorReported: boolean = false

  // 最大并发请求数 (调优为 4，保证短句密集对话时吞吐充足)
  private readonly MAX_CONCURRENCY = 4
  private taskQueue: Array<{ seq: number; wav: Uint8Array }> = []

  constructor(config: AppConfig, callbacks: PipelineCallbacks) {
    this.config = config
    this.callbacks = callbacks
    this.player = new AudioPlayer((msg) => this.callbacks.onErrorOccurred(msg))
  }

  public updateConfig(newConfig: AppConfig): void {
    this.config = newConfig
    if (newConfig.tts?.output_device_name) {
      this.player.setOutputDevice(newConfig.tts.output_device_name)
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return

    const cfg = this.config
    if (!cfg.stt.api_key) {
      this.callbacks.onErrorOccurred('请先在设置中填写语音转文字模型的 API Key')
      return
    }

    if (cfg.translate.backend === 'openai' && !cfg.translate.api_key) {
      this.callbacks.onErrorOccurred('请先在设置中填写翻译模型的 API Key')
      return
    }

    this.isRunning = true
    this.generation++
    const gen = this.generation
    this.seqCount = 0
    this.inFlight = 0
    this.nextOriginalEmit = 0
    this.nextTranslatedEmit = 0
    this.originalResults.clear()
    this.translatedResults.clear()
    this.taskQueue = []

    this.ttsAvailable = Boolean(cfg.tts && cfg.tts.api_key)
    this.ttsActive = Boolean(this.ttsAvailable && cfg.tts.enabled)
    this.ttsErrorReported = false

    if (cfg.tts?.output_device_name) {
      this.player.setOutputDevice(cfg.tts.output_device_name)
    }

    this.capture = new AudioCapture(cfg.audio, {
      onPhrase: (wavBytes) => {
        if (!this.isCurrent(gen)) return
        const seq = this.seqCount++
        this.enqueueTask(gen, seq, wavBytes)
      },
      onLevel: (rms) => {
        if (this.isCurrent(gen)) {
          this.callbacks.onLevelUpdate(rms)
        }
      },
      onState: (state) => {
        if (!this.isCurrent(gen)) return
        if (state === 'recording') {
          this.callbacks.onStatusChanged('recording')
        }
      },
      onError: (msg) => {
        if (this.isCurrent(gen)) {
          this.callbacks.onErrorOccurred(msg)
        }
      }
    })

    await this.capture.start()
    this.callbacks.onStarted?.()
    this.callbacks.onStatusChanged('listening')
  }

  public stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    this.player.stop()
    if (this.capture) {
      this.capture.stop()
      this.capture = null
    }
    this.taskQueue = []
    this.originalResults.clear()
    this.translatedResults.clear()
    this.inFlight = 0
    this.callbacks.onStatusChanged('idle')
    this.callbacks.onStopped?.()
  }

  public getRunning(): boolean {
    return this.isRunning
  }

  public setInterpret(active: boolean): void {
    this.ttsActive = Boolean(active && this.ttsAvailable)
    if (!this.ttsActive) {
      this.player.clear()
    }
  }

  public getInterpretActive(): boolean {
    return this.ttsActive
  }

  public isInterpretAvailable(): boolean {
    return Boolean(this.config.tts && this.config.tts.api_key)
  }

  private isCurrent(gen: number): boolean {
    return this.isRunning && gen === this.generation
  }

  private enqueueTask(gen: number, seq: number, wav: Uint8Array): void {
    this.taskQueue.push({ seq, wav })
    this.pumpQueue(gen)
  }

  private pumpQueue(gen: number): void {
    if (!this.isCurrent(gen)) return

    while (this.inFlight < this.MAX_CONCURRENCY && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!
      this.inFlight++
      this.processChunk(gen, task.seq, task.wav)
    }
  }

  private async processChunk(gen: number, seq: number, wav: Uint8Array): Promise<void> {
    const cfg = this.config
    const stt = createSTT(cfg.stt)
    const translator = createTranslator(cfg.translate)
    const tts = this.ttsAvailable ? createTTS(cfg.tts) : null

    let original = ''
    let translated = ''
    let error: string | null = null
    let audio: Uint8Array | null = null

    try {
      if (this.isCurrent(gen)) {
        this.callbacks.onStatusChanged('recognizing')
      }

      // 1. 语音转文字 (STT)
      try {
        original = (await stt.transcribe(wav)) || ''
      } catch (e: any) {
        error = `识别失败: ${e?.message || e}`
      }

      // 核心延迟优化：一旦 STT 完成，立即发射原文，大幅缩短听到语音到看到原文的延迟！
      if (this.isCurrent(gen)) {
        this.commitOriginal(gen, seq, original.trim())
      }

      // 2. 文本翻译（识别出内容才翻）
      if (!error && original.trim()) {
        if (this.isCurrent(gen)) {
          this.callbacks.onStatusChanged('translating')
        }
        try {
          translated =
            (await translator.translate(original, (partial) => {
              if (this.isCurrent(gen) && seq >= this.nextTranslatedEmit) {
                this.callbacks.onTranslatedPartial?.(partial)
              }
            })) || ''
        } catch (e: any) {
          error = `翻译失败: ${e?.message || e}`
        }
      }

      // 3. 语音合成 (TTS，异步并行合成)
      if (
        tts &&
        !error &&
        translated.trim() &&
        this.ttsActive &&
        this.isCurrent(gen)
      ) {
        try {
          audio = (await tts.synthesize(translated)) || null
        } catch (e: any) {
          if (this.isCurrent(gen) && !this.ttsErrorReported) {
            this.ttsErrorReported = true
            this.callbacks.onErrorOccurred(`配音失败: ${e?.message || e}`)
          }
        }
      }
    } catch (e: any) {
      error = `处理异常: ${e?.message || e}`
    } finally {
      this.commitTranslated(gen, seq, translated.trim(), audio, error)
    }
  }

  private commitOriginal(gen: number, seq: number, text: string): void {
    if (!this.isCurrent(gen)) return
    this.originalResults.set(seq, text)

    // 缺失自愈跳空
    if (!this.originalResults.has(this.nextOriginalEmit) && this.originalResults.size > 0) {
      const minKey = Math.min(...Array.from(this.originalResults.keys()))
      if (this.inFlight === 0 || minKey - this.nextOriginalEmit > 3) {
        this.nextOriginalEmit = minKey
      }
    }

    while (this.originalResults.has(this.nextOriginalEmit)) {
      const item = this.originalResults.get(this.nextOriginalEmit)!
      this.originalResults.delete(this.nextOriginalEmit)
      this.nextOriginalEmit++
      if (item) {
        this.callbacks.onOriginalText(item)
      }
    }
  }

  private commitTranslated(
    gen: number,
    seq: number,
    translated: string,
    audio: Uint8Array | null,
    error: string | null
  ): void {
    if (!this.isCurrent(gen)) return

    this.inFlight--
    this.translatedResults.set(seq, { translated, audio, error })

    // 缺失自愈对齐
    if (
      !this.translatedResults.has(this.nextTranslatedEmit) &&
      this.translatedResults.size > 0
    ) {
      const minKey = Math.min(...Array.from(this.translatedResults.keys()))
      if (this.inFlight === 0 || minKey - this.nextTranslatedEmit > 3) {
        this.nextTranslatedEmit = minKey
      }
    }

    // 按序发射就绪译文切片
    while (this.translatedResults.has(this.nextTranslatedEmit)) {
      const item = this.translatedResults.get(this.nextTranslatedEmit)!
      this.translatedResults.delete(this.nextTranslatedEmit)
      this.nextTranslatedEmit++

      if (item.error) {
        this.callbacks.onErrorOccurred(item.error)
      } else {
        if (item.translated) {
          this.callbacks.onTranslatedText(item.translated)
        }
        if (item.audio && this.ttsActive) {
          this.player.play(item.audio, this.config.tts?.volume ?? 1.0)
        }
      }
    }

    // 内存防泄漏限制
    if (this.originalResults.size > 50) {
      const keys = Array.from(this.originalResults.keys()).sort((a, b) => a - b)
      for (const k of keys.slice(0, -20)) this.originalResults.delete(k)
    }
    if (this.translatedResults.size > 50) {
      const keys = Array.from(this.translatedResults.keys()).sort((a, b) => a - b)
      for (const k of keys.slice(0, -20)) this.translatedResults.delete(k)
    }

    if (this.inFlight === 0 && this.taskQueue.length === 0) {
      this.callbacks.onStatusChanged('listening')
    }

    // 继续消费队列中的切片
    this.pumpQueue(gen)
  }
}
