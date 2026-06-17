# austin-tts

`austin-tts` 是一个 App 端文字转语音插件，支持 Android / iOS。

## 功能介绍

- 支持系统原生 TTS 播报
- 支持自定义第三方 HTTP TTS 接口
- 支持 `auto / native / provider` 三种模式
- 支持 `speak / pause / resume / stop`
- 支持查询当前状态
- 支持查询可用音色
- 自带示例页：`pages/austin-tts/index`

## 模式说明

- `native`
  - 直接走系统原生文字转语音
- `provider`
  - 走你自己配置的第三方接口
- `auto`
  - 优先走 `provider`，失败后回退 `native`

## 常用字段说明

### `language`

语言标识，例如：

- `zh-CN`
- `en-US`
- `ja-JP`

说明：

- 可以切换
- 不是固定几种
- 具体支持多少种，取决于手机系统当前安装了哪些语音包
- 可通过 `getTtsVoices('native')` 查看当前设备可用音色

### `voice`

音色 id。

作用：

- 同一种语言下，可以切不同声音
- 不同 `voice` 可能代表不同男女声、不同风格、不同 provider 音色

说明：

- `native` 模式下，`voice` 来自系统可用音色
- `provider` 模式下，`voice` 由你的第三方接口自己定义
- 不填时会自动选一个默认音色

### `rate`

语速。值越大，读得越快。

### `pitch`

音调。值越大，声音越高。

### `volume`

音量。范围 `0 ~ 1`。

## 最小调用

```js
import { speak } from '@/uni_modules/austin-tts'

await speak('请保持正脸', {
  mode: 'native',
  language: 'zh-CN',
  rate: 1,
  pitch: 1,
  volume: 1,
})
```

## 查询原生音色

```js
import { getTtsVoices } from '@/uni_modules/austin-tts'

const voices = await getTtsVoices('native')
console.log(voices)
```

返回示例：

```js
[
  {
    id: 'com.apple.ttsbundle.Tingting-compact',
    name: 'Tingting',
    language: 'zh-CN',
    provider: 'native',
    engine: 'ios',
  },
]
```

## 第三方接口配置

```js
import { setTtsProvider, speak } from '@/uni_modules/austin-tts'

setTtsProvider({
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
})

await speak('请保持正脸', {
  mode: 'auto',
  language: 'zh-CN',
  voice: 'female_01',
})
```

## API

### `speak(text, options)`

开始播报。

常用 `options`：

- `mode`
- `language`
- `voice`
- `rate`
- `pitch`
- `volume`
- `queueMode`

### `pause()`

暂停播报。

### `resume()`

继续播报。

### `stop()`

停止播报。

### `isSpeaking()`

当前是否正在播报。

### `getTtsState()`

获取当前状态。

### `getTtsVoices(mode)`

获取可用音色。

- `native`：系统原生音色
- `provider`：你在 provider 配置里定义的音色

### `setTtsProvider(config)`

设置第三方接口。

### `clearTtsProvider()`

清空第三方接口配置。

## 注意

- 当前只支持 App 端
- `language` 和 `voice` 的数量不是固定值，和系统、机型、第三方接口有关
- 如果要接正式生产环境，推荐让用户填写自己的服务端代理地址，不建议把生产密钥直接写进客户端
