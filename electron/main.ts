import { app, BrowserWindow, dialog, ipcMain, nativeTheme, session, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const streamControllers = new Map<string, AbortController>()
app.setName('API Studio')

function iconPath() {
  return path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/api-studio-icon.png' : '../dist/api-studio-icon.png')
}

interface HttpInput {
  url: string
  method: string
  headers: Array<[string, string]>
  body?: string
  multipart?: Array<{ key: string; value?: string; filePath?: string; dataBase64?: string; fileName?: string; mimeType?: string }>
  timeout?: number
  followRedirects?: boolean
  validateSSL?: boolean
}

async function requestBody(input: HttpInput) {
  if (!input.multipart) return input.body
  const form = new FormData()
  for (const part of input.multipart) {
    if (part.filePath || part.dataBase64) {
      const bytes = part.filePath ? await fs.readFile(part.filePath) : Buffer.from(part.dataBase64 || '', 'base64')
      const blob = new Blob([new Uint8Array(bytes)], { type: part.mimeType || 'application/octet-stream' })
      form.append(part.key, blob, part.fileName || path.basename(part.filePath || 'file'))
    } else form.append(part.key, part.value || '')
  }
  return form
}

function mimeForFile(file: string) {
  const extension = path.extname(file).toLowerCase()
  return ({ '.json':'application/json', '.txt':'text/plain', '.csv':'text/csv', '.xml':'application/xml', '.pdf':'application/pdf', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.webp':'image/webp', '.zip':'application/zip' } as Record<string,string>)[extension] || 'application/octet-stream'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1f2023',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL || ''
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(path.join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  app.dock?.setIcon(iconPath())
  ipcMain.handle('store:load', async () => {
    const current=path.join(app.getPath('userData'),'workspace.json')
    const legacy=[path.join(app.getPath('appData'),'apiforge','workspace.json'),path.join(app.getPath('appData'),'API Forge','workspace.json')]
    for(const file of [current,...legacy]){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{}}
    return null
  })

  ipcMain.handle('store:save', async (_event, payload: unknown) => {
    const target = path.join(app.getPath('userData'), 'workspace.json')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, JSON.stringify(payload, null, 2), 'utf8')
    return true
  })

  ipcMain.handle('project:export', async (_event, project: { name: string }) => {
    const result = await dialog.showSaveDialog({
      title: '导出项目', defaultPath: `${project.name}.api-studio.json`,
      filters: [{ name: 'API Studio 项目', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return false
    await fs.writeFile(result.filePath, JSON.stringify(project, null, 2), 'utf8')
    return true
  })

  ipcMain.handle('project:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '导入项目', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'API Studio 项目', extensions: ['json'] }],
    })
    if (result.canceled) return []
    const projects = []
    for (const file of result.filePaths) projects.push(JSON.parse(await fs.readFile(file, 'utf8')))
    return projects
  })

  ipcMain.handle('file:pick', async () => {
    const result = await dialog.showOpenDialog({ title: '选择上传文件', properties: ['openFile', 'multiSelections'] })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(async filePath => {
      const stat = await fs.stat(filePath)
      return { filePath, fileName: path.basename(filePath), mimeType: mimeForFile(filePath), size: stat.size }
    }))
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) return false
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle('http:request', async (_event, input: HttpInput) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), input.timeout || 30000)
    const started = performance.now()
    try {
      if (input.validateSSL === false) session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))
      const headers = new Headers()
      input.headers.forEach(([key, value]) => headers.append(key, value))
      const response = await fetch(input.url, {
        method: input.method, headers,
        body: ['GET', 'HEAD'].includes(input.method) ? undefined : await requestBody(input),
        signal: controller.signal, redirect: input.followRedirects === false ? 'manual' : 'follow',
      })
      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return {
        ok: true, status: response.status, statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        bodyBase64: btoa(binary), time: Math.round(performance.now() - started), size: bytes.length,
        url: response.url,
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), time: Math.round(performance.now() - started) }
    } finally {
      clearTimeout(timeout)
      if (input.validateSSL === false) session.defaultSession.setCertificateVerifyProc(null)
    }
  })

  ipcMain.on('http:stream:start', (event, payload: {
    id: string
    input: HttpInput
  }) => {
    const { id, input } = payload
    const controller = new AbortController()
    streamControllers.set(id, controller)
    const started = performance.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    if (input.timeout && input.timeout > 0) timer = setTimeout(() => controller.abort(), input.timeout)
    const send = (message: unknown) => {
      if (!event.sender.isDestroyed()) event.sender.send('http:stream:event', { id, message })
    }

    void (async () => {
      try {
        if (input.validateSSL === false) session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))
        const headers = new Headers()
        input.headers.forEach(([key, value]) => headers.append(key, value))
        const response = await fetch(input.url, {
          method: input.method,
          headers,
          body: ['GET', 'HEAD'].includes(input.method) ? undefined : await requestBody(input),
          signal: controller.signal,
          redirect: input.followRedirects === false ? 'manual' : 'follow',
        })
        send({
          type: 'headers', status: response.status, statusText: response.statusText,
          headers: Array.from(response.headers.entries()), url: response.url,
          time: Math.round(performance.now() - started),
        })
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let size = 0
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            const chunk = decoder.decode(value, { stream: true })
            if (chunk) send({ type: 'chunk', chunk, bytes: value.byteLength })
          }
          const tail = decoder.decode()
          if (tail) send({ type: 'chunk', chunk: tail, bytes: 0 })
        }
        send({ type: 'end', time: Math.round(performance.now() - started), size })
      } catch (error) {
        const message = controller.signal.aborted ? '请求已取消或超时' : error instanceof Error ? error.message : String(error)
        send({ type: 'error', error: message, time: Math.round(performance.now() - started) })
      } finally {
        if (timer) clearTimeout(timer)
        if (input.validateSSL === false) session.defaultSession.setCertificateVerifyProc(null)
        streamControllers.delete(id)
      }
    })()
  })

  ipcMain.on('http:stream:cancel', (_event, id: string) => {
    streamControllers.get(id)?.abort()
    streamControllers.delete(id)
  })

  ipcMain.on('theme:set', (_event, value: 'light' | 'dark' | 'system') => { nativeTheme.themeSource = value })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
