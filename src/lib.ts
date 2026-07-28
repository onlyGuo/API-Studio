import type { ApiHeader, Environment, KeyValue, Project, RequestData, ResponseData, ScriptItem, Workspace } from './types'

export const uid = () => crypto.randomUUID()
export const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const row = (key = '', value = ''): KeyValue => ({ id: uid(), enabled: true, key, value, description: '' })
export const headerRow = (key = '', value = ''): ApiHeader => ({ ...row(key, value), conflict: 'override' })

export function emptyRequest(method: RequestData['method'] = 'GET', defaultTimeout = 30000): RequestData {
  return {
    method, url: '', params: [row()], headers: [headerRow()], bodyMode: 'none', body: '', formData: [row()], files: [],
    auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', addTo: 'header' },
    preRequest: '', tests: '', settings: { timeout: defaultTimeout, followRedirects: true, validateSSL: true, responseMode: 'auto' },
  }
}

export function createProject(name = '我的项目', defaultTimeout = 30000): Project {
  const envId = uid()
  return {
    id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), activeEnvironmentId: envId,
    environments: [{ id: envId, name: '开发环境', variables: [row('baseUrl', 'https://httpbin.org')], headers: [row()] }],
    scripts: [], nodes: [],
  }
}

export function initialWorkspace(): Workspace {
  const project = createProject('示例项目')
  const folderId = uid()
  project.nodes.push(
    { id: folderId, type: 'folder', name: '快速开始', parentId: null, expanded: true },
    { id: uid(), type: 'request', name: '查询请求信息', parentId: folderId, request: { ...emptyRequest('GET', 30000), url: '{{baseUrl}}/anything', params: [row('hello', 'world'), row()] } },
  )
  return { version: 1, theme: 'dark', activeProjectId: project.id, projects: [project], preferences: { editorFontSize: 12, defaultTimeout: 30000, compactMode: false } }
}

export function getByPath(value: unknown, path: string): unknown {
  if (!path.trim() || path.trim() === '$') return value
  const keys = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
  return keys.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') return (current as Record<string, unknown>)[key]
    return undefined
  }, value)
}

export function variableMap(project: Project, environment: Environment): Record<string, string> {
  const map: Record<string, string> = {}
  environment.variables.filter(v => v.enabled && v.key).forEach(v => { map[v.key] = v.value })
  project.scripts.forEach(script => {
    if (script.outputVariable && script.cache && script.cache.expiresAt > Date.now()) {
      map[script.outputVariable] = typeof script.cache.value === 'string' ? script.cache.value : JSON.stringify(script.cache.value)
    }
  })
  return map
}

export function interpolate(input: string, vars: Record<string, string>): string {
  let result = input
  for (let i = 0; i < 8; i++) {
    const next = result.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (all, key: string) => key in vars ? vars[key] : all)
    if (next === result) break
    result = next
  }
  return result
}

