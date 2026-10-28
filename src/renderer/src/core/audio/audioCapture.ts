import { encodeWAV, resample, calculateRMS } from './wavEncoder'
import type { AppConfig } from '../../types/config'

export interface AudioCaptureCallbacks {
  onPhrase: (wavBytes: Uint8Array) => void
  onLevel: (rms: number) => void
  onState: (state: 'idle' | 'listening' | 'recording') => void
  onError: (msg: string) => void
}

export class AudioCapture {
  private cfg: AppConfig['audio']
  private callbacks: AudioCaptureCallbacks
  private isRunning: boolean = false
  private audioCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null

  // 切片缓冲区
  private chunkBuffer: Float32Array[] = []
  private bufferedSeconds: number = 0
  private hasVoice: boolean = false
  private speechSeconds: number = 0
  private silenceSeconds: number = 0

  // 前导环形缓冲区 (保存最近 ~150-250ms 音频，防止吞字首音)
  private preRollBuffer: Float32Array[] = []

  // 低延迟 VAD 停顿判定阈值 (秒)
  private readonly MIN_SPEECH_DURATION: number = 0.35 // 说话至少达标时长
  private readonly SILENCE_PAUSE_CUT: number = 0.35   // 句尾静音 350ms 立即快切

  constructor(cfg: AppConfig['audio'], callbacks: AudioCaptureCallbacks) {
    this.cfg = cfg
    this.callbacks = callbacks
  }

  public async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    this.resetChunk()
    this.preRollBuffer = []

    try {
      const stream = await this.acquireAudioStream()
      this.mediaStream = stream

      const targetSampleRate = this.cfg.sample_rate || 16000
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: targetSampleRate
      })

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume()
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream)
      // 使用 2048 帧缓冲区 (16kHz 下约 128ms)，相比 4096 减半音频处理延迟
      this.scriptNode = this.audioCtx.createScriptProcessor(2048, 1, 1)

      this.scriptNode.onaudioprocess = (event) => {
        if (!this.isRunning) return
        this.processAudio(event.inputBuffer)
      }

      this.sourceNode.connect(this.scriptNode)
      this.scriptNode.connect(this.audioCtx.destination)

      this.callbacks.onState('listening')
    } catch (err: any) {
      this.isRunning = false
      this.callbacks.onError(`音频捕获启动失败: ${err?.message || err}`)
      this.callbacks.onState('idle')
    }
  }

  public stop(): void {
    if (!this.isRunning) return
    this.isRunning = false

    // 刷新尾部残留语音切片
    if (this.chunkBuffer.length > 0 && this.hasVoice) {
      this.flushChunk()
    }
    this.resetChunk()
    this.preRollBuffer = []

    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect()
      } catch {}
      this.scriptNode = null
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch {}
      this.sourceNode = null
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close()
      } catch {}
      this.audioCtx = null
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop())
      } catch {}
      this.mediaStream = null
    }

    this.callbacks.onLevel(0)
    this.callbacks.onState('idle')
  }

  private resetChunk(): void {
    this.chunkBuffer = []
    this.bufferedSeconds = 0
    this.hasVoice = false
    this.speechSeconds = 0
    this.silenceSeconds = 0
  }

  private async acquireAudioStream(): Promise<MediaStream> {
    const devName = (this.cfg.device_name || '').trim()

    // 1. 指定外部音频输入设备
    if (devName && devName !== 'system_loopback' && devName !== 'default') {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const target = devices.find(
          (d) => d.kind === 'audioinput' && (d.deviceId === devName || d.label.includes(devName))
        )
        if (target) {
          return await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: target.deviceId },
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false
            },
            video: false
          })
        }
      } catch (e) {
        console.warn('[AudioCapture] 指定设备获取失败，降级为桌面抓取:', e)
      }
    }

    // 2. 默认模式：桌面音频内录 (Desktop Audio Loopback)
    try {
      const sources = await window.electronAPI.getDesktopSources()
      const screenSource = sources.find((s) => s.id.startsWith('screen:')) || sources[0]
      if (screenSource) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id
            }
          } as any,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id,
              minWidth: 1,
              maxWidth: 1,
              minHeight: 1,
              maxHeight: 1
            }
          } as any
        })

        stream.getVideoTracks().forEach((t) => t.stop())
        if (stream.getAudioTracks().length > 0) {
          return stream
        }
      }
    } catch (e) {
      console.warn('[AudioCapture] DesktopCapturer loopback 失败，尝试默认输入麦克风:', e)
    }

    // 3. 兜底退化：系统默认麦克风
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
  }

  private processAudio(inputBuffer: AudioBuffer): void {
    const rawData = inputBuffer.getChannelData(0)
    const samples = new Float32Array(rawData)

    const rms = calculateRMS(samples)
    this.callbacks.onLevel(rms)

    const threshold = this.cfg.energy_threshold || 300
    const isVoice = rms >= threshold
    const sampleRate = inputBuffer.sampleRate
    const frameSeconds = samples.length / sampleRate
    const chunkDur = this.cfg.chunk_duration || 2.0

    if (isVoice) {
      this.silenceSeconds = 0
      this.speechSeconds += frameSeconds

      if (!this.hasVoice) {
        this.hasVoice = true
        this.callbacks.onState('recording')
        // 激活语音时，将前导缓冲写入，确保不丢句首辅音
        for (const pr of this.preRollBuffer) {
          this.chunkBuffer.push(pr)
          this.bufferedSeconds += pr.length / sampleRate
        }
        this.preRollBuffer = []
      }

      this.chunkBuffer.push(samples)
      this.bufferedSeconds += frameSeconds
    } else {
      if (this.hasVoice) {
        // 处于语音段后的静音间隙
        this.silenceSeconds += frameSeconds
        this.chunkBuffer.push(samples)
        this.bufferedSeconds += frameSeconds

        // 核心延迟优化：当已经说过完整短语且停顿达 350ms，触发智能快切，无需死等 2s！
        if (
          this.speechSeconds >= this.MIN_SPEECH_DURATION &&
          this.silenceSeconds >= this.SILENCE_PAUSE_CUT
        ) {
          this.flushChunk()
          this.resetChunk()
          this.callbacks.onState('listening')
          return
        }
      } else {
        // 持续静音状态：维护 2 帧 (约 256ms) 的前导平滑缓冲
        this.preRollBuffer.push(samples)
        if (this.preRollBuffer.length > 2) {
          this.preRollBuffer.shift()
        }
      }
    }

    // 硬上限切片兜底 (持续连续说话无停顿时，达到预设切片时长强制下刀)
    if (this.bufferedSeconds >= chunkDur) {
      if (this.hasVoice) {
        this.flushChunk()
      }
      this.resetChunk()
      if (!isVoice) {
        this.callbacks.onState('listening')
      }
    }
  }

  private flushChunk(): void {
    if (this.chunkBuffer.length === 0) return

    let totalLength = 0
    for (const b of this.chunkBuffer) {
      totalLength += b.length
    }

    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const b of this.chunkBuffer) {
      merged.set(b, offset)
      offset += b.length
    }

    const currentRate = this.audioCtx ? this.audioCtx.sampleRate : 16000
    const targetRate = this.cfg.sample_rate || 16000
    const resampled = resample(merged, currentRate, targetRate)

    const wavBytes = encodeWAV(resampled, targetRate, 1)
    this.callbacks.onPhrase(wavBytes)
  }
}
