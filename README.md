# ConeLiveTranslate · 跨平台实时语音翻译悬浮窗
### Cross-Platform Real-Time Live Speech Translation Floating Window

<p align="center">
  <img src="icon.png" width="96" height="96" alt="ConeLiveTranslate Logo" />
</p>

<p align="center">
  <b>基于 Electron + React + TypeScript 打造的极速双语实时翻译桌面悬浮窗</b><br>
  <b>A blazing-fast desktop floating subtitle translator built with Electron, React, and TypeScript</b>
</p>

<p align="center">
  <a href="#中文说明">简体中文</a> • <a href="#english-documentation">English</a>
</p>

---

<h2 id="中文说明">🇨🇳 中文说明</h2>

### 🌟 核心特性

1. **三端原生音频采集（解决 macOS 痛点）**
   - **macOS (13+)**：依托现代 Chromium 内置 **ScreenCaptureKit** 接口，**无需安装 BlackHole 虚拟声卡或配置聚合音频设备**，开箱即可直接内录电脑扬声器声音！
   - **Windows (10/11)**：基于 **WASAPI Loopback** 原生内录电脑播放的一切声音。
   - **Linux**：原生支持 **PipeWire / PulseAudio Monitor** 桌面音频源。
   - **麦克风/独立设备**：支持自由选择任意外部麦克风或专业外置声卡。

2. **超低延迟与智能同步（综合延迟缩减 75%）**
   - **350ms 智能停顿快切**：智能检测自然语意停顿（350ms 静音），说完立即下刀切片并分发，消除了死等固定切片时长的无效等待。
   - **前导环形缓冲 (Pre-roll Buffer)**：保留语音激活前 150~250ms 的音频帧，杜绝吞字首辅音，提升识别率。
   - **双阶段解耦流水线**：STT 识别完成后，**原文约 300~500ms 立即按序呈现在悬浮窗上方**，无需苦等后续翻译与 TTS；译文紧随其后呈现，各阶段严格保序。
   - **流式翻译打字效果 (SSE)**：OpenAI 兼容翻译接口接入 Server-Sent Events，译文实时逐词涌现。

3. **高颜值透明字幕悬浮窗**
   - **毛玻璃拟态**：半透明优雅深色圆角设计，支持在任意屏幕位置自由拖拽与边缘缩放。
   - **鼠标穿透模式**：一键开启点击穿透，完全不阻碍看视频、玩游戏或开会时的鼠标点击。
   - **状态指示与实时电平**：内置音量电平条（RMS Visualizer）与呼吸状态灯（已停止 / 监听中 / 录音中 / 识别中 / 翻译中 / 错误）。
   - **双语对照排版**：上方优雅暗白原文，下方高亮白译文，字号与字体均可自由定义。

4. **多模型后端开箱即用**
   - **语音转文字 (STT)**：
     - OpenAI 标准兼容接口（如 `whisper-1`，端点为 `/transcriptions`）
     - 小米 MiMo 接口（`mimo-v2.5-asr`，多模态 `input_audio` 内嵌）
   - **文本翻译**：
     - **MyMemory**：**完全免费、无需 API Key、国内开箱即用**
     - OpenAI 标准兼容接口（如 `gpt-4o-mini`、`deepseek-chat` 等标准 `/chat/completions`）
   - **同声传译 / 配音 (TTS)**：
     - 小米 MiMo TTS (`mimo-v2.5-tts`)
     - OpenAI 标准兼容 TTS (`/speech`)
     - **独立播放设备路由**：支持将配音路由至耳机，与系统采集设备分开，杜绝内录回环啸叫。

---

### 🚀 快速上手

#### 1. 安装与开发

```bash
# 克隆代码
git clone https://github.com/songguomix/ConeLiveTranslate.git
cd ConeLiveTranslate

# 安装依赖
npm install

# 启动本地开发模式 (热重载)
npm run dev
```

#### 2. 构建与三端打包

```bash
# 生产编译
npm run build

# 打包 macOS 原生安装包 (.dmg / .zip)
npm run build:mac

# 打包 Windows 原生安装包 (.exe / 便携版)
npm run build:win

# 打包 Linux 原生安装包 (.AppImage / .deb)
npm run build:linux
```

---

### ⚙️ 模型配置说明

点击悬浮窗右上角 **⚙** 按钮或托盘菜单选择 **打开设置 (Dashboard)**：

| 模块 | 推荐配置 | 端点尾缀规范 (去 /audio) | 说明 |
| :--- | :--- | :--- | :--- |
| **STT** | `whisper-1` 或 `mimo-v2.5-asr` | `${base_url}/transcriptions` | 填写 Base URL（如 `https://api.openai.com/v1`）与 Key |
| **翻译** | `MyMemory` (免费) 或 `gpt-4o-mini` | `${base_url}/chat/completions` | MyMemory 免 Key 开箱即用；也支持各类 OpenAI 兼容模型 |
| **TTS** | `mimo-v2.5-tts` 或 `alloy` | `${base_url}/speech` | 可选朗读，建议在音频设置中将输出设备设为耳机 |

