const { contextBridge, ipcRenderer } = require('electron')

// Exponha APIs seguras para o processo de renderização
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  printFile: (filePath, pageRanges, imageSize) => 
    ipcRenderer.invoke('print-file', filePath, pageRanges, imageSize)
})

// Adicione um handler para erros
window.addEventListener('error', (error) => {
  ipcRenderer.send('renderer-error', error.message)
})