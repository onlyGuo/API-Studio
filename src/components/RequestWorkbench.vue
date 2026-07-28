<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Activity, Braces, ChevronDown, ChevronRight, Clock3, Copy, ExternalLink, File, ListTree, Paperclip, Plus, Save, Send, ShieldCheck, Sparkles, Square, Trash2, Upload } from 'lucide-vue-next'
import type { Environment, Project, RequestData, ResponseData, SseEvent, StreamMessage, TestResult, UploadFile } from '../types'
import { buildRequest, uid } from '../lib'
import { runPreRequest, runTests } from '../scriptRuntime'
import { EventStreamParser, prettyData, type ParserMode } from '../sse'
import KeyValueEditor from './KeyValueEditor.vue'
import MonacoEditor from './MonacoEditor.vue'
import { beginResize, persistedSize } from '../resize'
import UiCheckbox from './ui/UiCheckbox.vue'
import UiNumber from './ui/UiNumber.vue'
import UiRadioGroup from './ui/UiRadioGroup.vue'
import UiSelect from './ui/UiSelect.vue'

const props = defineProps<{ request: RequestData; project: Project; environment: Environment; title?: string; embedded?: boolean }>()
const emit = defineEmits<{ 'update:request': [request: RequestData]; 'update:environment':[environment:Environment]; save: [] }>()
const activeTab = ref<'params' | 'auth' | 'headers' | 'body' | 'pre' | 'tests' | 'settings'>('params')
const responseTab = ref<'body' | 'events' | 'headers' | 'test'>('body')
const streamView = ref<'event' | 'data' | 'raw'>('event')
const sending = ref(false)
const response = ref<ResponseData | null>(null)
const streamEvents = ref<SseEvent[]>([])
const detectedMode = ref<'standard-sse' | 'data-stream' | 'raw-stream'>('raw-stream')
const pretty = ref(true)
const copied = ref(false)
const testResults = ref<TestResult[]>([])
const expandedEvents = ref<Set<number>>(new Set())
const workbenchHost = ref<HTMLElement>()
const { size: requestPaneHeight, set: setRequestPaneHeight } = persistedSize('request-response', 250)
let streamCleanup: (() => void) | undefined
let streamParser: EventStreamParser | undefined
const request = computed({ get: () => props.request, set: value => emit('update:request', value) })
const tabCount = computed(() => ({
  params: props.request.params.filter(v => v.enabled && v.key).length,
  headers: props.request.headers.filter(v => v.enabled && v.key).length,
}))
const responseText = computed(() => {
  const body = response.value?.body || ''
  if (isEventStream.value && responseTab.value === 'events' && streamView.value === 'event') {
    return streamEvents.value.map(item => {
      const meta = [`#${item.index}`, `event: ${item.event}`]
      if (item.id) meta.push(`id: ${item.id}`)
      if (item.retry) meta.push(`retry: ${item.retry}`)
      return `${meta.join('  ')}\ndata: ${pretty.value ? prettyData(item.data) : item.data}`
    }).join('\n\n')
  }
  if (isEventStream.value && responseTab.value === 'events' && streamView.value === 'data') {
    return streamEvents.value.map(item => pretty.value ? prettyData(item.data) : item.data).join('\n')
  }
  if (!pretty.value) return body
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
})
const isEventStream = computed(() => detectedMode.value !== 'raw-stream')
const responseLanguage = computed(() => {
  if (isEventStream.value && responseTab.value === 'events' && streamView.value === 'event') return 'plaintext'
  const text = responseText.value.trim()
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) return 'json'
  const contentType = response.value?.headers?.find(([key]) => key.toLowerCase() === 'content-type')?.[1] || ''
  if (contentType.includes('html')) return 'html'
  if (contentType.includes('xml')) return 'xml'
  return 'plaintext'
})
const bodyPlaceholder = computed(() => props.request.bodyMode === 'json' ? '{\n  "name": "{{username}}"\n}' : '输入请求正文')
const bodyLanguage = computed(() => props.request.bodyMode === 'json' ? 'json' : 'plaintext')
const methodOptions = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(value => ({label:value,value}))
const authOptions = [{label:'无认证',value:'none'},{label:'Bearer Token',value:'bearer'},{label:'Basic Auth',value:'basic'},{label:'API Key',value:'apiKey'}]
const apiKeyTargetOptions = [{label:'Header',value:'header'},{label:'Query 参数',value:'query'}]
const bodyModeOptions = [{label:'none',value:'none'},{label:'form-data',value:'form'},{label:'JSON',value:'json'},{label:'Text',value:'text'},{label:'x-www-form-urlencoded',value:'urlencoded'}]
const responseModeOptions = [{label:'自动识别',value:'auto',description:'根据 Content-Type 判断'},{label:'标准 SSE',value:'standard-sse',description:'event/data 分帧'},{label:'Data / NDJSON 流',value:'data-stream',description:'逐行数据流'},{label:'原始文本流',value:'raw-stream',description:'不解析分帧'}]

