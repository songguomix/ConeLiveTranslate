/**
 * PCM 采样数组转标准 WAV (RIFF 16-bit PCM 单声道) 二进制数据
 */
export function encodeWAV(
  samples: Float32Array,
  sampleRate: number = 16000,
  numChannels: number = 1
): Uint8Array {
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // 1. RIFF 标识符
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // 2. fmt 子块
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bytesPerSample * 8, true) // 16 bits

  // 3. data 子块
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // 写入 PCM 16-bit 有符号整数
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Uint8Array(buffer)
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * 线性插值重采样
 */
export function resample(
  source: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array {
  if (sourceRate === targetRate || source.length === 0) {
    return source
  }
  const ratio = sourceRate / targetRate
  const newLength = Math.round(source.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const indexFloor = Math.floor(srcIndex)
    const indexCeil = Math.min(source.length - 1, indexFloor + 1)
    const factor = srcIndex - indexFloor
    result[i] = source[indexFloor] * (1 - factor) + source[indexCeil] * factor
  }

  return result
}

/**
 * 计算 PCM 样本的 RMS 能量（范围大致 0 ~ 32767，与 Python 版本对齐）
 */
export function calculateRMS(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] * 32768
    sum += s * s
  }
  return Math.sqrt(sum / samples.length)
}
