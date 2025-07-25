const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const config = {
  supportedFileTypes: /\.(pdf|png|jpg|jpeg|bmp|gif)$/i,
  printRetries: 3,
  printRetryDelay: 1000,
  pdfLoadTimeout: 5000,
  imageLoadTimeout: 2000,
  defaultFolder: process.platform === 'linux' ? '/home' : undefined
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

ipcMain.handle('select-folder', handleSelectFolder);
ipcMain.handle('print-file', handlePrintFile);

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
    handleFileError(error);
    return [];
  }
}

function readFolderContents(folderPath) {
  try {
    return fs.readdirSync(folderPath)
      .filter(file => isValidFile(file, folderPath))
      .map(file => getFullPath(file, folderPath))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    handleFileError(error);
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

function getFullPath(file, folderPath) {
  return path.join(folderPath, file).replace(/\\/g, '/');
}

function handleFileError(error) {
  if (error.code === 'EACCES') {
    console.error('Permissão negada:', error.path);
  } else {
    console.error('Erro ao acessar arquivo:', error);
  }
}

async function handlePrintFile(_, filePath, pageRanges, imageSize) {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    const isPDF = filePath.toLowerCase().endsWith('.pdf');
    const normalizedPath = normalizePath(filePath);

    if (!(await verifyFileExists(normalizedPath))) {
      throw new Error('Arquivo não encontrado');
    }

    const printOptions = createPrintOptions(isPDF, pageRanges);

    if (isPDF) {
      await loadPDF(printWindow, normalizedPath);
    } else {
      await loadImage(printWindow, normalizedPath, imageSize);
    }

    const success = await printWithRetry(printWindow.webContents, printOptions);
    if (!success) throw new Error('Falha ao comunicar com a impressora');

    return { success: true, message: 'Impressão enviada' };
  } catch (error) {
    console.error('Erro na impressão:', error);
    return { 
      success: false, 
      message: `Erro: ${error.message}`,
      details: process.platform === 'linux' ? 'Verifique a impressora padrão' : ''
    };
  } finally {
    safeCloseWindow(printWindow);
  }
}

function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, '/');
}

async function verifyFileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function createPrintOptions(isPDF, pageRanges) {
  const options = {
    silent: process.platform === 'linux', // Linux mostra diálogo nativo
    printBackground: true,
    deviceName: '',
    margins: { marginType: 'default' }
  };

  if (isPDF && pageRanges?.trim()) {
    options.pageRanges = parsePageRanges(pageRanges);
  }

  return options;
}

async function loadPDF(window, filePath) {
  await window.loadURL(`file://${filePath}`);
  await waitForLoad(window, config.pdfLoadTimeout);
}

async function loadImage(window, filePath, imageSize) {
  const html = createImageHtml(filePath, imageSize);
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await waitForLoad(window, config.imageLoadTimeout);
}

function createImageHtml(imagePath, size) {
  const sizeStyle = size === 'half' ? '50%' : '100%';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
          img { max-width: ${sizeStyle}; max-height: ${sizeStyle}; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="file://${imagePath}" onerror="window.onError()">
        <script>
          window.onError = () => document.body.innerHTML = '<p style="color:red">Erro ao carregar imagem</p>';
        </script>
      </body>
    </html>
  `;
}

async function waitForLoad(window, timeout) {
  await Promise.race([
    new Promise(resolve => window.webContents.on('did-finish-load', resolve)),
    new Promise(resolve => setTimeout(resolve, timeout))
  ]);
}

async function printWithRetry(webContents, options, attempt = 1) {
  try {
    return await webContents.print(options);
  } catch (error) {
    if (attempt >= config.printRetries) throw error;
    await new Promise(r => setTimeout(r, config.printRetryDelay * attempt));
    return printWithRetry(webContents, options, attempt + 1);
  }
}

function safeCloseWindow(window) {
  setTimeout(() => {
    try {
      if (!window.isDestroyed()) window.close();
    } catch (error) {
      console.error('Erro ao fechar janela:', error);
    }
  }, 1000);
}

function parsePageRanges(input) {
  if (!input?.trim()) return [];
  
  return input.split(',')
    .map(x => x.trim())
    .filter(Boolean)
    .flatMap(range => {
      if (/^\d+$/.test(range)) {
        const num = parseInt(range);
        return num > 0 ? [{ from: num, to: num }] : [];
      }
      
      if (/^\d+-\d+$/.test(range)) {
        const [from, to] = range.split('-').map(Number);
        return from > 0 && to >= from ? [{ from, to }] : [];
      }
      
      return [];
    });
}