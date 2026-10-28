import React, { useEffect, useState, useRef } from 'react'
import {
  Play,
  Square,
  Headphones,
  Trash2,
  Pin,
  PinOff,
  Settings,
  X,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react'
import { TranslateEngine } from '../core/pipeline'
import { AppConfig, EngineStatus, STATE_STYLES } from '../types/config'

interface FloatingViewProps {
  initialConfig: AppConfig
}

export const FloatingView: React.FC<FloatingViewProps> = ({ initialConfig }) => {
  const [config, setConfig] = useState<AppConfig>(initialConfig)
  const [status, setStatus] = useState<EngineStatus>('idle')
  const [level, setLevel] = useState<number>(0)
  const [originalText, setOriginalText] = useState<string>('等待语音输入…')
  const [translatedText, setTranslatedText] = useState<string>('等待翻译结果…')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPinned, setIsPinned] = useState<boolean>(true)
  const [isClickThrough, setIsClickThrough] = useState<boolean>(false)
  const [isInterpretActive, setIsInterpretActive] = useState<boolean>(false)

  const engineRef = useRef<TranslateEngine | null>(null)
  const errTimeoutRef = useRef<any>(null)

  // 初始化引擎
  useEffect(() => {
    const engine = new TranslateEngine(config, {
      onOriginalText: (text) => setOriginalText(text),
      onTranslatedText: (text) => setTranslatedText(text),
      onTranslatedPartial: (partial) => setTranslatedText(partial),
      onStatusChanged: (newStatus) => {
        setStatus(newStatus)
        window.electronAPI.sendState(newStatus)
      },
      onLevelUpdate: (rms) => setLevel(rms),
      onErrorOccurred: (err) => {
        setErrorMessage(err)
        if (errTimeoutRef.current) clearTimeout(errTimeoutRef.current)
        errTimeoutRef.current = setTimeout(() => setErrorMessage(null), 5000)
      }
    })

    engineRef.current = engine

    // 监听托盘快捷操作
    const unListenToggle = window.electronAPI.onToggleListen(() => {
      toggleEngine()
    })
    const unListenClear = window.electronAPI.onClearSubtitles(() => {
      handleClear()
    })
    const unListenConfig = window.electronAPI.onConfigChanged((newCfg) => {
      setConfig(newCfg)
      engine.updateConfig(newCfg)
    })

    return () => {
      engine.stop()
      unListenToggle()
      unListenClear()
      unListenConfig()
    }
  }, [])

  const toggleEngine = () => {
    const engine = engineRef.current
    if (!engine) return

    if (engine.getRunning()) {
      engine.stop()
      setStatus('idle')
      window.electronAPI.sendState('idle')
    } else {
      engine.start()
    }
  }

  const toggleInterpret = () => {
    const engine = engineRef.current
    if (!engine) return
    const nextState = !isInterpretActive
    engine.setInterpret(nextState)
    setIsInterpretActive(engine.getInterpretActive())
  }

  const handleClear = () => {
    setOriginalText('')
    setTranslatedText('')
  }

  const togglePin = async () => {
    const next = !isPinned
    const res = await window.electronAPI.setAlwaysOnTop(next)
    setIsPinned(res)
  }

  const toggleClickThrough = () => {
    const next = !isClickThrough
    setIsClickThrough(next)
    window.electronAPI.setIgnoreMouseEvents(next, { forward: true })
  }

  const openSettings = () => {
    window.electronAPI.openDashboard()
  }

  const closeWindow = () => {
    window.electronAPI.closeFloating()
  }

  const currentStyle = STATE_STYLES[status] || STATE_STYLES.idle

  // 计算音量电平百分比 (0 ~ 1000 范围映射)
  const levelPercent = Math.min(100, Math.max(0, (level / 800) * 100))

  return (
    <div
      className="relative flex flex-col w-screen h-screen select-none overflow-hidden rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl transition-all"
      style={{
        backgroundColor: `rgba(28, 28, 30, ${((config.ui?.bg_alpha ?? 216) / 255) * (config.ui?.opacity ?? 0.92)})`,
        fontFamily: config.ui?.font_family
      }}
    >
      {/* 顶部标题栏（拖拽区域） */}
      <div className="drag-region flex items-center justify-between px-3 py-2 border-b border-white/5 bg-white/[0.02]">
        {/* 左侧状态指示与电平 */}
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center w-2.5 h-2.5">
            <span
              className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping"
              style={{
                backgroundColor: currentStyle.color,
                display: status === 'recording' || status === 'recognizing' ? 'block' : 'none'
              }}
            />
            <span
              className="relative inline-flex w-2 h-2 rounded-full"
              style={{ backgroundColor: currentStyle.color }}
            />
          </div>
          <span className="text-xs font-medium text-white/80">{currentStyle.label}</span>

          {/* 实时音量柱 */}
          <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden ml-1">
            <div
              className="h-full bg-apple-green transition-all duration-75"
              style={{
                width: `${levelPercent}%`,
                backgroundColor: levelPercent > 70 ? '#FF3B30' : levelPercent > 40 ? '#FF9500' : '#34C759'
              }}
            />
          </div>
        </div>

        {/* 右侧操作按钮组 (no-drag) */}
        <div className="no-drag flex items-center space-x-1">
          {/* 开始 / 停止 */}
          <button
            onClick={toggleEngine}
            title={status !== 'idle' ? '停止监听' : '开始监听'}
            className={`p-1.5 rounded-lg transition-colors ${
              status !== 'idle'
                ? 'bg-apple-red/80 hover:bg-apple-red text-white'
                : 'hover:bg-white/10 text-white/80 hover:text-white'
            }`}
          >
            {status !== 'idle' ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
          </button>

          {/* 同声传译配音 */}
          <button
            onClick={toggleInterpret}
            title={isInterpretActive ? '关闭同声传译朗读' : '开启同声传译朗读'}
            className={`p-1.5 rounded-lg transition-colors ${
              isInterpretActive
                ? 'bg-apple-blue hover:bg-blue-600 text-white shadow-sm'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Headphones size={13} />
          </button>

          {/* 清空字幕 */}
          <button
            onClick={handleClear}
            title="清空当前字幕"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <Trash2 size={13} />
          </button>

          {/* 鼠标穿透锁定 */}
          <button
            onClick={toggleClickThrough}
            title={isClickThrough ? '解除穿透' : '鼠标穿透模式'}
            className={`p-1.5 rounded-lg transition-colors ${
              isClickThrough
                ? 'bg-apple-orange/80 text-white'
                : 'hover:bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            {isClickThrough ? <Lock size={13} /> : <Unlock size={13} />}
          </button>

          {/* 置顶 */}
          <button
            onClick={togglePin}
            title={isPinned ? '取消置顶' : '始终置顶'}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinned ? 'text-apple-blue hover:bg-white/10' : 'hover:bg-white/10 text-white/40'
            }`}
          >
            {isPinned ? <Pin size={13} /> : <PinOff size={13} />}
          </button>

          {/* 设置 */}
          <button
            onClick={openSettings}
            title="设置面板"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <Settings size={13} />
          </button>

          {/* 关闭/最小化到托盘 */}
          <button
            onClick={closeWindow}
            title="隐藏到托盘"
            className="p-1.5 rounded-lg hover:bg-apple-red/80 text-white/60 hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* 错误提示浮层 */}
      {errorMessage && (
        <div className="absolute top-11 left-3 right-3 z-30 flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs shadow-lg backdrop-blur animate-fade-in">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* 字幕正文显示区域 */}
      <div className="drag-region flex-1 flex flex-col justify-center px-4 py-3 overflow-hidden space-y-2">
        {/* 原文 */}
        <div
          className="text-white/60 leading-snug line-clamp-2 select-text font-normal"
          style={{
            fontSize: `${config.ui?.font_size_original || 16}px`,
            color: 'rgba(255, 255, 255, 0.65)'
          }}
        >
          {originalText}
        </div>

        {/* 译文 */}
        <div
          className="font-medium leading-snug line-clamp-3 select-text tracking-wide drop-shadow-sm"
          style={{
            fontSize: `${config.ui?.font_size_translated || 18}px`,
            color: config.ui?.font_color || '#FFFFFF'
          }}
        >
          {translatedText}
        </div>
      </div>
    </div>
  )
}