function base64ToText(value: string) {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function responseFromDesktop(raw: any): ResponseData {
  return raw.ok ? { ...raw, body: base64ToText(raw.bodyBase64) } : raw
}

export function buildRequest(request: RequestData, env: Environment, project: Project, runtimeVariables: Record<string, string> = {}) {
  const vars = { ...variableMap(project, env), ...runtimeVariables }
  let url = interpolate(request.url, vars)
  const urlObject = new URL(url)
  request.params.filter(p => p.enabled && p.key).forEach(p => urlObject.searchParams.append(interpolate(p.key, vars), interpolate(p.value, vars)))

  const headers: Array<[string, string]> = []
  env.headers.filter(h => h.enabled && h.key).forEach(h => headers.push([interpolate(h.key, vars), interpolate(h.value, vars)]))
  request.headers.filter(h => h.enabled && h.key).forEach(h => {
    const key = interpolate(h.key, vars)
    if (h.conflict === 'override') {
      for (let i = headers.length - 1; i >= 0; i--) if (headers[i][0].toLowerCase() === key.toLowerCase()) headers.splice(i, 1)
    }
    headers.push([key, interpolate(h.value, vars)])
  })

  if (request.auth.type === 'bearer' && request.auth.token) headers.push(['Authorization', `Bearer ${interpolate(request.auth.token, vars)}`])
  if (request.auth.type === 'basic') headers.push(['Authorization', `Basic ${btoa(`${interpolate(request.auth.username, vars)}:${interpolate(request.auth.password, vars)}`)}`])
  if (request.auth.type === 'apiKey' && request.auth.key) {
    const pair: [string, string] = [interpolate(request.auth.key, vars), interpolate(request.auth.value, vars)]
    if (request.auth.addTo === 'header') headers.push(pair)
    else urlObject.searchParams.append(...pair)
  }

  let body: string | undefined
  if (request.bodyMode === 'json' || request.bodyMode === 'text') body = interpolate(request.body, vars)
  if (request.bodyMode === 'urlencoded') {
    const form = new URLSearchParams()
    request.formData.filter(v => v.enabled && v.key).forEach(v => form.append(interpolate(v.key, vars), interpolate(v.value, vars)))
    body = form.toString()
    if (!headers.some(([key]) => key.toLowerCase() === 'content-type')) headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
  }
  if (request.bodyMode === 'json' && !headers.some(([key]) => key.toLowerCase() === 'content-type')) headers.push(['Content-Type', 'application/json'])
  let multipart: Array<{ key: string; value?: string; filePath?: string; dataBase64?: string; fileName?: string; mimeType?: string }> | undefined
  if (request.bodyMode === 'form') {
    for (let i = headers.length - 1; i >= 0; i--) if (headers[i][0].toLowerCase() === 'content-type') headers.splice(i, 1)
    multipart = []
    request.formData.filter(item => item.enabled && item.key).forEach(item => multipart?.push({ key: interpolate(item.key, vars), value: interpolate(item.value, vars) }))
    ;(request.files || []).filter(file => file.enabled && file.key).forEach(file => multipart?.push({ key: interpolate(file.key, vars), filePath: file.filePath, dataBase64: file.dataBase64, fileName: file.fileName, mimeType: file.mimeType }))
  }
  return {
    url: urlObject.toString(), method: request.method, headers, body, multipart,
    timeout: request.settings.timeout,
    followRedirects: request.settings.followRedirects,
    validateSSL: request.settings.validateSSL,
  }
}

export async function runScript(script: ScriptItem, project: Project, env: Environment): Promise<ResponseData> {
  const payload = buildRequest(script.request, env, project)
  const raw = window.desktop ? await window.desktop.request(payload) : await browserRequest(payload)
  return responseFromDesktop(raw)
}

async function browserRequest(input: ReturnType<typeof buildRequest>) {
  const started = performance.now()
  try {
    const headers = new Headers()
    input.headers.forEach(([k, v]) => headers.append(k, v))
    let body: BodyInit | undefined = input.body
    if (input.multipart) {
      const form = new FormData()
      for (const part of input.multipart) {
        if (part.dataBase64) {
          const binary = atob(part.dataBase64); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
          form.append(part.key, new Blob([bytes], { type: part.mimeType || 'application/octet-stream' }), part.fileName || 'file')
        } else if (!part.filePath) form.append(part.key, part.value || '')
      }
      body = form
    }
    const response = await fetch(input.url, { method: input.method, headers, body: ['GET', 'HEAD'].includes(input.method) ? undefined : body, redirect: input.followRedirects === false ? 'manual' : 'follow' })
    const text = await response.text()
    const bytes = new TextEncoder().encode(text)
    let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte) })
    return { ok: true, status: response.status, statusText: response.statusText, headers: Array.from(response.headers.entries()), bodyBase64: btoa(binary), time: Math.round(performance.now() - started), size: bytes.length, url: response.url }
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error), time: Math.round(performance.now() - started) } }
}
