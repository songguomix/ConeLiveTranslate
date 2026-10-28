export class AudioPlayer {
  private queue: Array<{ bytes: Uint8Array; volume: number }> = []
  private isPlaying: boolean = false
  private currentAudio: HTMLAudioElement | null = null
  private sinkId: string = ''
  private onError: (msg: string) => void

  constructor(onError?: (msg: string) => void) {
    this.onError = onError || (() => {})
  }

  public setOutputDevice(deviceId: string): void {
    this.sinkId = deviceId || ''
    if (this.currentAudio && (this.currentAudio as any).setSinkId) {
      try {
        ;(this.currentAudio as any).setSinkId(this.sinkId)
      } catch (e) {
        console.warn('[AudioPlayer] setSinkId error:', e)
      }
    }
  }

  public play(wavBytes: Uint8Array, volume: number = 1.0): void {
    this.queue.push({ bytes: wavBytes, volume })
    if (!this.isPlaying) {
      this.playNext()
    }
  }

  public stop(): void {
    this.clear()
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    this.isPlaying = false
  }

  public clear(): void {
    this.queue = []
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const item = this.queue.shift()!

    try {
      const blob = new Blob([item.bytes.buffer as ArrayBuffer], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      this.currentAudio = audio

      audio.volume = Math.max(0, Math.min(1, item.volume))

      if (this.sinkId && (audio as any).setSinkId) {
        try {
          await (audio as any).setSinkId(this.sinkId)
        } catch (e) {
          console.warn('[AudioPlayer] Failed to set sinkId on audio element:', e)
        }
      }

      audio.onended = () => {
        URL.revokeObjectURL(url)
        this.currentAudio = null
        this.playNext()
      }

      audio.onerror = (e) => {
        URL.revokeObjectURL(url)
        this.currentAudio = null
        this.onError(`TTS 音频播放失败: ${e}`)
        this.playNext()
      }

      await audio.play()
    } catch (err: any) {
      this.onError(`TTS 播放异常: ${err?.message || err}`)
      this.playNext()
    }
  }
}
