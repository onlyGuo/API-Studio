export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type KeyValue = { id: string; enabled: boolean; key: string; value: string; description?: string }
export type ApiHeader = KeyValue & { conflict: 'override' | 'append' }
export type BodyMode = 'none' | 'json' | 'text' | 'form' | 'urlencoded'

export interface UploadFile {
  id: string
  enabled: boolean
  key: string
  fileName: string
  filePath?: string
  dataBase64?: string
  mimeType: string
  size: number
}

export interface RequestData {
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: ApiHeader[]
  bodyMode: BodyMode
  body: string
  formData: KeyValue[]
  files: UploadFile[]
  auth: { type: 'none' | 'bearer' | 'basic' | 'apiKey'; token: string; username: string; password: string; key: string; value: string; addTo: 'header' | 'query' }
  preRequest: string
  tests: string
  settings: {
    timeout: number
    followRedirects: boolean
    validateSSL: boolean
    responseMode: 'auto' | 'standard-sse' | 'data-stream' | 'raw-stream'
  }
}

export interface ApiNode {
  id: string
  type: 'folder' | 'request'
  name: string
  parentId: string | null
  expanded?: boolean
  request?: RequestData
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
  headers: KeyValue[]
}

export interface ScriptItem {
  id: string
  name: string
  request: RequestData
  outputPath: string
  outputVariable: string
  ttlMinutes: number
  cache?: { value: unknown; expiresAt: number; updatedAt: number }
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  environments: Environment[]
  activeEnvironmentId: string
  scripts: ScriptItem[]
  nodes: ApiNode[]
}

export interface Workspace {
  version: 1
  theme: 'light' | 'dark'
  activeProjectId: string
  projects: Project[]
  preferences: {
    editorFontSize: number
    defaultTimeout: number
    compactMode: boolean
  }
}

export interface ResponseData {
  ok: boolean
  status?: number
  statusText?: string
  headers?: Array<[string, string]>
  body?: string
  time: number
  size?: number
  url?: string
  error?: string
  streaming?: boolean
  completed?: boolean
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface SseEvent {
  index: number
  event: string
  data: string
  id?: string
  retry?: number
  raw: string
  timestamp: number
}

export type StreamMessage =
  | { type: 'headers'; status: number; statusText: string; headers: Array<[string, string]>; url: string; time: number }
  | { type: 'chunk'; chunk: string; bytes: number }
  | { type: 'end'; time: number; size: number }
  | { type: 'error'; error: string; time: number }
