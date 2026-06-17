const DEFAULT_PROVIDER_TIMEOUT_MS = 15000
const DEFAULT_PROVIDER_FORMAT = 'mp3'
const DEFAULT_PROVIDER_TYPE = 'json-url'
const PROVIDER_KIND_HTTP_AUDIO = 'http-audio'
const DEFAULT_PLAYBACK_VOLUME = 1
const DEFAULT_NATIVE_RATE = 1
const DEFAULT_NATIVE_PITCH = 1
const DEFAULT_LANGUAGE = 'zh-CN'
const DEFAULT_MODE = 'auto'
const DEFAULT_QUEUE_MODE = 'flush'
const PROVIDER_CACHE_DIR = '_doc/austin_tts_cache'

const state = {
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
}

const listeners = []

const runtime = {
  player: null,
  provider: null,
  providerQueue: [],
  providerBusy: false,
  activeProviderTask: null,
  memoryCache: {},
  android: {
    tts: null,
    initPromise: null,
    onInitListener: null,
    progressListener: null,
    legacyCompleteListener: null,
    ready: false,
  },
  ios: {
    synthesizer: null,
    stateTimer: 0,
  },
}

function now() {
  return Date.now()
}

function formatDebugValue(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return '' + value
  try {
    return JSON.stringify(value)
  } catch (e) {
    try {
      return String(value)
    } catch (innerError) {
      return '[unserializable]'
    }
  }
}

function debugLog() {
  return undefined
}

function debugWarn() {
  return undefined
}

function debugError() {
  return undefined
}

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (e) {
    return value
  }
}

function safeObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function normalizeString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback
  }
  return '' + value
}

function clamp(value, min, max, fallback) {
  const num = Number(value)
  if (Number.isNaN(num)) {
    return fallback
  }
  if (num < min) return min
  if (num > max) return max
  return num
}

function hashText(text) {
  let hash = 0
  const source = normalizeString(text, '')
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i)
    hash |= 0
  }
  return 'tts_' + Math.abs(hash)
}

function createUtteranceId() {
  return 'utt_' + now() + '_' + Math.floor(Math.random() * 1000000)
}

function normalizeMode(mode) {
  const nextMode = normalizeString(mode, DEFAULT_MODE)
  if (nextMode === 'native' || nextMode === 'provider' || nextMode === 'auto') {
    return nextMode
  }
  return DEFAULT_MODE
}

function normalizeQueueMode(mode) {
  return normalizeString(mode, DEFAULT_QUEUE_MODE) === 'append' ? 'append' : 'flush'
}

function normalizeLanguageTag(language) {
  const tag = normalizeString(language, DEFAULT_LANGUAGE).replace('_', '-').trim()
  return tag || DEFAULT_LANGUAGE
}

function getPlatform() {
  try {
    if (typeof plus !== 'undefined' && plus.os && plus.os.name) {
      const name = normalizeString(plus.os.name, '').toLowerCase()
      if (name === 'android') return 'android'
      if (name === 'ios') return 'ios'
    }
  } catch (e) {}
  return ''
}

function isAppPlusReady() {
  try {
    return typeof plus !== 'undefined'
  } catch (e) {
    return false
  }
}

function markUnsupported(errMsg) {
  state.supported = false
  state.initialized = true
  state.lastError = normalizeString(errMsg, '当前环境不支持 TTS')
  state.lastErrorCode = -1
}

function buildResult(ok, extra = {}) {
  return {
    ok: !!ok,
    errCode: ok ? 0 : Number(extra.errCode || -1),
    errMsg: normalizeString(extra.errMsg, ok ? '' : '操作失败'),
    mode: normalizeString(extra.mode, ''),
    utteranceId: normalizeString(extra.utteranceId, ''),
    filePath: normalizeString(extra.filePath, ''),
    source: normalizeString(extra.source, ''),
    usingCache: !!extra.usingCache,
  }
}

function updateState(patch = {}) {
  Object.keys(patch).forEach((key) => {
    state[key] = patch[key]
  })
}

function emit(type, payload = {}) {
  const event = {
    type,
    time: now(),
    state: getTtsState(),
    ...clonePlain(payload),
  }
  debugLog(
    '[emit]',
    JSON.stringify({
      type,
      utteranceId: event.utteranceId || '',
      listeners: listeners.length,
      mode: event.mode || '',
      errMsg: event.errMsg || '',
    })
  )
  listeners.slice().forEach((handler) => {
    try {
      handler(event)
    } catch (e) {
      debugError('[emit] listener handler failed:', e)
    }
  })
}

function setLastError(errCode, errMsg) {
  updateState({
    lastErrorCode: Number(errCode || -1),
    lastError: normalizeString(errMsg, '未知错误'),
  })
}

function clearLastError() {
  updateState({
    lastErrorCode: 0,
    lastError: '',
  })
}

function ensureSupported() {
  if (isAppPlusReady()) {
    updateState({
      supported: true,
      initialized: true,
    })
    return true
  }
  markUnsupported('当前环境仅支持 App 端真机或自定义基座')
  return false
}

function getTtsState() {
  if (!state.initialized) {
    ensureSupported()
  }
  return {
    supported: !!state.supported,
    initialized: !!state.initialized,
    mode: normalizeString(state.mode, ''),
    speaking: !!state.speaking,
    paused: !!state.paused,
    currentText: normalizeString(state.currentText, ''),
    currentUtteranceId: normalizeString(state.currentUtteranceId, ''),
    providerConfigured: !!state.providerConfigured,
    providerName: normalizeString(state.providerName, ''),
    queueLength: Number(state.queueLength || 0),
    lastSource: normalizeString(state.lastSource, ''),
    lastError: normalizeString(state.lastError, ''),
    lastErrorCode: Number(state.lastErrorCode || 0),
    lastMode: normalizeString(state.lastMode, ''),
    platform: getPlatform(),
  }
}

