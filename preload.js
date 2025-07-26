const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolderDialog: () => {
        console.log('Preload: selectFolderDialog chamado');
        return ipcRenderer.invoke('select-folder-dialog');
    },
    listFiles: (folderPath) => {
        console.log('Preload: listFiles chamado com path:', folderPath);
        return ipcRenderer.invoke('list-files-in-folder', folderPath);
    },
    getPrinters: () => {
        console.log('Preload: getPrinters chamado');
        return ipcRenderer.invoke('get-printers');
    },
    printFile: (filePath, fileType, printOptions) => {
        console.log('Preload: printFile chamado');
        return ipcRenderer.invoke('print-file', filePath, fileType, printOptions);
    }
});