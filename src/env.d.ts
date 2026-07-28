/// <reference types="vite/client" />

interface DesktopApi {
  load(): Promise<unknown>
  save(data: unknown): Promise<boolean>
  exportProject(project: unknown): Promise<boolean>
  importProject(): Promise<unknown[]>
  pickFiles(): Promise<Array<{ filePath: string; fileName: string; mimeType: string; size: number }>>
  openExternal(url: string): Promise<boolean>
  request(input: unknown): Promise<any>
  requestStream(input: unknown, onMessage: (message: import('./types').StreamMessage) => void): () => void
  setTheme(value: string): void
}

declare global { interface Window { desktop?: DesktopApi } }
export {}