function addTtsListener(handler) {
  if (typeof handler !== 'function') {
    debugWarn('[listener] add failed: handler is not function')
    return false
  }
  if (listeners.indexOf(handler) === -1) {
    listeners.push(handler)
    debugLog('[listener] added, total=', listeners.length)
  } else {
    debugLog('[listener] skipped duplicate, total=', listeners.length)
  }
  return true
}

function removeTtsListener(handler) {
  const index = listeners.indexOf(handler)
  if (index >= 0) {
    listeners.splice(index, 1)
    debugLog('[listener] removed, total=', listeners.length)
    return true
  }
  debugWarn('[listener] remove missed, total=', listeners.length)
  return false
}

function setTtsProvider(config) {
  const nextConfig = safeObject(config)
  runtime.provider = {
    kind: normalizeString(nextConfig.kind, PROVIDER_KIND_HTTP_AUDIO),
    name: normalizeString(nextConfig.name, 'Custom HTTP TTS'),
    endpoint: normalizeString(nextConfig.endpoint, '').trim(),
    method: normalizeString(nextConfig.method, 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
    headers: safeObject(nextConfig.headers),
    timeoutMs: clamp(nextConfig.timeoutMs, 1000, 60000, DEFAULT_PROVIDER_TIMEOUT_MS),
    request: {
      contentType: normalizeString(
        safeObject(nextConfig.request).contentType,
        'application/json'
      ).toLowerCase(),
      textField: normalizeString(safeObject(nextConfig.request).textField, 'text'),
      voiceField: normalizeString(safeObject(nextConfig.request).voiceField, 'voice'),
      languageField: normalizeString(safeObject(nextConfig.request).languageField, 'language'),
      formatField: normalizeString(safeObject(nextConfig.request).formatField, 'format'),
      rateField: normalizeString(safeObject(nextConfig.request).rateField, 'rate'),
      pitchField: normalizeString(safeObject(nextConfig.request).pitchField, 'pitch'),
      extra: clonePlain(safeObject(nextConfig.request).extra || {}),
    },
    response: {
      type: normalizeString(safeObject(nextConfig.response).type, DEFAULT_PROVIDER_TYPE),
      audioField: normalizeString(safeObject(nextConfig.response).audioField, 'data.audio'),
      urlField: normalizeString(safeObject(nextConfig.response).urlField, 'data.url'),
      mimeField: normalizeString(safeObject(nextConfig.response).mimeField, 'data.mime'),
      mimeType: normalizeString(safeObject(nextConfig.response).mimeType, ''),
    },
    cache: {
      enabled: safeObject(nextConfig.cache).enabled !== false,
      persistent:
        safeObject(nextConfig.cache).persistent === undefined
          ? true
          : !!safeObject(nextConfig.cache).persistent,
    },
    voices: Array.isArray(nextConfig.voices) ? clonePlain(nextConfig.voices) : [],
  }
  updateState({
    providerConfigured: !!runtime.provider.endpoint,
    providerName: runtime.provider.name,
  })
  emit('provider-change', {
    providerConfigured: !!runtime.provider.endpoint,
    providerName: runtime.provider.name,
  })
  return {
    ok: !!runtime.provider.endpoint,
    providerConfigured: !!runtime.provider.endpoint,
    providerName: runtime.provider.name,
    errCode: runtime.provider.endpoint ? 0 : -1,
    errMsg: runtime.provider.endpoint ? '' : 'provider.endpoint 不能为空',
  }
}

function clearTtsProvider() {
  runtime.provider = null
  updateState({
    providerConfigured: false,
    providerName: '',
  })
  emit('provider-change', {
    providerConfigured: false,
    providerName: '',
  })
  return true
}

function getTtsProvider() {
  return clonePlain(runtime.provider)
}

function getValueByPath(target, path, fallback) {
  const source = target
  const sourcePath = normalizeString(path, '')
  if (!source || !sourcePath) {
    return fallback
  }
  const parts = sourcePath.split('.')
  let current = source
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    if (!current || typeof current !== 'object' || !(key in current)) {
      return fallback
    }
    current = current[key]
  }
  return current === undefined || current === null ? fallback : current
}

function inferMimeType(mimeType, source) {
  const nextMime = normalizeString(mimeType, '').toLowerCase()
  if (nextMime) return nextMime
  const url = normalizeString(source, '').toLowerCase()
  if (url.indexOf('.wav') >= 0) return 'audio/wav'
  if (url.indexOf('.aac') >= 0 || url.indexOf('.m4a') >= 0) return 'audio/aac'
  if (url.indexOf('.ogg') >= 0) return 'audio/ogg'
  return 'audio/mpeg'
}

function inferFileExtension(mimeType, source) {
  const mime = inferMimeType(mimeType, source)
  if (mime.indexOf('wav') >= 0) return 'wav'
  if (mime.indexOf('aac') >= 0 || mime.indexOf('m4a') >= 0) return 'm4a'
  if (mime.indexOf('ogg') >= 0) return 'ogg'
  return 'mp3'
}

function normalizePlayableSource(source, mimeType) {
  const src = normalizeString(source, '')
  if (!src) return ''
  if (src.indexOf('http://') === 0 || src.indexOf('https://') === 0 || src.indexOf('data:') === 0) {
    return src
  }
  if (src.indexOf('_doc/') === 0 || src.indexOf('_www/') === 0) {
    return src
  }
  if (src.indexOf('file://') === 0) {
    return src
  }
  if (src.indexOf('/') === 0) {
    return 'file://' + src
  }
  if (src.indexOf('base64,') >= 0) {
    return 'data:' + inferMimeType(mimeType, '') + ';base64,' + src.split('base64,')[1]
  }
  return src
}