function patch<K extends keyof RequestData>(key: K, value: RequestData[K]) { request.value = { ...request.value, [key]: value } }
function multipartBody(payload: ReturnType<typeof buildRequest>) {
  if (!payload.multipart) return payload.body
  const form = new FormData()
  payload.multipart.forEach(part => {
    if (part.dataBase64) {
      const binary = atob(part.dataBase64)
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
      form.append(part.key, new Blob([bytes], { type: part.mimeType || 'application/octet-stream' }), part.fileName || 'file')
    } else if (!part.filePath) form.append(part.key, part.value || '')
  })
  return form
}

async function pickFiles() {
  let selected: Array<Omit<UploadFile, 'id' | 'enabled' | 'key'>> = []
  if (window.desktop) selected = await window.desktop.pickFiles()
  else {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.click()
    selected = await new Promise(resolve => {
      input.onchange = async () => {
        const values = await Promise.all(Array.from(input.files || []).map(async file => {
          const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte) })
          return { fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataBase64: btoa(binary) }
        }))
        resolve(values)
      }
      input.oncancel = () => resolve([])
    })
  }
  const files: UploadFile[] = selected.map(file => ({ ...file, id: uid(), enabled: true, key: 'file' }))
  if (files.length) patch('files', [...(request.value.files || []), ...files])
}
function updateFile(id: string, values: Partial<UploadFile>) { patch('files', (request.value.files || []).map(file => file.id === id ? { ...file, ...values } : file)) }
function removeFile(id: string) { patch('files', (request.value.files || []).filter(file => file.id !== id)) }
function fileSize(size: number) { return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : size > 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B` }
function resizeRequestPane(event: PointerEvent) {
  const height = workbenchHost.value?.clientHeight || 700
  beginResize(event, 'y', requestPaneHeight.value, setRequestPaneHeight, 125, Math.max(180, height - (props.embedded ? 250 : 290)))
}
async function send() {
  if (sending.value) { stopStream(); return }
  if (!props.request.url.trim()) return
  sending.value = true
  response.value = null
  testResults.value = []
  streamEvents.value = []
  expandedEvents.value = new Set()
  detectedMode.value = 'raw-stream'
  streamParser = undefined
  try {
    const runtime = await runPreRequest(props.request.preRequest, props.request, props.project, props.environment)
    const changeKeys=Object.keys(runtime.environmentChanges)
    if(changeKeys.length){
      const variables=props.environment.variables.filter(item=>!item.key||runtime.environmentChanges[item.key]!==undefined).map(item=>item.key in runtime.environmentChanges?{...item,value:runtime.environmentChanges[item.key]!}:item)
      changeKeys.filter(key=>runtime.environmentChanges[key]!==undefined&&!variables.some(item=>item.key===key)).forEach(key=>variables.push({id:uid(),enabled:true,key,value:runtime.environmentChanges[key]!,description:'由前置脚本写入'}))
      emit('update:environment',{...props.environment,variables})
    }
    const payload = buildRequest(props.request, props.environment, props.project, runtime.values)
    if (window.desktop) streamCleanup = window.desktop.requestStream(payload, handleStreamMessage)
    else streamCleanup = fetchStreamFallback(payload, handleStreamMessage)
  } catch (error) {
    response.value = { ok: false, error: error instanceof Error ? error.message : String(error), time: 0, completed: true }
    sending.value = false
  }
}

function chooseMode(headers: Array<[string, string]>) {
  const configured = props.request.settings.responseMode || 'auto'
  if (configured !== 'auto') return configured
  const contentType = headers.find(([key]) => key.toLowerCase() === 'content-type')?.[1].toLowerCase() || ''
  if (contentType.includes('text/event-stream')) return 'standard-sse'
  if (contentType.includes('ndjson') || contentType.includes('stream+json') || contentType.includes('json-seq')) return 'data-stream'
  return 'raw-stream'
}

function handleStreamMessage(message: StreamMessage) {
  if (message.type === 'headers') {
    detectedMode.value = chooseMode(message.headers)
    if (detectedMode.value !== 'raw-stream') {
      streamParser = new EventStreamParser(detectedMode.value as ParserMode, addStreamEvent)
      responseTab.value = 'events'
      streamView.value = detectedMode.value === 'data-stream' ? 'data' : 'event'
    } else responseTab.value = 'body'
    response.value = { ok: true, status: message.status, statusText: message.statusText, headers: message.headers, body: '', time: message.time, size: 0, url: message.url, streaming: true, completed: false }
    return
  }
  if (message.type === 'chunk') {
    if (!response.value) response.value = { ok: true, body: '', time: 0, size: 0, streaming: true, completed: false }
    response.value.body = (response.value.body || '') + message.chunk
    response.value.size = (response.value.size || 0) + message.bytes
    streamParser?.push(message.chunk)
    return
  }
  if (message.type === 'end') {
    streamParser?.finish()
    if (response.value) Object.assign(response.value, { time: message.time, size: message.size, streaming: false, completed: true })
    sending.value = false
    streamCleanup?.(); streamCleanup = undefined
    void executeResponseTests()
    return
  }
  response.value = { ...(response.value || { ok: false }), ok: false, error: message.error, time: message.time, streaming: false, completed: true }
  sending.value = false
  streamCleanup?.(); streamCleanup = undefined
}

function addStreamEvent(event:SseEvent){
  streamEvents.value.push(event)
  if(event.index===1)expandedEvents.value=new Set([event.index])
}
function toggleEvent(index:number){const next=new Set(expandedEvents.value);next.has(index)?next.delete(index):next.add(index);expandedEvents.value=next}
function expandAllEvents(){expandedEvents.value=new Set(streamEvents.value.map(event=>event.index))}
function collapseAllEvents(){expandedEvents.value=new Set()}
function eventSummary(data:string){const compact=data.replace(/\s+/g,' ').trim();return compact.length>110?`${compact.slice(0,110)}…`:compact||'空数据'}
function eventLanguage(data:string){try{JSON.parse(data);return 'json'}catch{return 'plaintext'}}
function eventTime(timestamp:number){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',fractionalSecondDigits:3}).format(timestamp)}
function eventBytes(data:string){return new TextEncoder().encode(data).length}

async function executeResponseTests() {
  if (!response.value) return
  testResults.value = await runTests(props.request.tests, response.value)
}

function fetchStreamFallback(payload: ReturnType<typeof buildRequest>, onMessage: (message: StreamMessage) => void) {
  const controller = new AbortController()
  const started = performance.now()
  void (async () => {
    try {
      const headers = new Headers(); payload.headers.forEach(([key, value]) => headers.append(key, value))
      const res = await fetch(payload.url, { method: payload.method, headers, body: ['GET','HEAD'].includes(payload.method) ? undefined : multipartBody(payload), signal: controller.signal, redirect: payload.followRedirects === false ? 'manual' : 'follow' })
      onMessage({ type: 'headers', status: res.status, statusText: res.statusText, headers: Array.from(res.headers.entries()), url: res.url, time: Math.round(performance.now() - started) })
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); let size = 0
      if (reader) while (true) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; onMessage({type:'chunk',chunk:decoder.decode(value,{stream:true}),bytes:value.byteLength}) }
      const tail=decoder.decode();if(tail)onMessage({type:'chunk',chunk:tail,bytes:0})
      onMessage({type:'end',time:Math.round(performance.now()-started),size})
    } catch(error) { onMessage({type:'error',error:controller.signal.aborted?'请求已取消':error instanceof Error?error.message:String(error),time:Math.round(performance.now()-started)}) }
  })()
  return () => controller.abort()
}

function stopStream() {
  streamCleanup?.(); streamCleanup = undefined
  sending.value = false
  if (response.value) Object.assign(response.value, { streaming: false, completed: true })
}
async function copyResponse() { await navigator.clipboard.writeText(responseText.value); copied.value = true; setTimeout(() => copied.value = false, 1200) }
function generateCurl() {
  const built = buildRequest(props.request, props.environment, props.project)
  const command = [`curl -X ${built.method}`, ...built.headers.map(([k,v]) => `-H '${k}: ${v.replaceAll("'", "'\\''")}'`), built.body ? `--data '${built.body.replaceAll("'", "'\\''")}'` : '', `'${built.url}'`].filter(Boolean).join(' \\\n  ')
  navigator.clipboard.writeText(command); copied.value = true; setTimeout(() => copied.value = false, 1200)
}
async function openResponse() {
  const url = response.value?.url
  if (!url) return
  if (window.desktop) await window.desktop.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}
watch(() => props.request.url, () => { response.value = null })
onBeforeUnmount(() => streamCleanup?.())
</script>

<template>
  <section ref="workbenchHost" class="workbench" :class="{embedded}" :style="{'--request-pane':`${requestPaneHeight}px`}">
    <header v-if="title" class="editor-title"><span class="method-mini" :class="request.method.toLowerCase()">{{ request.method }}</span><strong>{{ title }}</strong><span class="dirty-dot"></span></header>
    <div class="request-line">
      <div class="method-picker" :class="request.method.toLowerCase()"><UiSelect compact :model-value="request.method" :options="methodOptions" :tone="request.method.toLowerCase()" @update:model-value="patch('method',$event as RequestData['method'])"/></div>
      <input class="url-input" :value="request.url" placeholder="输入请求地址，例如 {{baseUrl}}/api/users" @input="patch('url', ($event.target as HTMLInputElement).value)" @keydown.enter="send" />
      <button class="send-btn" :class="{ stopping: sending }" :disabled="!request.url" @click="send"><Square v-if="sending" :size="14" fill="currentColor" /><Send v-else :size="16" />{{ sending ? '停止' : '发送' }}</button>
      <button v-if="!embedded" class="primary-split" title="保存" @click="emit('save')"><Save :size="16" /></button>
    </div>

    <div class="request-tabs">
      <button :class="{ active: activeTab === 'params' }" @click="activeTab='params'">参数 <em v-if="tabCount.params">{{ tabCount.params }}</em></button>
      <button :class="{ active: activeTab === 'auth' }" @click="activeTab='auth'">认证</button>
      <button :class="{ active: activeTab === 'headers' }" @click="activeTab='headers'">Header <em>{{ tabCount.headers }}</em></button>
      <button :class="{ active: activeTab === 'body' }" @click="activeTab='body'">Body</button>
      <button :class="{ active: activeTab === 'pre' }" @click="activeTab='pre'">前置脚本</button>
      <button :class="{ active: activeTab === 'tests' }" @click="activeTab='tests'">测试 <em v-if="testResults.length">{{ testResults.length }}</em></button>
      <button :class="{ active: activeTab === 'settings' }" @click="activeTab='settings'">设置</button>
      <span class="tabs-spacer"></span><button class="curl-btn" @click="generateCurl"><Braces :size="14" /> cURL</button>
    </div>

    <div class="request-editor">
      <KeyValueEditor v-if="activeTab==='params'" :model-value="request.params" @update:model-value="patch('params', $event as any)" />
      <div v-else-if="activeTab==='auth'" class="auth-pane form-grid">
        <label>认证类型<UiSelect :model-value="request.auth.type" :options="authOptions" @update:model-value="patch('auth',{...request.auth,type:$event as any})"/></label>
        <template v-if="request.auth.type==='bearer'"><label class="wide">Token<input type="password" :value="request.auth.token" placeholder="支持 {{token}}" @input="patch('auth', {...request.auth, token: ($event.target as HTMLInputElement).value})" /></label></template>
        <template v-if="request.auth.type==='basic'"><label>用户名<input :value="request.auth.username" @input="patch('auth', {...request.auth, username: ($event.target as HTMLInputElement).value})" /></label><label>密码<input type="password" :value="request.auth.password" @input="patch('auth', {...request.auth, password: ($event.target as HTMLInputElement).value})" /></label></template>
        <template v-if="request.auth.type==='apiKey'"><label>Key<input :value="request.auth.key" @input="patch('auth', {...request.auth, key: ($event.target as HTMLInputElement).value})" /></label><label>Value<input :value="request.auth.value" @input="patch('auth', {...request.auth, value: ($event.target as HTMLInputElement).value})" /></label><label>添加到<UiSelect :model-value="request.auth.addTo" :options="apiKeyTargetOptions" @update:model-value="patch('auth',{...request.auth,addTo:$event as any})"/></label></template>
        <div v-if="request.auth.type==='none'" class="empty-inline"><ShieldCheck :size="26" /><span>此请求不使用认证信息</span></div>
      </div>
      <div v-else-if="activeTab==='headers'" class="header-editor"><div class="notice"><Sparkles :size="14" />项目环境中的公共 Header 会自动合并；接口 Header 同名时可选择覆盖或重复传入。</div><KeyValueEditor :model-value="request.headers" header-mode @update:model-value="patch('headers', $event as any)" /></div>
      <div v-else-if="activeTab==='body'" class="body-pane">
        <div class="radio-row"><UiRadioGroup :model-value="request.bodyMode" :options="bodyModeOptions" @update:model-value="patch('bodyMode',$event as any)"/></div>
        <KeyValueEditor v-if="request.bodyMode==='urlencoded'" :model-value="request.formData" @update:model-value="patch('formData', $event as any)" />
        <div v-else-if="request.bodyMode==='form'" class="form-data-pane">
          <div class="form-data-toolbar"><div><strong>文本字段</strong><span>与文件共同作为 multipart/form-data 发送</span></div><button class="soft-btn" @click="pickFiles"><Upload :size="14"/>选择文件</button></div>
          <KeyValueEditor :model-value="request.formData" @update:model-value="patch('formData', $event as any)" />
          <div class="file-upload-section">
            <div class="file-section-title"><Paperclip :size="14"/><strong>文件</strong><em>{{ (request.files || []).length }}</em></div>
            <div v-for="file in (request.files || [])" :key="file.id" class="upload-file-row">
              <UiCheckbox small :model-value="file.enabled" @update:model-value="updateFile(file.id,{enabled:$event})"/>
              <input :value="file.key" placeholder="字段名" @input="updateFile(file.id,{key:($event.target as HTMLInputElement).value})"/>
              <File :size="15"/><span><b>{{ file.fileName }}</b><small>{{ fileSize(file.size) }} · {{ file.mimeType }}</small></span>
              <button class="icon-btn danger-hover" title="移除文件" @click="removeFile(file.id)"><Trash2 :size="14"/></button>
            </div>
            <button v-if="!(request.files || []).length" class="file-drop-zone" @click="pickFiles"><Upload :size="22"/><strong>选择要上传的文件</strong><span>支持多选；文件将随请求以 multipart 发送</span></button>
            <button v-else class="inline-add" @click="pickFiles"><Plus :size="14"/>继续添加文件</button>
          </div>
        </div>
        <MonacoEditor v-else-if="request.bodyMode!=='none'" class="request-monaco" :model-value="request.body" :language="bodyLanguage" :placeholder="bodyPlaceholder" @update:model-value="patch('body', $event)" />
        <div v-else class="empty-inline">此请求没有 Body</div>
      </div>
      <div v-else-if="activeTab==='pre'" class="script-editor"><div class="code-toolbar"><span>JavaScript</span><code>pm.environment · pm.variables · console</code><b>Monaco Editor</b></div><MonacoEditor class="request-monaco" :model-value="request.preRequest" language="javascript" placeholder="// 请求发送前执行\n// pm.environment.set('timestamp', Date.now())" @update:model-value="patch('preRequest',$event)" /></div>
      <div v-else-if="activeTab==='tests'" class="script-editor"><div class="code-toolbar"><span>JavaScript</span><code>pm.response · pm.test · pm.expect</code><b>Monaco Editor</b></div><MonacoEditor class="request-monaco" :model-value="request.tests" language="javascript" placeholder="// 响应后执行\n// pm.test('状态码为 200', () => pm.expect(pm.response.code).to.equal(200))" @update:model-value="patch('tests',$event)" /></div>
      <div v-else class="settings-pane form-grid">
        <label>超时时间 (ms)<UiNumber :model-value="request.settings.timeout" :min="0" :step="1000" suffix="ms" @update:model-value="patch('settings',{...request.settings,timeout:$event})"/></label>
        <label>响应解析模式<UiSelect :model-value="request.settings.responseMode || 'auto'" :options="responseModeOptions" @update:model-value="patch('settings',{...request.settings,responseMode:$event as any})"/></label>
        <label class="toggle-line"><UiCheckbox :model-value="request.settings.followRedirects" label="自动跟随重定向" @update:model-value="patch('settings',{...request.settings,followRedirects:$event})"/></label><label class="toggle-line"><UiCheckbox :model-value="request.settings.validateSSL" label="校验 SSL 证书" @update:model-value="patch('settings',{...request.settings,validateSSL:$event})"/></label>
        <div class="stream-setting-note"><Activity :size="16"/><span><strong>SSE 与流式响应</strong>自动模式根据 Content-Type 判断；非标准服务可强制选择 Data/NDJSON 或原始流。超时设为 0 可持续连接。</span></div>
      </div>
    </div>

    <div class="resize-handle horizontal" title="拖动调整请求和响应区域高度" @pointerdown="resizeRequestPane"></div>

    <div class="response-panel">
      <header class="response-head"><strong>响应</strong><template v-if="response?.ok"><span class="status-code" :class="{ good: (response.status || 0) < 400 }">{{ response.status }} {{ response.statusText }}</span><span><Clock3 :size="13" /> {{ response.time }} ms</span><span>{{ response.size && response.size > 1024 ? (response.size/1024).toFixed(1)+' KB' : response.size+' B' }}</span><span v-if="sending" class="live-indicator"><i></i> LIVE</span><span v-if="isEventStream" class="stream-badge">{{ detectedMode==='standard-sse'?'SSE':detectedMode==='data-stream'?'DATA STREAM':'RAW STREAM' }}</span></template><span v-else-if="response?.error" class="error-text">{{ response.error }}</span><span v-else class="response-placeholder">点击“发送”查看响应</span></header>
      <template v-if="response?.ok">
        <div class="response-tabs"><button :class="{active:responseTab==='body'}" @click="responseTab='body'">Body</button><button v-if="isEventStream" :class="{active:responseTab==='events'}" @click="responseTab='events'">事件流 <em>{{ streamEvents.length }}</em></button><button :class="{active:responseTab==='headers'}" @click="responseTab='headers'">Headers <em>{{ response.headers?.length }}</em></button><button :class="{active:responseTab==='test'}" @click="responseTab='test'">测试结果 <em v-if="testResults.length">{{ testResults.length }}</em></button><span></span><div v-if="responseTab==='events'" class="stream-view-tabs"><button :class="{on:streamView==='event'}" @click="streamView='event'">Event</button><button :class="{on:streamView==='data'}" @click="streamView='data'">Data</button><button :class="{on:streamView==='raw'}" @click="streamView='raw'">Raw</button></div><button @click="pretty=!pretty">{{ pretty ? 'Pretty' : 'Raw' }}</button><button title="复制" @click="copyResponse"><Copy :size="14" /> {{ copied ? '已复制' : '' }}</button><button title="在浏览器打开" :disabled="!response.url" @click="openResponse"><ExternalLink :size="14" /></button></div>
        <div v-if="responseTab==='events' && streamView==='event'" class="event-explorer">
          <div class="event-explorer-toolbar"><span><ListTree :size="14"/><b>{{ streamEvents.length }}</b> 个事件</span><div><button @click="expandAllEvents">全部展开</button><button @click="collapseAllEvents">全部折叠</button></div></div>
          <div v-if="streamEvents.length" class="event-list">
            <article v-for="event in streamEvents" :key="event.index" class="event-card" :class="{expanded:expandedEvents.has(event.index)}">
              <button class="event-card-head" @click="toggleEvent(event.index)">
                <ChevronDown v-if="expandedEvents.has(event.index)" :size="14"/><ChevronRight v-else :size="14"/>
                <span class="event-index">#{{ event.index }}</span><strong>{{ event.event || 'message' }}</strong>
                <code v-if="event.id">id: {{ event.id }}</code><span class="event-summary">{{ eventSummary(event.data) }}</span>
                <time>{{ eventTime(event.timestamp) }}</time><em>{{ eventBytes(event.data) }} B</em>
              </button>
              <div v-if="expandedEvents.has(event.index)" class="event-card-body">
                <dl><template v-if="event.id"><dt>ID</dt><dd>{{ event.id }}</dd></template><template v-if="event.retry"><dt>Retry</dt><dd>{{ event.retry }} ms</dd></template><dt>格式</dt><dd>{{ eventLanguage(event.data)==='json'?'JSON':'Text' }}</dd></dl>
                <div class="event-data-editor"><MonacoEditor :model-value="pretty ? prettyData(event.data) : event.data" :language="eventLanguage(event.data)" readonly :word-wrap="true"/></div>
              </div>
            </article>
          </div>
          <div v-else class="empty-inline"><Activity :size="22"/><span>正在等待事件…</span></div>
        </div>
        <MonacoEditor v-else-if="responseTab==='body' || responseTab==='events'" class="response-monaco" :model-value="responseText" :language="responseLanguage" readonly :word-wrap="true" />
        <div v-else-if="responseTab==='headers'" class="response-headers"><div v-for="([key,value],i) in response.headers" :key="i"><strong>{{ key }}</strong><span>{{ value }}</span></div></div>
        <div v-else-if="testResults.length" class="test-results"><div v-for="(result,index) in testResults" :key="index" :class="{passed:result.passed,failed:!result.passed}"><span>{{ result.passed ? 'PASS' : 'FAIL' }}</span><b>{{ result.name }}</b><small v-if="result.error">{{ result.error }}</small></div></div>
        <div v-else class="empty-inline"><ShieldCheck :size="24" /><span>{{ request.tests.trim() ? '发送请求后执行自动化断言' : '尚未配置自动化断言' }}</span></div>
      </template>
    </div>
  </section>
</template>
