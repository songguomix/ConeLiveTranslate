import React, { useEffect, useState } from 'react'
import {
  Mic,
  Languages,
  Headphones,
  Sliders,
  Palette,
  Check,
  RotateCcw,
  Volume2,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react'
import type { AppConfig } from '../types/config'
import { createSTT } from '../core/stt/sttFactory'
import { createTranslator } from '../core/translate/translateFactory'
import { createTTS } from '../core/tts/ttsFactory'
import { AudioPlayer } from '../core/audio/audioPlayer'

interface DashboardViewProps {
  initialConfig: AppConfig
}

type TabType = 'stt' | 'translate' | 'tts' | 'audio' | 'ui'

export const DashboardView: React.FC<DashboardViewProps> = ({ initialConfig }) => {
  const [cfg, setCfg] = useState<AppConfig>(initialConfig)
  const [activeTab, setActiveTab] = useState<TabType>('stt')
  const [isSaved, setIsSaved] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<{ msg: string; isError: boolean } | null>(null)
  const [testing, setTesting] = useState<boolean>(false)

  // 密码显示切换
  const [showSttKey, setShowSttKey] = useState(false)
  const [showTranslateKey, setShowTranslateKey] = useState(false)
  const [showTtsKey, setShowTtsKey] = useState(false)

  // 音频输入/输出设备列表
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    // 枚举系统可用的媒体输入与输出设备
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'))
        setAudioOutputDevices(devices.filter((d) => d.kind === 'audiooutput'))
      } catch (e) {
        console.warn('设备枚举失败:', e)
      }
    }
    loadDevices()
  }, [])

  const handleSave = async () => {
    await window.electronAPI.saveConfig(cfg)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const handleTestSTT = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (!cfg.stt.api_key) {
        throw new Error('请先填写 STT API Key')
      }
      // 生成 0.5s 静音测试 WAV
      const dummyWav = new Uint8Array(44 + 8000)
      const stt = createSTT(cfg.stt)
      await stt.transcribe(dummyWav)
      setTestResult({ msg: 'STT 接口连接成功！', isError: false })
    } catch (err: any) {
      setTestResult({ msg: `STT 接口测试: ${err.message || err}`, isError: true })
    } finally {
      setTesting(false)
    }
  }

  const handleTestTranslate = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const translator = createTranslator(cfg.translate)
      const res = await translator.translate('Hello world, this is a live test.')
      setTestResult({ msg: `翻译成功: "${res}"`, isError: false })
    } catch (err: any) {
      setTestResult({ msg: `翻译测试失败: ${err.message || err}`, isError: true })
    } finally {
      setTesting(false)
    }
  }

  const handleTestTTS = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (!cfg.tts.api_key) {
        throw new Error('请先填写 TTS API Key')
      }
      const tts = createTTS(cfg.tts)
      const audioBytes = await tts.synthesize('语音合成测试成功。')
      const player = new AudioPlayer()
      if (cfg.tts.output_device_name) {
        player.setOutputDevice(cfg.tts.output_device_name)
      }
      player.play(audioBytes, cfg.tts.volume)
      setTestResult({ msg: '配音合成成功并已播放！', isError: false })
    } catch (err: any) {
      setTestResult({ msg: `TTS 合成失败: ${err.message || err}`, isError: true })
    } finally {
      setTesting(false)
    }
  }

  const navItems: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'stt', label: '语音转文字', icon: Mic },
    { id: 'translate', label: '翻译模型', icon: Languages },
    { id: 'tts', label: '配音/同传', icon: Headphones },
    { id: 'audio', label: '音频采集', icon: Sliders },
    { id: 'ui', label: '界面外观', icon: Palette }
  ]

  return (
    <div className="flex h-screen w-screen bg-[#1C1C1E] text-white select-none overflow-hidden font-sans">
      {/* 左侧侧边栏导航 */}
      <div className="w-52 bg-[#252528] border-r border-[#3A3A3C] flex flex-col justify-between p-3">
        <div className="space-y-4">
          {/* 标题 */}
          <div className="px-3 py-2 flex items-center space-x-2 border-b border-[#3A3A3C]/60 pb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-apple-blue" />
            <h1 className="text-sm font-semibold tracking-wide text-white/90">设置中心</h1>
          </div>

          {/* 选项卡按钮 */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setTestResult(null)
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-apple-blue text-white shadow-sm'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* 底部保存按钮 */}
        <div className="space-y-2 pt-3 border-t border-[#3A3A3C]/60">
          <button
            onClick={handleSave}
            className={`w-full py-2 px-3 rounded-lg flex items-center justify-center space-x-2 text-xs font-semibold transition-all ${
              isSaved
                ? 'bg-apple-green text-white'
                : 'bg-apple-blue hover:bg-blue-600 text-white shadow-md active:scale-95'
            }`}
          >
            {isSaved ? <Check size={14} /> : null}
            <span>{isSaved ? '已保存设置' : '保存所有设置'}</span>
          </button>
        </div>
      </div>

      {/* 右侧设置表单内容区 */}
      <div className="flex-1 flex flex-col justify-between overflow-y-auto p-6 bg-[#1C1C1E]">
        <div className="space-y-5 max-w-xl">
          {/* TAB 1: 语音转文字 */}
          {activeTab === 'stt' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white/90 border-b border-white/10 pb-2">
                语音识别配置 (STT)
              </h2>

              <div className="space-y-1">
                <label className="text-xs text-white/60">识别后端</label>
                <select
                  value={cfg.stt.backend}
                  onChange={(e) => {
                    const b = e.target.value as 'openai' | 'mimo' | 'whisper'
                    setCfg({
                      ...cfg,
                      stt: {
                        ...cfg.stt,
                        backend: b,
                        base_url:
                          b === 'mimo'
                            ? 'https://api.xiaomimimo.com/v1'
                            : cfg.stt.base_url || 'https://api.openai.com/v1',
                        model:
                          b === 'mimo'
                            ? 'mimo-v2.5-asr'
                            : b === 'whisper'
                              ? 'whisper-1'
                              : 'gpt-4o-audio-preview'
                      }
                    })
                  }}
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                >
                  <option value="openai">OpenAI 兼容 (/chat/completions)</option>
                  <option value="mimo">小米 MiMo (/chat/completions)</option>
                  <option value="whisper">Whisper 专用 (/transcriptions)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">Base URL (截止到 /v1)</label>
                <input
                  type="text"
                  value={cfg.stt.base_url}
                  onChange={(e) =>
                    setCfg({ ...cfg, stt: { ...cfg.stt, base_url: e.target.value } })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">API Key</label>
                <div className="relative">
                  <input
                    type={showSttKey ? 'text' : 'password'}
                    value={cfg.stt.api_key}
                    onChange={(e) =>
                      setCfg({ ...cfg, stt: { ...cfg.stt, api_key: e.target.value } })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 pr-9 text-xs text-white focus:border-apple-blue focus:outline-none"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowSttKey(!showSttKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showSttKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/60">模型名称</label>
                  <input
                    type="text"
                    value={cfg.stt.model}
                    onChange={(e) =>
                      setCfg({ ...cfg, stt: { ...cfg.stt, model: e.target.value } })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/60">源语言 (auto 自动识别)</label>
                  <input
                    type="text"
                    value={cfg.stt.language}
                    onChange={(e) =>
                      setCfg({ ...cfg, stt: { ...cfg.stt, language: e.target.value } })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                    placeholder="auto 或 zh / en / ja"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestSTT}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-lg bg-[#3A3A3C] hover:bg-[#48484A] text-xs font-medium text-white transition-colors"
                >
                  {testing ? '测试中…' : '测试 STT 接口'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 翻译模型 */}
          {activeTab === 'translate' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white/90 border-b border-white/10 pb-2">
                翻译模型配置
              </h2>

              <div className="space-y-1">
                <label className="text-xs text-white/60">翻译后端</label>
                <select
                  value={cfg.translate.backend}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      translate: {
                        ...cfg.translate,
                        backend: e.target.value as 'mymemory' | 'openai'
                      }
                    })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                >
                  <option value="mymemory">MyMemory (开箱即用，免费无需 Key)</option>
                  <option value="openai">OpenAI 兼容 (/chat/completions)</option>
                </select>
              </div>

              {cfg.translate.backend === 'openai' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-white/60">Base URL</label>
                    <input
                      type="text"
                      value={cfg.translate.base_url}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          translate: { ...cfg.translate, base_url: e.target.value }
                        })
                      }
                      className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white/60">API Key</label>
                    <div className="relative">
                      <input
                        type={showTranslateKey ? 'text' : 'password'}
                        value={cfg.translate.api_key}
                        onChange={(e) =>
                          setCfg({
                            ...cfg,
                            translate: { ...cfg.translate, api_key: e.target.value }
                          })
                        }
                        className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 pr-9 text-xs text-white focus:border-apple-blue focus:outline-none"
                        placeholder="sk-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowTranslateKey(!showTranslateKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                      >
                        {showTranslateKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-white/60">模型名称</label>
                    <input
                      type="text"
                      value={cfg.translate.model}
                      onChange={(e) =>
                        setCfg({
                          ...cfg,
                          translate: { ...cfg.translate, model: e.target.value }
                        })
                      }
                      className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/60">源语言</label>
                  <input
                    type="text"
                    value={cfg.translate.source_lang}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        translate: { ...cfg.translate, source_lang: e.target.value }
                      })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/60">目标语言</label>
                  <input
                    type="text"
                    value={cfg.translate.target_lang}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        translate: { ...cfg.translate, target_lang: e.target.value }
                      })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestTranslate}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-lg bg-[#3A3A3C] hover:bg-[#48484A] text-xs font-medium text-white transition-colors"
                >
                  {testing ? '测试中…' : '测试翻译接口'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: 配音 / TTS */}
          {activeTab === 'tts' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white/90 border-b border-white/10 pb-2">
                同声传译 / 配音 (TTS)
              </h2>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.tts.enabled}
                  onChange={(e) =>
                    setCfg({ ...cfg, tts: { ...cfg.tts, enabled: e.target.checked } })
                  }
                  className="rounded text-apple-blue focus:ring-0 w-4 h-4"
                />
                <span className="text-xs font-medium text-white">默认开启同传语音播报</span>
              </label>

              <div className="space-y-1">
                <label className="text-xs text-white/60">配音后端</label>
                <select
                  value={cfg.tts.backend}
                  onChange={(e) => {
                    const b = e.target.value as 'openai' | 'mimo' | 'speech'
                    setCfg({
                      ...cfg,
                      tts: {
                        ...cfg.tts,
                        backend: b,
                        base_url:
                          b === 'mimo'
                            ? 'https://api.xiaomimimo.com/v1'
                            : cfg.tts.base_url || 'https://api.openai.com/v1',
                        model:
                          b === 'mimo'
                            ? 'mimo-v2.5-tts'
                            : b === 'speech'
                              ? 'tts-1'
                              : 'gpt-4o-audio-preview',
                        voice: b === 'mimo' ? 'mimo_default' : 'alloy'
                      }
                    })
                  }}
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                >
                  <option value="openai">OpenAI 兼容 (/chat/completions)</option>
                  <option value="mimo">小米 MiMo (/chat/completions)</option>
                  <option value="speech">OpenAI Speech 专用 (/speech)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">Base URL</label>
                <input
                  type="text"
                  value={cfg.tts.base_url}
                  onChange={(e) =>
                    setCfg({ ...cfg, tts: { ...cfg.tts, base_url: e.target.value } })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">API Key</label>
                <div className="relative">
                  <input
                    type={showTtsKey ? 'text' : 'password'}
                    value={cfg.tts.api_key}
                    onChange={(e) =>
                      setCfg({ ...cfg, tts: { ...cfg.tts, api_key: e.target.value } })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 pr-9 text-xs text-white focus:border-apple-blue focus:outline-none"
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowTtsKey(!showTtsKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showTtsKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/60">音色 ID (Voice)</label>
                  <input
                    type="text"
                    value={cfg.tts.voice}
                    onChange={(e) =>
                      setCfg({ ...cfg, tts: { ...cfg.tts, voice: e.target.value } })
                    }
                    className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-white/60">播放音量 ({Math.round((cfg.tts.volume || 1.0) * 100)}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={cfg.tts.volume}
                    onChange={(e) =>
                      setCfg({ ...cfg, tts: { ...cfg.tts, volume: parseFloat(e.target.value) } })
                    }
                    className="w-full accent-apple-blue"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">
                  配音独立输出设备（与采集声卡分开以杜绝回环）
                </label>
                <select
                  value={cfg.tts.output_device_name}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      tts: { ...cfg.tts, output_device_name: e.target.value }
                    })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                >
                  <option value="">系统默认输出设备</option>
                  {audioOutputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `输出设备 (${d.deviceId.slice(0, 8)})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleTestTTS}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-lg bg-[#3A3A3C] hover:bg-[#48484A] text-xs font-medium text-white transition-colors"
                >
                  {testing ? '合成中…' : '试听配音效果'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: 音频采集 */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white/90 border-b border-white/10 pb-2">
                三端原生音频采集
              </h2>

              <div className="space-y-1">
                <label className="text-xs text-white/60">采集音频源</label>
                <select
                  value={cfg.audio.device_name}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      audio: { ...cfg.audio, device_name: e.target.value }
                    })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                >
                  <option value="">
                    电脑系统声音 (WASAPI / ScreenCaptureKit / PipeWire 原生 Loopback)
                  </option>
                  {audioInputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      麦克风 / 外部设备: {d.label || d.deviceId.slice(0, 10)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-white/40 pt-0.5">
                  • macOS (ScreenCaptureKit) / Windows (WASAPI) / Linux (PipeWire)
                  均已实现原生内录，无需任何第三方虚拟声卡！
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-white/60">
                  <span>语音能量阈值 (VAD RMS): {cfg.audio.energy_threshold}</span>
                  <span className="text-[11px] text-white/40">低于该值自动视为静音并跳过</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1500"
                  step="25"
                  value={cfg.audio.energy_threshold}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      audio: { ...cfg.audio, energy_threshold: parseInt(e.target.value) }
                    })
                  }
                  className="w-full accent-apple-blue"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-white/60">
                  <span>切片硬上限时长 (秒): {cfg.audio.chunk_duration}s</span>
                  <span className="text-[11px] text-white/40">结合智能 VAD 快切，停顿 350ms 自动分发</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.2"
                  value={cfg.audio.chunk_duration}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      audio: { ...cfg.audio, chunk_duration: parseFloat(e.target.value) }
                    })
                  }
                  className="w-full accent-apple-blue"
                />
              </div>
            </div>
          )}

          {/* TAB 5: 界面外观 */}
          {activeTab === 'ui' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-white/90 border-b border-white/10 pb-2">
                悬浮窗视觉与字体
              </h2>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-white/60">
                  <span>窗口不透明度: {Math.round((cfg.ui.opacity || 0.92) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.0"
                  step="0.02"
                  value={cfg.ui.opacity}
                  onChange={(e) =>
                    setCfg({ ...cfg, ui: { ...cfg.ui, opacity: parseFloat(e.target.value) } })
                  }
                  className="w-full accent-apple-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>原文文字大小</span>
                    <span>{cfg.ui.font_size_original}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="28"
                    value={cfg.ui.font_size_original}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        ui: { ...cfg.ui, font_size_original: parseInt(e.target.value) }
                      })
                    }
                    className="w-full accent-apple-blue"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/60">
                    <span>译文文字大小</span>
                    <span>{cfg.ui.font_size_translated}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="36"
                    value={cfg.ui.font_size_translated}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        ui: { ...cfg.ui, font_size_translated: parseInt(e.target.value) }
                      })
                    }
                    className="w-full accent-apple-blue"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">字体家族</label>
                <input
                  type="text"
                  value={cfg.ui.font_family}
                  onChange={(e) =>
                    setCfg({ ...cfg, ui: { ...cfg.ui, font_family: e.target.value } })
                  }
                  className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/60">译文字体颜色</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={cfg.ui.font_color || '#FFFFFF'}
                    onChange={(e) =>
                      setCfg({ ...cfg, ui: { ...cfg.ui, font_color: e.target.value } })
                    }
                    className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cfg.ui.font_color}
                    onChange={(e) =>
                      setCfg({ ...cfg, ui: { ...cfg.ui, font_color: e.target.value } })
                    }
                    className="flex-1 bg-[#2C2C2E] border border-[#3A3A3C] rounded-lg px-3 py-1.5 text-xs text-white focus:border-apple-blue focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部测试结果提示 */}
        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs leading-relaxed border ${
              testResult.isError
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-green-500/10 border-green-500/30 text-green-400'
            }`}
          >
            {testResult.msg}
          </div>
        )}
      </div>
    </div>
  )
}
