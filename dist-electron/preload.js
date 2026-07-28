import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
    load: () => ipcRenderer.invoke('store:load'),
    save: (data) => ipcRenderer.invoke('store:save', data),
    exportProject: (project) => ipcRenderer.invoke('project:export', project),
    importProject: () => ipcRenderer.invoke('project:import'),
    pickFiles: () => ipcRenderer.invoke('file:pick'),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    request: (input) => ipcRenderer.invoke('http:request', input),
    requestStream: (input, onMessage) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const listener = (_event, payload) => {
            if (payload.id === id)
                onMessage(payload.message);
        };
        ipcRenderer.on('http:stream:event', listener);
        ipcRenderer.send('http:stream:start', { id, input });
        return () => {
            ipcRenderer.send('http:stream:cancel', id);
            ipcRenderer.removeListener('http:stream:event', listener);
        };
    },
    setTheme: (value) => ipcRenderer.send('theme:set', value),
});