function buildProviderCacheKey(text, providerConfig, options) {
  return hashText(
    JSON.stringify({
      text,
      endpoint: providerConfig.endpoint,
      voice: normalizeString(options.voice, ''),
      language: normalizeLanguageTag(options.language),
      rate: clamp(options.rate, 0.1, 4, DEFAULT_NATIVE_RATE),
      pitch: clamp(options.pitch, 0.5, 2, DEFAULT_NATIVE_PITCH),
      format: normalizeString(options.format, DEFAULT_PROVIDER_FORMAT),
      extra: safeObject(options.providerOptions),
    })
  )
}

function requestByUni(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => {
        const statusCode = Number(res.statusCode || 0)
        if (statusCode >= 200 && statusCode < 300) {
          resolve(res)
          return
        }
        reject(
          new Error(
            '请求失败，状态码 ' +
              statusCode +
              '，响应内容：' +
              (typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {}))
          )
        )
      },
      fail: (err) => {
        reject(err)
      },
    })
  })
}

function downloadFileToCache(url, fileName) {
  return new Promise((resolve, reject) => {
    if (!ensureSupported()) {
      reject(new Error('当前环境不支持下载缓存'))
      return
    }
    const task = plus.downloader.createDownload(
      url,
      {
        filename: PROVIDER_CACHE_DIR + '/' + fileName,
      },
      (download, status) => {
        if (status === 200) {
          const localPath = normalizeString(download.filename, '')
          resolve(localPath)
          return
        }
        reject(new Error('音频下载失败，状态码 ' + status))
      }
    )
    task.start()
  })
}

function ensurePlayer() {
  if (runtime.player) {
    return runtime.player
  }
  const player = uni.createInnerAudioContext()
  try {
    player.autoplay = false
  } catch (e) {}
  try {
    player.obeyMuteSwitch = false
  } catch (e) {}
  try {
    player.volume = DEFAULT_PLAYBACK_VOLUME
  } catch (e) {}
  player.onPlay(() => {
    updateState({
      speaking: true,
      paused: false,
    })
    emit('start', {
      mode: 'provider',
      utteranceId: state.currentUtteranceId,
      text: state.currentText,
      source: state.lastSource,
    })
  })
  player.onPause(() => {
    updateState({
      speaking: false,
      paused: true,
    })
    emit('pause', {
      mode: 'provider',
      utteranceId: state.currentUtteranceId,
    })
  })
  player.onStop(() => {
    updateState({
      speaking: false,
      paused: false,
    })
    emit('stop', {
      mode: 'provider',
      utteranceId: state.currentUtteranceId,
    })
  })
  player.onEnded(() => {
    const finishedTask = runtime.activeProviderTask
    updateState({
      speaking: false,
      paused: false,
      currentText: '',
      currentUtteranceId: '',
    })
    emit('complete', {
      mode: 'provider',
      utteranceId: finishedTask ? finishedTask.utteranceId : '',
      source: finishedTask ? finishedTask.source : '',
    })
    runtime.activeProviderTask = null
    runtime.providerBusy = false
    runNextProviderTask()
  })
  player.onError((err) => {
    const message = err && err.errMsg ? err.errMsg : '音频播放失败'
    setLastError(err && err.errCode ? err.errCode : -1, message)
    updateState({
      speaking: false,
      paused: false,
      currentText: '',
      currentUtteranceId: '',
    })
    emit('error', {
      mode: 'provider',
      utteranceId: runtime.activeProviderTask ? runtime.activeProviderTask.utteranceId : '',
      errCode: err && err.errCode ? err.errCode : -1,
      errMsg: message,
    })
    runtime.activeProviderTask = null
    runtime.providerBusy = false
    runNextProviderTask()
  })
  runtime.player = player
  return runtime.player
}

function stopProviderPlayback(clearQueue = true) {
  if (runtime.player) {
    try {
      runtime.player.stop()
    } catch (e) {}
  }
  runtime.activeProviderTask = null
  runtime.providerBusy = false
  if (clearQueue) {
    runtime.providerQueue = []
    updateState({
      queueLength: 0,
    })
  }
}

function stopNativePlayback() {
  const platform = getPlatform()
  if (platform === 'android' && runtime.android.tts) {
    try {
      runtime.android.tts.stop()
    } catch (e) {}
  }
  if (platform === 'ios' && runtime.ios.synthesizer) {
    try {
      runtime.ios.synthesizer.stopSpeakingAtBoundary(0)
    } catch (e) {}
  }
  if (runtime.ios.stateTimer) {
    clearTimeout(runtime.ios.stateTimer)
    runtime.ios.stateTimer = 0
  }
}

function stopAllPlayback(clearQueue = true) {
  stopProviderPlayback(clearQueue)
  stopNativePlayback()
  updateState({
    speaking: false,
    paused: false,
    currentText: '',
    currentUtteranceId: '',
  })
}

function parseLanguageTagForAndroid(language) {
  const nextLanguage = normalizeLanguageTag(language)
  const parts = nextLanguage.split('-')
  return {
    language: normalizeString(parts[0], 'zh'),
    country: normalizeString(parts[1], '').toUpperCase(),
  }
}

