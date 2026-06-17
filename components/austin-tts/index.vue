<template>
  <scroll-view class="page" scroll-y>
    <view class="hero">
      <text class="eyebrow">Austin TTS</text>
      <text class="title">文字转语音</text>
      <text class="desc">
        先用原生模式试播一段文字，确认没问题后，再按需接你自己的 TTS 接口。
      </text>
    </view>

    <view class="card">
      <text class="card-title">先输一句话</text>
      <textarea
        :value="speakTextValue"
        class="textarea"
        auto-height
        maxlength="-1"
        placeholder="请输入要播报的文字"
        @input="handleSpeakTextInput"
      />
      <text class="tip-text">建议先用短句试一下，能播再去调音色和接口。</text>
    </view>

    <view class="card">
      <text class="card-title">模式</text>
      <view class="segment-row">
        <view
          v-for="item in modeOptions"
          :key="item.value"
          class="segment-btn"
          :class="[playMode === item.value ? 'segment-btn-active' : '']"
          @tap="handleModeTap(item.value)"
        >
          <text :class="[playMode === item.value ? 'segment-text-active' : 'segment-text']">
            {{ item.label }}
          </text>
        </view>
      </view>
      <text class="tip-text">{{ currentModeDesc }}</text>
    </view>

    <view class="card">
      <text class="card-title">声音设置</text>
      <view class="field">
        <text class="field-label">语言</text>
        <input :value="language" class="input" placeholder="如 zh-CN / en-US" @input="handleLanguageInput" />
        <text class="tip-text">语言能不能用，取决于当前手机系统有没有对应语音包。</text>
      </view>
      <view class="field">
        <text class="field-label">voice</text>
        <input
          :value="voice"
          class="input"
          placeholder="可留空，或填音色 id"
          @input="handleVoiceInput"
        />
        <text class="tip-text">不填就走默认音色。想切男女声或指定接口音色时再填。</text>
      </view>
      <view class="field">
        <text class="field-label">语速</text>
        <slider :value="ratePercent" :min="10" :max="200" :step="5" show-value @change="handleRateChange" />
        <text class="tip-text">当前语速：{{ rate.toFixed(2) }}</text>
      </view>
      <view class="field">
        <text class="field-label">音调</text>
        <slider :value="pitchPercent" :min="50" :max="200" :step="5" show-value @change="handlePitchChange" />
        <text class="tip-text">当前音调：{{ pitch.toFixed(2) }}</text>
      </view>
      <view class="field">
        <text class="field-label">音量</text>
        <slider :value="volumePercent" :min="0" :max="100" :step="5" show-value @change="handleVolumeChange" />
        <text class="tip-text">当前音量：{{ volume.toFixed(2) }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">操作</text>
      <view class="action-grid">
        <view class="action-btn" @tap="runSpeak">
          <text class="action-btn-text">播放</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="runPause">
          <text class="action-btn-text action-btn-text-secondary">暂停</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="runResume">
          <text class="action-btn-text action-btn-text-secondary">继续</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="runStop">
          <text class="action-btn-text action-btn-text-secondary">停止</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="refreshState">
          <text class="action-btn-text action-btn-text-secondary">刷新状态</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="loadNativeVoices">
          <text class="action-btn-text action-btn-text-secondary">查询原生音色</text>
        </view>
      </view>
    </view>

    <!-- 这个区域主要给联调第三方接口用，业务自己接入时不一定要保留整块 UI。 -->
    <view class="card">
      <text class="card-title">接口配置</text>
      <textarea
        :value="providerConfigText"
        class="textarea config-textarea"
        auto-height
        maxlength="-1"
        placeholder="这里填你自己的 TTS 接口 JSON"
        @input="handleProviderConfigInput"
      />
      <view class="action-grid">
        <view class="action-btn" @tap="applyProviderConfig">
          <text class="action-btn-text">应用配置</text>
        </view>
        <view class="action-btn action-btn-secondary" @tap="clearProviderConfig">
          <text class="action-btn-text action-btn-text-secondary">清空配置</text>
        </view>
      </view>
      <text class="tip-text">
        正式项目里建议走你自己的服务端代理，不要把生产密钥直接写在客户端。
      </text>
    </view>

    <view class="card">
      <text class="card-title">当前状态</text>
      <text class="meta">平台：{{ pluginState.platform || 'unknown' }}</text>
      <text class="meta">是否支持：{{ pluginState.supported ? '支持' : '不支持' }}</text>
      <text class="meta">当前模式：{{ pluginState.mode || 'idle' }}</text>
      <text class="meta">是否播放中：{{ pluginState.speaking ? '是' : '否' }}</text>
      <text class="meta">是否暂停：{{ pluginState.paused ? '是' : '否' }}</text>
      <text class="meta">Provider：{{ pluginState.providerConfigured ? pluginState.providerName : '未配置' }}</text>
      <text class="meta">队列长度：{{ pluginState.queueLength }}</text>
      <text class="meta">当前文本：{{ pluginState.currentText || '无' }}</text>
      <text class="meta">最近错误：{{ pluginState.lastError || '无' }}</text>
    </view>

    <view class="card">
      <text class="card-title">返回结果</text>
      <text class="code-block">{{ lastResultText }}</text>
    </view>

    <view class="card">
      <text class="card-title">可用音色</text>
      <text class="meta">当前共 {{ voices.length }} 个。</text>
      <text v-for="item in voices" :key="item.id" class="voice-item">
        {{ item.name || item.id }} | {{ item.language }}
      </text>
    </view>

    <view class="card">
      <text class="card-title">调试日志</text>
      <text v-for="(item, index) in eventLogs" :key="'log-' + index" class="log-item">
        {{ item }}
      </text>
    </view>

    <view class="card">
      <text class="card-title">最小调用</text>
      <text class="code-block">{{ usageText }}</text>
    </view>
  </scroll-view>
</template>

<script>
import {
  addTtsListener,
  clearTtsProvider,
  getTtsState,
  getTtsVoices,
  pause,
  removeTtsListener,
  resume,
  setTtsProvider,
  speak,
  stop,
} from '@/uni_modules/austin-tts'

const DEFAULT_PROVIDER_TEXT = JSON.stringify(
  {
    name: 'Custom HTTP TTS',
    endpoint: 'https://example.com/tts',
    method: 'POST',
    headers: {
      Authorization: 'Bearer YOUR_TOKEN',
    },
    request: {
      contentType: 'application/json',
      textField: 'input',
      voiceField: 'voice',
      languageField: 'language',
      formatField: 'format',
      extra: {
        model: 'your-model',
        format: 'mp3',
      },
    },
    response: {
      type: 'json-url',
      urlField: 'data.url',
      mimeField: 'data.mime',
    },
    voices: [
      {
        id: 'female_01',
        name: 'Female 01',
        language: 'zh-CN',
      },
    ],
  },
  null,
  2
)

const USAGE_TEXT = [
  "import { speak, setTtsProvider } from '@/uni_modules/austin-tts'",
  '',
  'setTtsProvider({',
  "  endpoint: 'https://example.com/tts',",
  "  request: { contentType: 'application/json', textField: 'input' },",
  "  response: { type: 'json-url', urlField: 'data.url' },",
  '})',
  '',
  "await speak('请保持正脸', {",
  "  mode: 'auto',",
  "  language: 'zh-CN',",
  '  rate: 1,',
  '  pitch: 1,',
  '  volume: 1,',
  '})',
].join('\n')

export default {
  data() {
    return {
      modeOptions: [
        { value: 'auto', label: 'Auto', desc: '有接口就先走接口，失败再回退系统播报。' },
        { value: 'native', label: 'Native', desc: '直接走手机系统自带的文字转语音。' },
        { value: 'provider', label: 'Provider', desc: '直接走你配置的第三方接口。' },
      ],
      playMode: 'auto',
      speakTextValue: '请保持正脸，按照页面提示完成录制。',
      language: 'zh-CN',
      voice: '',
      rate: 1,
      pitch: 1,
      volume: 1,
      pluginState: {
        supported: false,
        initialized: false,
        mode: '',
        speaking: false,
        paused: false,
        currentText: '',
        currentUtteranceId: '',
        providerConfigured: false,
        providerName: '',
        queueLength: 0,
        lastSource: '',
        lastError: '',
        lastErrorCode: 0,
        lastMode: '',
        platform: '',
      },
      providerConfigText: DEFAULT_PROVIDER_TEXT,
      lastResultText: '{}',
      usageText: USAGE_TEXT,
      eventLogs: ['等待操作'],
      voices: [],
      ttsListener: null,
      speakCallCount: 0,
      activeSpeakTrace: null,
    }
  },
  computed: {
    currentModeDesc() {
      const current = this.modeOptions.find((item) => item.value === this.playMode)
      return current ? current.desc : ''
    },
    ratePercent() {
      return Math.round(this.rate * 100)
    },
    pitchPercent() {
      return Math.round(this.pitch * 100)
    },
    volumePercent() {
      return Math.round(this.volume * 100)
    },
  },
  mounted() {
    // 这里是组件，不是页面；要用组件生命周期挂监听，不然 onLoad 不会执行。
    this.ttsListener = (event) => {
      this.pushEventLog(event)
      this.refreshState()
    }
    addTtsListener(this.ttsListener)
    this.refreshState()
  },
  beforeUnmount() {
    this.removeTtsEventListener()
  },
  beforeDestroy() {
    this.removeTtsEventListener()
  },
  methods: {
    removeTtsEventListener() {
      if (this.ttsListener) {
        removeTtsListener(this.ttsListener)
        this.ttsListener = null
      }
    },
    // uni-app 的 input / textarea 事件值都从 e.detail.value 里取，统一包一层更省事。
    readInputValue(e) {
      if (e && e.detail && e.detail.value !== undefined && e.detail.value !== null) {
        return '' + e.detail.value
      }
      return ''
    },
    handleSpeakTextInput(e) {
      try {
        this.speakTextValue = this.readInputValue(e)
      } catch (error) {
        console.error('[austin-tts][handleSpeakTextInput]', error)
      }
    },
    handleLanguageInput(e) {
      try {
        this.language = this.readInputValue(e)
      } catch (error) {
        console.error('[austin-tts][handleLanguageInput]', error)
      }
    },
    handleVoiceInput(e) {
      try {
        this.voice = this.readInputValue(e)
      } catch (error) {
        console.error('[austin-tts][handleVoiceInput]', error)
      }
    },
    handleProviderConfigInput(e) {
      try {
        this.providerConfigText = this.readInputValue(e)
      } catch (error) {
        console.error('[austin-tts][handleProviderConfigInput]', error)
      }
    },
    handleModeTap(value) {
      try {
        this.playMode = value
      } catch (error) {
        console.error('[austin-tts][handleModeTap]', error)
      }
    },
    pushEventLog(event) {
      const shouldKeep =
        event.type === 'complete' || event.type === 'error' || event.type === 'stop' || event.type === 'pause'
      if (!shouldKeep) {
        return
      }
      const eventLabelMap = {
        complete: 'complete 完成回调',
        error: 'error 失败回调',
        stop: 'stop 停止回调',
        pause: 'pause 暂停回调',
      }
      const trace = this.activeSpeakTrace
      const traceText =
        trace && trace.startedAt
          ? ' | trace=' + trace.traceId + ' | +' + (Number(event.time || Date.now()) - trace.startedAt) + 'ms'
          : ''
      const line =
        this.formatClock(event.time || Date.now()) +
        ' | ' +
        (eventLabelMap[event.type] || event.type || 'event') +
        ' | mode=' +
        (event.mode || '-') +
        (event.utteranceId ? ' | utteranceId=' + event.utteranceId : '') +
        (event.errMsg ? ' | ' + event.errMsg : '') +
        (event.reason ? ' | ' + event.reason : '') +
        traceText
      const nextLogs = [line].concat(this.eventLogs)
      this.eventLogs = nextLogs.slice(0, 12)
      try {
        console.log('[austin-tts][callback] ' + line)
      } catch (e) {}
      if (event.type === 'complete' || event.type === 'error' || event.type === 'stop') {
        this.activeSpeakTrace = null
      }
    },
    pushPlainLog(text) {
      const line = this.formatClock(Date.now()) + ' | ' + text
      const nextLogs = [line].concat(this.eventLogs)
      this.eventLogs = nextLogs.slice(0, 12)
      try {
        console.log('[austin-tts][callback] ' + line)
      } catch (e) {}
    },
    formatClock(time) {
      const date = new Date(Number(time || Date.now()))
      const pad = (value) => {
        return String(value).padStart(2, '0')
      }
      const ms = String(date.getMilliseconds()).padStart(3, '0')
      return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) + '.' + ms
    },
    handleRateChange(e) {
      try {
        this.rate = Number((Number(e.detail.value || 100) / 100).toFixed(2))
      } catch (error) {
        console.error('[austin-tts][handleRateChange]', error)
      }
    },
    handlePitchChange(e) {
      try {
        this.pitch = Number((Number(e.detail.value || 100) / 100).toFixed(2))
      } catch (error) {
        console.error('[austin-tts][handlePitchChange]', error)
      }
    },
    handleVolumeChange(e) {
      try {
        this.volume = Number((Number(e.detail.value || 100) / 100).toFixed(2))
      } catch (error) {
        console.error('[austin-tts][handleVolumeChange]', error)
      }
    },
    refreshState() {
      try {
        this.pluginState = {
          ...getTtsState(),
        }
      } catch (e) {
        console.error('[austin-tts][refreshState]', e)
        this.lastResultText = JSON.stringify(
          {
            ok: false,
            action: 'refreshState',
            errMsg: '' + e,
          },
          null,
          2
        )
      }
    },
    runSpeak() {
      try {
        this.speakCallCount += 1
        const traceId = 'speak-' + this.speakCallCount
        const startedAt = Date.now()
        this.activeSpeakTrace = {
          traceId,
          startedAt,
        }

        // 模板页这里只传最常用的几个字段，够业务先把播报跑通。
        speak(this.speakTextValue, {
          mode: this.playMode,
          language: this.language,
          voice: this.voice,
          rate: this.rate,
          pitch: this.pitch,
          volume: this.volume,
        })
          .then((result) => {
            const cost = Date.now() - startedAt
            this.pushPlainLog(traceId + ' then 成功回调，+' + cost + 'ms')
            this.lastResultText = JSON.stringify(
              {
                ...result,
                traceId,
                callbackType: 'then',
                elapsedMs: cost,
              },
              null,
              2
            )
            this.refreshState()
          })
          .catch((e) => {
            console.error('[austin-tts][runSpeak]', e)
            const cost = Date.now() - startedAt
            this.pushPlainLog(traceId + ' catch 失败回调，+' + cost + 'ms')
            this.lastResultText = JSON.stringify(
              {
                ok: false,
                action: 'speak',
                traceId,
                callbackType: 'catch',
                elapsedMs: cost,
                errMsg: '' + e,
              },
              null,
              2
            )
          })
      } catch (e) {
        console.error('[austin-tts][runSpeak]', e)
        this.lastResultText = JSON.stringify(
          {
            ok: false,
            action: 'speak',
            errMsg: '' + e,
          },
          null,
          2
        )
      }
    },
    runPause() {
      try {
        const ok = pause()
        this.lastResultText = JSON.stringify({ ok, action: 'pause' }, null, 2)
        this.refreshState()
      } catch (e) {
        console.error('[austin-tts][runPause]', e)
        this.lastResultText = JSON.stringify({ ok: false, action: 'pause', errMsg: '' + e }, null, 2)
      }
    },
    runResume() {
      try {
        const ok = resume()
        this.lastResultText = JSON.stringify({ ok, action: 'resume' }, null, 2)
        this.refreshState()
      } catch (e) {
        console.error('[austin-tts][runResume]', e)
        this.lastResultText = JSON.stringify({ ok: false, action: 'resume', errMsg: '' + e }, null, 2)
      }
    },
    runStop() {
      try {
        const ok = stop()
        this.lastResultText = JSON.stringify({ ok, action: 'stop' }, null, 2)
        this.refreshState()
      } catch (e) {
        console.error('[austin-tts][runStop]', e)
        this.lastResultText = JSON.stringify({ ok: false, action: 'stop', errMsg: '' + e }, null, 2)
      }
    },
    async loadNativeVoices() {
      try {
        const voices = await getTtsVoices('native')
        this.voices = voices
        this.lastResultText = JSON.stringify({ ok: true, count: voices.length }, null, 2)
      } catch (e) {
        this.lastResultText = JSON.stringify(
          {
            ok: false,
            errMsg: '' + e,
          },
          null,
          2
        )
      }
    },
    applyProviderConfig() {
      try {
        // 这里故意保留 JSON 文本输入，方便直接粘一份接口配置联调。
        const config = JSON.parse(this.providerConfigText)
        const ret = setTtsProvider(config)
        this.lastResultText = JSON.stringify(ret, null, 2)
        this.refreshState()
      } catch (e) {
        console.error('[austin-tts][applyProviderConfig]', e)
        this.lastResultText = JSON.stringify(
          {
            ok: false,
            errMsg: 'JSON 解析失败：' + e,
          },
          null,
          2
        )
      }
    },
    clearProviderConfig() {
      try {
        clearTtsProvider()
        this.lastResultText = JSON.stringify({ ok: true, action: 'clearProvider' }, null, 2)
        this.refreshState()
      } catch (e) {
        console.error('[austin-tts][clearProviderConfig]', e)
        this.lastResultText = JSON.stringify({ ok: false, action: 'clearProvider', errMsg: '' + e }, null, 2)
      }
    },
  },
}
</script>

