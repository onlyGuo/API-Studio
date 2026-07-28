import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (data: unknown) => ipcRenderer.invoke('store:save', data),
  exportProject: (project: unknown) => ipcRenderer.invoke('project:export', project),
  importProject: () => ipcRenderer.invoke('project:import'),
  pickFiles: () => ipcRenderer.invoke('file:pick'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  request: (input: unknown) => ipcRenderer.invoke('http:request', input),
  requestStream: (input: unknown, onMessage: (message: unknown) => void) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; message: unknown }) => {
      if (payload.id === id) onMessage(payload.message)
    }
    ipcRenderer.on('http:stream:event', listener)
    ipcRenderer.send('http:stream:start', { id, input })
    return () => {
      ipcRenderer.send('http:stream:cancel', id)
      ipcRenderer.removeListener('http:stream:event', listener)
    }
  },
  setTheme: (value: string) => ipcRenderer.send('theme:set', value),
})