function ensureAndroidTts() {
  if (!ensureSupported()) {
    return Promise.reject(new Error(state.lastError))
  }
  if (getPlatform() !== 'android') {
    return Promise.reject(new Error('当前不是 Android 环境'))
  }
  if (runtime.android.ready && runtime.android.tts) {
    return Promise.resolve(runtime.android.tts)
  }
  if (runtime.android.initPromise) {
    return runtime.android.initPromise
  }
  runtime.android.initPromise = new Promise((resolve, reject) => {
    try {
      const main = plus.android.runtimeMainActivity()
      const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
      runtime.android.onInitListener = plus.android.implements(
        'android.speech.tts.TextToSpeech$OnInitListener',
        {
          onInit(status) {
            debugLog('[android] onInit status=', status)
            if (status === TextToSpeech.SUCCESS) {
              runtime.android.ready = true
              try {
                runtime.android.progressListener = plus.android.implements(
                  'android.speech.tts.UtteranceProgressListener',
                  {
                    onStart(utteranceId) {
                      debugLog('[android] onStart utteranceId=', utteranceId)
                      updateState({
                        speaking: true,
                        paused: false,
                        currentUtteranceId: normalizeString(utteranceId, state.currentUtteranceId),
                      })
                      emit('start', {
                        mode: 'native',
                        utteranceId: normalizeString(utteranceId, state.currentUtteranceId),
                        text: state.currentText,
                      })
                    },
                    onDone(utteranceId) {
                      debugLog('[android] onDone utteranceId=', utteranceId)
                      updateState({
                        speaking: false,
                        paused: false,
                        currentText: '',
                        currentUtteranceId: '',
                      })
                      emit('complete', {
                        mode: 'native',
                        utteranceId: normalizeString(utteranceId, ''),
                      })
                    },
                    onError(utteranceId) {
                      debugWarn('[android] onError utteranceId=', utteranceId)
                      setLastError(-1, 'Android 原生播报失败')
                      updateState({
                        speaking: false,
                        paused: false,
                        currentText: '',
                        currentUtteranceId: '',
                      })
                      emit('error', {
                        mode: 'native',
                        utteranceId: normalizeString(utteranceId, ''),
                        errCode: -1,
                        errMsg: 'Android 原生播报失败',
                      })
                    },
                  }
                )
                runtime.android.tts.setOnUtteranceProgressListener(runtime.android.progressListener)
                debugLog('[android] UtteranceProgressListener attached')
              } catch (e) {
                debugError('[android] attach listener failed:', e)
              }
              try {
                runtime.android.legacyCompleteListener = plus.android.implements(
                  'android.speech.tts.TextToSpeech$OnUtteranceCompletedListener',
                  {
                    onUtteranceCompleted(utteranceId) {
                      const normalizedUtteranceId = normalizeString(utteranceId, '')
                      const fallbackUtteranceId = normalizedUtteranceId || state.currentUtteranceId
                      debugLog('[android] onUtteranceCompleted utteranceId=', normalizedUtteranceId)
                      if (!state.currentUtteranceId && !state.currentText && !state.speaking) {
                        debugLog('[android] legacy complete ignored because state is already idle')
                        return
                      }
                      if (
                        normalizedUtteranceId &&
                        state.currentUtteranceId &&
                        normalizedUtteranceId !== state.currentUtteranceId
                      ) {
                        debugWarn(
                          '[android] legacy complete ignored, utteranceId mismatch:',
                          normalizedUtteranceId,
                          state.currentUtteranceId
                        )
                        return
                      }
                      updateState({
                        speaking: false,
                        paused: false,
                        currentText: '',
                        currentUtteranceId: '',
                      })
                      emit('complete', {
                        mode: 'native',
                        utteranceId: fallbackUtteranceId,
                      })
                    },
                  }
                )
                runtime.android.tts.setOnUtteranceCompletedListener(runtime.android.legacyCompleteListener)
                debugLog('[android] OnUtteranceCompletedListener attached')
              } catch (e) {
                debugWarn('[android] attach legacy completed listener failed:', e)
              }
              resolve(runtime.android.tts)
              return
            }
            reject(new Error('Android TextToSpeech 初始化失败，状态码 ' + status))
          },
        }
      )
      runtime.android.tts = new TextToSpeech(main, runtime.android.onInitListener)
    } catch (e) {
      reject(e)
    }
  })
  return runtime.android.initPromise
}

function findAndroidVoice(tts, voiceId) {
  const targetVoiceId = normalizeString(voiceId, '')
  if (!targetVoiceId) return null
  try {
    const voices = tts.getVoices()
    if (!voices) return null
    const iterator = voices.iterator()
    while (iterator.hasNext()) {
      const voice = iterator.next()
      plus.android.importClass(voice)
      const id = normalizeString(voice.getName(), '')
      if (id === targetVoiceId) {
        return voice
      }
    }
  } catch (e) {}
  return null
}

function speakByAndroidCompat(tts, text, queueMode, utteranceId) {
  try {
    const Bundle = plus.android.importClass('android.os.Bundle')
    const bundle = new Bundle()
    const result = tts.speak(text, queueMode, bundle, utteranceId)
    debugLog('[android] speak(bundle) result=', result, 'utteranceId=', utteranceId)
    return result
  } catch (e) {
    debugWarn('[android] speak(bundle) failed, fallback to HashMap:', e)
  }
  try {
    const HashMap = plus.android.importClass('java.util.HashMap')
    const params = new HashMap()
    try {
      const Engine = plus.android.importClass('android.speech.tts.TextToSpeech$Engine')
      const key = normalizeString(Engine.KEY_PARAM_UTTERANCE_ID, 'utteranceId')
      params.put(key, utteranceId)
      if (key !== 'utteranceId') {
        params.put('utteranceId', utteranceId)
      }
      debugLog('[android] fallback utterance key=', key)
    } catch (innerError) {
      params.put('utteranceId', utteranceId)
      debugWarn('[android] read KEY_PARAM_UTTERANCE_ID failed:', innerError)
    }
    const result = tts.speak(text, queueMode, params)
    debugLog('[android] speak(hashMap) result=', result, 'utteranceId=', utteranceId)
    return result
  } catch (e) {
    debugError('[android] speak(hashMap) failed:', e)
    throw e
  }
}