<style>
.page {
  min-height: 100vh;
  padding: 40rpx 24rpx 80rpx;
  background: linear-gradient(180deg, #f5f8ff 0%, #f8fafc 45%, #ffffff 100%);
  box-sizing: border-box;
}

.hero {
  padding: 8rpx 6rpx 34rpx;
}

.eyebrow {
  display: block;
  font-size: 22rpx;
  letter-spacing: 4rpx;
  text-transform: uppercase;
  color: #64748b;
}

.title {
  display: block;
  margin-top: 14rpx;
  font-size: 52rpx;
  font-weight: 700;
  color: #0f172a;
}

.desc {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.7;
  color: #475569;
}

.card {
  margin-top: 20rpx;
  padding: 30rpx 26rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(15, 23, 42, 0.08);
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.textarea {
  width: 100%;
  min-height: 180rpx;
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: #f8fafc;
  font-size: 28rpx;
  line-height: 1.6;
  color: #0f172a;
  box-sizing: border-box;
}

.config-textarea {
  min-height: 320rpx;
  font-family: monospace;
}

.tip-text,
.meta,
.voice-item,
.log-item {
  display: block;
  margin-top: 14rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: #475569;
}

.field {
  margin-top: 18rpx;
}

.field-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.input {
  width: 100%;
  height: 86rpx;
  margin-top: 12rpx;
  padding: 0 22rpx;
  border-radius: 20rpx;
  background: #f8fafc;
  font-size: 28rpx;
  color: #0f172a;
  box-sizing: border-box;
}

.segment-row {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}

.segment-btn {
  flex: 1;
  padding: 20rpx 0;
  border-radius: 20rpx;
  background: #e2e8f0;
}

.segment-btn-active {
  background: #0f172a;
}

.segment-text,
.segment-text-active {
  display: block;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
}

.segment-text {
  color: #0f172a;
}

.segment-text-active {
  color: #f8fafc;
}

.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.action-btn {
  min-width: 200rpx;
  padding: 22rpx 26rpx;
  border-radius: 22rpx;
  background: #0f172a;
}

.action-btn-secondary {
  background: #e2e8f0;
}

.action-btn-text,
.action-btn-text-secondary {
  display: block;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
}

.action-btn-text {
  color: #f8fafc;
}

.action-btn-text-secondary {
  color: #0f172a;
}

.code-block {
  display: block;
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: #0f172a;
  font-family: monospace;
  font-size: 24rpx;
  line-height: 1.7;
  color: #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
