const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const printer = require('pdf-to-printer');

const isLinux = process.platform === 'linux';

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
  win.removeMenu();
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) return [];

  const folderPath = result.filePaths[0];
  console.log('[📁] Pasta selecionada:', folderPath);

  const files = fs.readdirSync(folderPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => path.join(folderPath, f));

  console.log('[📄] PDFs encontrados:', files);
  return files;
});

ipcMain.handle('print-pdf', async (_, filePath, page) => {
  console.log(`[🖨️] Solicitando impressão de: ${filePath} | Páginas: ${page}`);

  if (isLinux) {

    return new Promise((resolve) => {
      const command = `lp -o media=A4 -P ${page} "${filePath}"`;
      console.log('[🧾] Comando Linux:', command);

      exec(command, (err, stdout, stderr) => {
        if (err) {
          console.error('[❌] Erro na impressão Linux:', stderr);
          resolve(`Erro ao imprimir: ${stderr}`);
        } else {
          console.log('[✅] Impressão enviada com sucesso (Linux):', stdout);
          resolve('Impressão enviada com sucesso!');
        }
      });
    });

  } else {

    try {
      await printer.print(filePath, {
        pages: page,
        printFile: true
      });
      console.log('[✅] Impressão enviada com sucesso (Windows/macOS)');
      return 'Impressão enviada com sucesso!';
    } catch (err) {
      console.error('[❌] Erro na impressão:', err);
      return `Erro ao imprimir: ${err.message}`;
    }
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});