async function speakByAndroid(text, options) {
  const tts = await ensureAndroidTts()
  const TextToSpeech = plus.android.importClass('android.speech.tts.TextToSpeech')
  const Locale = plus.android.importClass('java.util.Locale')
  const utteranceId = createUtteranceId()
  const queueMode = normalizeQueueMode(options.queueMode) === 'append' ? TextToSpeech.QUEUE_ADD : TextToSpeech.QUEUE_FLUSH
  try {
    const languageParts = parseLanguageTagForAndroid(options.language)
    const locale = languageParts.country
      ? new Locale(languageParts.language, languageParts.country)
      : new Locale(languageParts.language)
    tts.setLanguage(locale)
  } catch (e) {}
  try {
    tts.setPitch(clamp(options.pitch, 0.5, 2, DEFAULT_NATIVE_PITCH))
  } catch (e) {}
  try {
    tts.setSpeechRate(clamp(options.rate, 0.1, 4, DEFAULT_NATIVE_RATE))
  } catch (e) {}
  try {
    const voice = findAndroidVoice(tts, options.voice)
    if (voice) {
      tts.setVoice(voice)
    }
  } catch (e) {}
  updateState({
    mode: 'native',
    lastMode: 'native',
    currentText: text,
    currentUtteranceId: utteranceId,
    paused: false,
    lastSource: 'native',
  })
  clearLastError()
  debugLog('[android] speak request', {
    utteranceId,
    textLength: text.length,
    queueMode: normalizeQueueMode(options.queueMode),
    language: options.language,
    voice: options.voice,
    rate: options.rate,
    pitch: options.pitch,
  })
  const result = speakByAndroidCompat(tts, text, queueMode, utteranceId)
  if (result !== TextToSpeech.SUCCESS) {
    throw new Error('Android 原生播报提交失败，返回码 ' + result)
  }
  return buildResult(true, {
    mode: 'native',
    utteranceId,
    source: 'native',
  })
}

function getIosSynthesizer() {
  if (runtime.ios.synthesizer) {
    return runtime.ios.synthesizer
  }
  if (!ensureSupported()) {
    throw new Error(state.lastError)
  }
  const AVSpeechSynthesizer = plus.ios.importClass('AVSpeechSynthesizer')
  const synthesizer = new AVSpeechSynthesizer()
  runtime.ios.synthesizer = synthesizer
  return runtime.ios.synthesizer
}

function watchIosSpeechCompletion(utteranceId) {
  if (runtime.ios.stateTimer) {
    clearTimeout(runtime.ios.stateTimer)
    runtime.ios.stateTimer = 0
  }
  const synthesizer = runtime.ios.synthesizer
  if (!synthesizer) {
    return
  }
  const tick = () => {
    let speaking = false
    try {
      speaking = !!synthesizer.isSpeaking()
    } catch (e) {
      speaking = false
    }
    if (speaking) {
      runtime.ios.stateTimer = setTimeout(tick, 180)
      return
    }
    runtime.ios.stateTimer = 0
    if (state.currentUtteranceId === utteranceId) {
      updateState({
        speaking: false,
        paused: false,
        currentText: '',
        currentUtteranceId: '',
      })
      emit('complete', {
        mode: 'native',
        utteranceId,
      })
    }
  }
  runtime.ios.stateTimer = setTimeout(tick, 180)
}

function listIosVoicesRaw() {
  const AVSpeechSynthesisVoice = plus.ios.importClass('AVSpeechSynthesisVoice')
  const voices = AVSpeechSynthesisVoice.speechVoices()
  plus.ios.importClass(voices)
  return voices
}

function configureIosAudioSession() {
  try {
    const AVAudioSession = plus.ios.importClass('AVAudioSession')
    const session = AVAudioSession.sharedInstance()
    try {
      plus.ios.invoke(session, 'setCategory:error:', 'AVAudioSessionCategoryPlayback', null)
    } catch (e) {}
    try {
      plus.ios.invoke(session, 'setActive:error:', true, null)
    } catch (e) {}
  } catch (e) {}
}

function findIosVoice(voiceId, languageTag) {
  const normalizedVoiceId = normalizeString(voiceId, '')
  const normalizedLanguage = normalizeLanguageTag(languageTag)
  try {
    const voices = listIosVoicesRaw()
    const count = Number(voices.count())
    for (let i = 0; i < count; i += 1) {
      const voice = voices.objectAtIndex(i)
      plus.ios.importClass(voice)
      const identifier = normalizeString(voice.identifier ? voice.identifier() : '', '')
      const name = normalizeString(voice.name ? voice.name() : '', '')
      const language = normalizeLanguageTag(voice.language ? voice.language() : '')
      if (normalizedVoiceId && (identifier === normalizedVoiceId || name === normalizedVoiceId)) {
        return voice
      }
      if (!normalizedVoiceId && language === normalizedLanguage) {
        return voice
      }
    }
  } catch (e) {}
  return null
}

function createIosVoiceByLanguage(languageTag) {
  const normalizedLanguage = normalizeLanguageTag(languageTag)
  try {
    const AVSpeechSynthesisVoice = plus.ios.importClass('AVSpeechSynthesisVoice')
    const voice = AVSpeechSynthesisVoice.voiceWithLanguage(normalizedLanguage)
    if (voice) {
      return voice
    }
  } catch (e) {}
  return null
}

