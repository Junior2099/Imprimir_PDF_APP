const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const printer = require('pdf-to-printer');

const config = {
  supportedFileTypes: /\.(pdf|png|jpg|jpeg|bmp|gif)$/i,
  defaultFolder: process.platform === 'linux' ? '/home' : undefined,
  pdfLoadTimeout: 5000,
  imageLoadTimeout: 2000
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    icon: getPlatformIcon()
  });

  mainWindow.loadFile('index.html');
}

function getPlatformIcon() {
  const iconName = process.platform === 'win32' ? 'icon.ico' :
                   process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
  return path.join(__dirname, 'assets', iconName);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('select-folder', handleSelectFolder);
ipcMain.handle('print-file', handlePrintFile);

// ======= Funções ========

async function handleSelectFolder() {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Selecione uma pasta',
      defaultPath: config.defaultFolder,
      buttonLabel: 'Selecionar'
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const folderPath = result.filePaths[0];
    return readFolderContents(folderPath);
  } catch (error) {
    console.error('Erro ao selecionar pasta:', error);
    return [];
  }
}

function readFolderContents(folderPath) {
  try {
    return fs.readdirSync(folderPath)
      .filter(file => isValidFile(file, folderPath))
      .map(file => path.join(folderPath, file).replace(/\\/g, '/'))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error('Erro ao ler arquivos:', error);
    return [];
  }
}

function isValidFile(file, folderPath) {
  const fullPath = path.join(folderPath, file);
  try {
    return config.supportedFileTypes.test(file) &&
           fs.statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

async function handlePrintFile(_, filePath, pageRanges, imageSize) {
  try {
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    const normalizedPath = path.normalize(filePath);

    if (!await fileExists(normalizedPath)) {
      throw new Error('Arquivo não encontrado');
    }

    if (isPDF) {
      // PDF: usa pdf-to-printer (mais confiável)
      const options = pageRanges?.trim()
        ? { pages: pageRanges.replace(/ /g, '') }
        : {};
      await printer.print(normalizedPath, options);
      return { success: true, message: 'Impressão enviada' };
    } else {
      // Imagem: fallback usando janela invisível
      return await printImageViaWindow(normalizedPath, imageSize);
    }

  } catch (error) {
    console.error('Erro ao imprimir:', error);
    return {
      success: false,
      message: `Erro: ${error.message}`,
      details: process.platform === 'linux' ? 'Verifique a impressora padrão' : ''
    };
  }
}

async function printImageViaWindow(imagePath, imageSize) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true
    }
  });

  try {
    const html = generateImageHtml(imagePath, imageSize);
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await waitForLoad(printWindow, config.imageLoadTimeout);
    await printWindow.webContents.print({
      silent: process.platform === 'linux',
      printBackground: true
    });
    return { success: true, message: 'Imagem enviada para impressão' };
  } catch (error) {
    throw new Error('Erro ao imprimir imagem: ' + error.message);
  } finally {
    safeCloseWindow(printWindow);
  }
}

function generateImageHtml(imagePath, size) {
  const scale = size === 'half' ? '50%' : '100%';
  return `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          img {
            max-width: ${scale};
            max-height: ${scale};
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="file://${imagePath}" />
      </body>
    </html>
  `;
}

function waitForLoad(window, timeout) {
  return Promise.race([
    new Promise(resolve => window.webContents.once('did-finish-load', resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ao carregar')), timeout))
  ]);
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function safeCloseWindow(window) {
  setTimeout(() => {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }, 1000);
}
