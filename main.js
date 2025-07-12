const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const printer = require('pdf-to-printer')

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  win.loadFile('index.html')
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (result.canceled) return []

  const folderPath = result.filePaths[0]
  console.log('Pasta selecionada:', folderPath)

  const files = fs.readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(folderPath, f))

  console.log('PDFs encontrados:', files)
  return files
})

ipcMain.handle('print-pdf', async (_, filePath, page) => {
  console.log(`Imprimindo ${filePath} na(s) página(s) ${page}`)
  try {
    await printer.print(filePath, {
      pages: page,
      printFile: true
    })
    return 'Impressão enviada com sucesso!'
  } catch (err) {
    console.error('Erro ao imprimir:', err)
    return `Erro: ${err.message}`
  }
})

app.whenReady().then(createWindow)