async function speakByIos(text, options) {
  if (!ensureSupported()) {
    throw new Error(state.lastError)
  }
  configureIosAudioSession()
  const utteranceId = createUtteranceId()
  const AVSpeechUtterance = plus.ios.importClass('AVSpeechUtterance')
  const utterance = AVSpeechUtterance.speechUtteranceWithString(text)
  const synthesizer = getIosSynthesizer()
  utterance.plusSetAttribute('rate', clamp(options.rate, 0.1, 1, 0.5))
  utterance.plusSetAttribute('volume', clamp(options.volume, 0, 1, DEFAULT_PLAYBACK_VOLUME))
  utterance.plusSetAttribute('pitchMultiplier', clamp(options.pitch, 0.5, 2, DEFAULT_NATIVE_PITCH))
  const voice = options.voice
    ? findIosVoice(options.voice, options.language)
    : createIosVoiceByLanguage(options.language)
  if (voice) {
    try {
      utterance.plusSetAttribute('voice', voice)
    } catch (e) {}
  }
  if (normalizeQueueMode(options.queueMode) === 'flush') {
    try {
      synthesizer.stopSpeakingAtBoundary(0)
    } catch (e) {}
  }
  updateState({
    mode: 'native',
    lastMode: 'native',
    currentText: text,
    currentUtteranceId: utteranceId,
    paused: false,
    speaking: true,
    lastSource: 'native',
  })
  clearLastError()
  emit('start', {
    mode: 'native',
    utteranceId,
    text,
  })
  try {
    synthesizer.speakUtterance(utterance)
  } catch (e) {
    updateState({
      speaking: false,
      paused: false,
      currentText: '',
      currentUtteranceId: '',
    })
    throw e
  }
  watchIosSpeechCompletion(utteranceId)
  return buildResult(true, {
    mode: 'native',
    utteranceId,
    source: 'native',
  })
}

async function speakByNative(text, options = {}) {
  const platform = getPlatform()
  if (platform === 'android') {
    return speakByAndroid(text, options)
  }
  if (platform === 'ios') {
    return speakByIos(text, options)
  }
  throw new Error('当前平台不支持原生播报')
}

function buildProviderRequestData(text, providerConfig, options) {
  const request = safeObject(providerConfig.request)
  const body = {
    ...clonePlain(request.extra || {}),
  }
  if (request.textField) body[request.textField] = text
  if (request.voiceField && options.voice) body[request.voiceField] = options.voice
  if (request.languageField) body[request.languageField] = normalizeLanguageTag(options.language)
  if (request.formatField) body[request.formatField] = normalizeString(options.format, DEFAULT_PROVIDER_FORMAT)
  if (request.rateField) body[request.rateField] = clamp(options.rate, 0.1, 4, DEFAULT_NATIVE_RATE)
  if (request.pitchField) body[request.pitchField] = clamp(options.pitch, 0.5, 2, DEFAULT_NATIVE_PITCH)
  const providerOptions = safeObject(options.providerOptions)
  Object.keys(providerOptions).forEach((key) => {
    body[key] = providerOptions[key]
  })
  return body
}

async function resolveProviderAudio(text, options) {
  const providerConfig = runtime.provider
  if (!providerConfig || !providerConfig.endpoint) {
    throw new Error('未配置第三方 provider')
  }
  const cacheKey = buildProviderCacheKey(text, providerConfig, options)
  const memoryCacheEntry = runtime.memoryCache[cacheKey]
  if (memoryCacheEntry) {
    return {
      ...memoryCacheEntry,
      usingCache: true,
      cacheKey,
    }
  }
  const requestData = buildProviderRequestData(text, providerConfig, options)
  const headers = {
    ...clonePlain(providerConfig.headers || {}),
  }
  const contentType = normalizeString(providerConfig.request.contentType, 'application/json').toLowerCase()
  if (!headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = contentType
  }
  const responseType = providerConfig.response.type === 'binary' ? 'arraybuffer' : 'text'
  const res = await requestByUni({
    url: providerConfig.endpoint,
    method: providerConfig.method,
    header: headers,
    timeout: providerConfig.timeoutMs,
    responseType,
    data: contentType.indexOf('json') >= 0 ? requestData : requestData,
  })
  const responseTypeName = normalizeString(providerConfig.response.type, DEFAULT_PROVIDER_TYPE)
  const responseMime =
    inferMimeType(
      getValueByPath(res.data, providerConfig.response.mimeField, '') ||
        getValueByPath(res.header || {}, 'content-type', '') ||
        getValueByPath(res.header || {}, 'Content-Type', '') ||
        providerConfig.response.mimeType,
      ''
    ) || 'audio/mpeg'

  if (responseTypeName === 'binary') {
    const base64 = uni.arrayBufferToBase64(res.data)
    const src = 'data:' + responseMime + ';base64,' + base64
    const payload = {
      src,
      source: src,
      filePath: '',
      mimeType: responseMime,
      usingCache: false,
      cacheKey,
    }
    if (providerConfig.cache.enabled) {
      runtime.memoryCache[cacheKey] = payload
    }
    return payload
  }

  if (responseTypeName === 'json-base64') {
    const base64 = normalizeString(getValueByPath(res.data, providerConfig.response.audioField, ''), '')
    if (!base64) {
      throw new Error('provider 未返回有效的 base64 音频数据')
    }
    const src = base64.indexOf('data:') === 0 ? base64 : 'data:' + responseMime + ';base64,' + base64
    const payload = {
      src,
      source: src,
      filePath: '',
      mimeType: responseMime,
      usingCache: false,
      cacheKey,
    }
    if (providerConfig.cache.enabled) {
      runtime.memoryCache[cacheKey] = payload
    }
    return payload
  }

  if (responseTypeName === 'direct-base64') {
    const base64 = normalizeString(res.data, '')
    if (!base64) {
      throw new Error('provider 未返回有效的 base64 音频数据')
    }
    const src = base64.indexOf('data:') === 0 ? base64 : 'data:' + responseMime + ';base64,' + base64
    const payload = {
      src,
      source: src,
      filePath: '',
      mimeType: responseMime,
      usingCache: false,
      cacheKey,
    }
    if (providerConfig.cache.enabled) {
      runtime.memoryCache[cacheKey] = payload
    }
    return payload
  }

  const audioUrl =
    responseTypeName === 'direct-url'
      ? normalizeString(res.data, '')
      : normalizeString(getValueByPath(res.data, providerConfig.response.urlField, ''), '')
  if (!audioUrl) {
    throw new Error('provider 未返回可播放音频地址')
  }

  if (providerConfig.cache.enabled && providerConfig.cache.persistent) {
    const ext = inferFileExtension(responseMime, audioUrl)
    const cachedPath = await downloadFileToCache(audioUrl, cacheKey + '.' + ext)
    const payload = {
      src: normalizePlayableSource(cachedPath, responseMime),
      source: audioUrl,
      filePath: cachedPath,
      mimeType: responseMime,
      usingCache: false,
      cacheKey,
    }
    runtime.memoryCache[cacheKey] = payload
    return payload
  }

  const payload = {
    src: normalizePlayableSource(audioUrl, responseMime),
    source: audioUrl,
    filePath: '',
    mimeType: responseMime,
    usingCache: false,
    cacheKey,
  }
  if (providerConfig.cache.enabled) {
    runtime.memoryCache[cacheKey] = payload
  }
  return payload
}