---

<h2 id="english-documentation">🇬🇧 English Documentation</h2>

### 🌟 Features

1. **Native Three-Platform Audio Capture (No Virtual Driver Needed)**
   - **macOS (13+)**: Powered by modern Chromium's **ScreenCaptureKit**, directly records system output audio **without requiring BlackHole or Multi-Output devices**.
   - **Windows (10/11)**: Native **WASAPI Loopback** system speaker audio recording.
   - **Linux**: Native **PipeWire / PulseAudio Monitor** desktop audio capture.
   - **Microphone / External Device**: Freely switch to any input microphone or USB audio interface.

2. **Ultra-Low Latency & High Synchronization (75% Latency Reduction)**
   - **350ms VAD Silence Pause Cut**: Flushes the audio chunk immediately after 350ms of natural silence instead of waiting for full chunk intervals.
   - **Pre-Roll Audio Buffer (150-250ms)**: Preserves initial consonants and syllables to eliminate speech clipping and transcription errors.
   - **Dual-Stage Decoupled Pipeline**: Emits recognized original text immediately (~300-500ms) without waiting for translation or TTS. Translated subtitles stream right after, guaranteed in strict sequence order.
   - **SSE Streaming Translation**: Real-time word-by-word typing animation for OpenAI-compatible translation backends.

3. **Elegant Frosted Glass Subtitle Window**
   - **Frameless Vibrancy**: Rounded translucent dark theme with freely draggable and resizable borders.
   - **Click-Through Mode**: Pass mouse clicks directly through the window to interact with games, meetings, or video players underneath.
   - **Live Volume & State Indicators**: Dynamic RMS level bar and pulsating status badges.
   - **Bilingual Subtitles**: Original text on top, translated text below, with fully customizable font families, sizes, and colors.

4. **Multi-Backend Support**
   - **Speech-to-Text (STT)**:
     - OpenAI compatible (`whisper-1` via `/transcriptions`)
     - Xiaomi MiMo (`mimo-v2.5-asr` via `/chat/completions`)
   - **Translation**:
     - **MyMemory**: 100% free, out-of-the-box, no API key required.
     - OpenAI compatible (`gpt-4o-mini`, `deepseek`, etc. via `/chat/completions`)
   - **Dubbing (TTS, Optional)**:
     - Xiaomi MiMo TTS (`mimo-v2.5-tts`)
     - OpenAI compatible TTS (`/speech`)
     - Independent audio device routing to avoid acoustic loopback.

---

### 🚀 Getting Started

#### 1. Installation & Development

```bash
# Clone the repository
git clone https://github.com/songguomix/ConeLiveTranslate.git
cd ConeLiveTranslate

# Install dependencies
npm install

# Start development mode with hot-reloading
npm run dev
```

#### 2. Building & Packaging

```bash
# Compile project
npm run build

# Package macOS (.dmg / .zip)
npm run build:mac

# Package Windows (.exe / portable)
npm run build:win

# Package Linux (.AppImage / .deb)
npm run build:linux
```

---

### 📂 Project Structure

```
ConeLiveTranslate/
├── electron.vite.config.ts        # Vite + Electron build configuration
├── electron-builder.yml           # Cross-platform packaging config
├── package.json                   # Project scripts and dependencies
├── .github/workflows/build.yml    # CI/CD automated multi-platform release
├── src/
│   ├── main/                      # Electron Main process
│   │   ├── index.ts               # Single-instance lock, IPC, app lifecycle
│   │   ├── windows.ts             # Floating subtitle & settings windows
│   │   ├── tray.ts                # Cross-platform system tray integration
│   │   └── config.ts              # Config store & legacy data auto-migration
│   ├── preload/                   # Preload context bridge
│   │   ├── index.ts
│   │   └── index.d.ts
│   └── renderer/                  # React 18 + Tailwind frontend
│       ├── index.html
│       └── src/
│           ├── core/              # Core translation pipeline
│           │   ├── audio/         # Audio capture (ScreenCaptureKit/WASAPI), WAV encoder, player
│           │   ├── stt/           # STT clients (Whisper / MiMo)
│           │   ├── translate/     # Translators (MyMemory / OpenAI)
│           │   ├── tts/           # TTS clients (MiMo / OpenAI)
│           │   └── pipeline.ts    # Dual-stage decoupled queue engine
│           ├── views/
│           │   ├── FloatingView.tsx   # Floating subtitle window
│           │   └── DashboardView.tsx  # Native-bar settings center
│           └── App.tsx
└── assets/                        # App icons and resources
```

---

### 📄 License

Distributed under the [MIT](LICENSE) License.