async function executeProviderTask(task) {
  runtime.providerBusy = true
  const player = ensurePlayer()
  const providerAudio = await resolveProviderAudio(task.text, task.options)
  runtime.activeProviderTask = {
    utteranceId: task.utteranceId,
    text: task.text,
    source: providerAudio.source,
  }
  updateState({
    mode: 'provider',
    lastMode: 'provider',
    currentText: task.text,
    currentUtteranceId: task.utteranceId,
    paused: false,
    lastSource: providerAudio.source,
    queueLength: runtime.providerQueue.length,
  })
  clearLastError()
  try {
    player.volume = clamp(task.options.volume, 0, 1, DEFAULT_PLAYBACK_VOLUME)
  } catch (e) {}
  player.src = providerAudio.src
  player.play()
  task.resolve(
    buildResult(true, {
      mode: 'provider',
      utteranceId: task.utteranceId,
      filePath: providerAudio.filePath,
      source: providerAudio.source,
      usingCache: providerAudio.usingCache,
    })
  )
}

function runNextProviderTask() {
  if (runtime.providerBusy) {
    return
  }
  const nextTask = runtime.providerQueue.shift()
  updateState({
    queueLength: runtime.providerQueue.length,
  })
  if (!nextTask) {
    return
  }
  executeProviderTask(nextTask).catch((err) => {
    runtime.providerBusy = false
    runtime.activeProviderTask = null
    setLastError(-1, normalizeString(err && err.message, 'provider 播报失败'))
    emit('error', {
      mode: 'provider',
      utteranceId: nextTask.utteranceId,
      errCode: -1,
      errMsg: normalizeString(err && err.message, 'provider 播报失败'),
    })
    nextTask.reject(err)
    runNextProviderTask()
  })
}

function speakByProvider(text, options = {}) {
  if (!runtime.provider || !runtime.provider.endpoint) {
    return Promise.reject(new Error('未配置 provider'))
  }
  const utteranceId = createUtteranceId()
  return new Promise((resolve, reject) => {
    const task = {
      utteranceId,
      text,
      options,
      resolve,
      reject,
    }
    if (normalizeQueueMode(options.queueMode) === 'flush') {
      stopProviderPlayback(true)
    }
    runtime.providerQueue.push(task)
    updateState({
      queueLength: runtime.providerQueue.length,
    })
    runNextProviderTask()
  })
}

function normalizeSpeakOptions(options) {
  const nextOptions = safeObject(options)
  return {
    mode: normalizeMode(nextOptions.mode),
    queueMode: normalizeQueueMode(nextOptions.queueMode),
    language: normalizeLanguageTag(nextOptions.language),
    voice: normalizeString(nextOptions.voice, ''),
    rate: clamp(nextOptions.rate, 0.1, 4, DEFAULT_NATIVE_RATE),
    pitch: clamp(nextOptions.pitch, 0.5, 2, DEFAULT_NATIVE_PITCH),
    volume: clamp(nextOptions.volume, 0, 1, DEFAULT_PLAYBACK_VOLUME),
    format: normalizeString(nextOptions.format, DEFAULT_PROVIDER_FORMAT),
    providerOptions: safeObject(nextOptions.providerOptions),
  }
}

async function speak(text, options = {}) {
  const content = normalizeString(text, '').trim()
  if (!content) {
    return buildResult(false, {
      errCode: -1,
      errMsg: 'text 不能为空',
    })
  }
  if (!ensureSupported()) {
    return buildResult(false, {
      errCode: state.lastErrorCode,
      errMsg: state.lastError,
    })
  }
  const speakOptions = normalizeSpeakOptions(options)
  if (speakOptions.queueMode === 'flush') {
    stopAllPlayback(true)
  }
  if (speakOptions.mode === 'provider') {
    try {
      return await speakByProvider(content, speakOptions)
    } catch (e) {
      setLastError(-1, normalizeString(e && e.message, 'provider 播报失败'))
      return buildResult(false, {
        errCode: -1,
        errMsg: state.lastError,
        mode: 'provider',
      })
    }
  }
  if (speakOptions.mode === 'native') {
    try {
      return await speakByNative(content, speakOptions)
    } catch (e) {
      setLastError(-1, normalizeString(e && e.message, '原生播报失败'))
      return buildResult(false, {
        errCode: -1,
        errMsg: state.lastError,
        mode: 'native',
      })
    }
  }
  if (runtime.provider && runtime.provider.endpoint) {
    try {
      return await speakByProvider(content, speakOptions)
    } catch (e) {
      emit('fallback', {
        reason: normalizeString(e && e.message, 'provider 失败，回退原生'),
      })
    }
  }
  try {
    return await speakByNative(content, speakOptions)
  } catch (e) {
    setLastError(-1, normalizeString(e && e.message, '自动模式播报失败'))
    return buildResult(false, {
      errCode: -1,
      errMsg: state.lastError,
      mode: 'auto',
    })
  }
}

function stop() {
  const activeMode = state.mode
  const activeUtteranceId = state.currentUtteranceId
  stopAllPlayback(true)
  if (activeMode !== 'provider') {
    emit('stop', {
      mode: activeMode,
      utteranceId: activeUtteranceId,
    })
  }
  return true
}

function pause() {
  const platform = getPlatform()
  if (state.mode === 'provider') {
    const player = ensurePlayer()
    try {
      player.pause()
      return true
    } catch (e) {
      return false
    }
  }
  if (platform === 'ios' && runtime.ios.synthesizer) {
    try {
      if (runtime.ios.stateTimer) {
        clearTimeout(runtime.ios.stateTimer)
        runtime.ios.stateTimer = 0
      }
      runtime.ios.synthesizer.pauseSpeakingAtBoundary(1)
      updateState({
        speaking: false,
        paused: true,
      })
      emit('pause', {
        mode: 'native',
        utteranceId: state.currentUtteranceId,
      })
      return true
    } catch (e) {
      return false
    }
  }
  setLastError(-2, '当前模式不支持 pause')
  return false
}

function resume() {
  const platform = getPlatform()
  if (state.mode === 'provider') {
    const player = ensurePlayer()
    try {
      player.play()
      return true
    } catch (e) {
      return false
    }
  }
  if (platform === 'ios' && runtime.ios.synthesizer) {
    try {
      runtime.ios.synthesizer.continueSpeaking()
      updateState({
        speaking: true,
        paused: false,
      })
      emit('resume', {
        mode: 'native',
        utteranceId: state.currentUtteranceId,
      })
      if (state.currentUtteranceId) {
        watchIosSpeechCompletion(state.currentUtteranceId)
      }
      return true
    } catch (e) {
      return false
    }
  }
  setLastError(-2, '当前模式不支持 resume')
  return false
}

function isSpeaking() {
  if (!ensureSupported()) {
    return false
  }
  if (state.mode === 'provider') {
    return !!state.speaking
  }
  const platform = getPlatform()
  if (platform === 'android' && runtime.android.tts) {
    try {
      return !!runtime.android.tts.isSpeaking()
    } catch (e) {
      return !!state.speaking
    }
  }
  if (platform === 'ios' && runtime.ios.synthesizer) {
    try {
      return !!runtime.ios.synthesizer.isSpeaking()
    } catch (e) {
      return !!state.speaking
    }
  }
  return !!state.speaking
}

async function getNativeVoices() {
  if (!ensureSupported()) {
    return []
  }
  const platform = getPlatform()
  if (platform === 'android') {
    const tts = await ensureAndroidTts()
    const result = []
    try {
      const voices = tts.getVoices()
      if (!voices) return result
      const iterator = voices.iterator()
      while (iterator.hasNext()) {
        const voice = iterator.next()
        plus.android.importClass(voice)
        const locale = voice.getLocale ? voice.getLocale() : null
        if (locale) {
          plus.android.importClass(locale)
        }
        result.push({
          id: normalizeString(voice.getName ? voice.getName() : '', ''),
          name: normalizeString(voice.getName ? voice.getName() : '', ''),
          language:
            locale && locale.toLanguageTag
              ? normalizeString(locale.toLanguageTag(), '')
              : normalizeLanguageTag(DEFAULT_LANGUAGE),
          provider: 'native',
          engine: 'android',
        })
      }
    } catch (e) {}
    return result
  }
  if (platform === 'ios') {
    const voices = listIosVoicesRaw()
    const result = []
    const count = Number(voices.count())
    for (let i = 0; i < count; i += 1) {
      const voice = voices.objectAtIndex(i)
      plus.ios.importClass(voice)
      result.push({
        id: normalizeString(voice.identifier ? voice.identifier() : voice.name ? voice.name() : '', ''),
        name: normalizeString(voice.name ? voice.name() : '', ''),
        language: normalizeLanguageTag(voice.language ? voice.language() : DEFAULT_LANGUAGE),
        provider: 'native',
        engine: 'ios',
      })
    }
    return result
  }
  return []
}

async function getTtsVoices(mode = 'native') {
  const normalizedMode = normalizeString(mode, 'native')
  if (normalizedMode === 'provider') {
    if (!runtime.provider || !Array.isArray(runtime.provider.voices)) {
      return []
    }
    return runtime.provider.voices.map((item) => ({
      id: normalizeString(item.id || item.name, ''),
      name: normalizeString(item.name || item.id, ''),
      language: normalizeLanguageTag(item.language || DEFAULT_LANGUAGE),
      provider: 'provider',
      engine: normalizeString(runtime.provider.name, 'provider'),
    }))
  }
  return getNativeVoices()
}

function clearMemoryCache() {
  runtime.memoryCache = {}
  return true
}

export {
  addTtsListener,
  clearMemoryCache,
  clearTtsProvider,
  getTtsProvider,
  getTtsState,
  getTtsVoices,
  isSpeaking,
  pause,
  removeTtsListener,
  resume,
  setTtsProvider,
  speak,
  stop,
}
