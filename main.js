const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const printer = require('node-printer');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 960,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
     
        autoHideMenuBar: true 
      
    });

    mainWindow.loadFile('index.html');
 
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.handle('select-folder-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!canceled && filePaths.length > 0) {
        return filePaths[0]; 
    }
    return null;
});


ipcMain.handle('list-files-in-folder', async (event, folderPath) => {
    try {
        console.log('Tentando listar arquivos em:', folderPath);
        
   
        const fsSync = require('fs');
        if (!fsSync.existsSync(folderPath)) {
            console.error('Caminho não existe:', folderPath);
            return [];
        }
        
    
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) {
            console.error('Caminho não é um diretório:', folderPath);
            return [];
        }
        
        const files = await fs.readdir(folderPath);
        console.log('Arquivos encontrados:', files);
        
        const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];
        const filteredFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            const isSupported = supportedExtensions.includes(ext);
            console.log(`Arquivo: ${file}, Extensão: ${ext}, Suportado: ${isSupported}`);
            return isSupported;
        }).map(file => {
            const ext = path.extname(file).toLowerCase();
            return {
                name: file,
                fullPath: path.join(folderPath, file),
                type: ext.substring(1) 
            };
        });
        
        console.log('Arquivos filtrados:', filteredFiles);
        return filteredFiles;
    } catch (error) {
        console.error("Erro ao listar arquivos:", error);
        return [];
    }
});


ipcMain.handle('get-printers', async () => {
    try {
        const { stdout } = await execAsync('lpstat -d');
        if (stdout && stdout.includes(':')) {
            const defaultPrinter = stdout.split(':')[1].trim();
            console.log('Impressora padrão encontrada:', defaultPrinter);
            return [defaultPrinter];
        } else {
            console.log('Usando impressora padrão do sistema');
            return ['Impressora Padrão'];
        }
    } catch (error) {
        console.error("Erro ao obter impressora padrão:", error);
      
        return ['Impressora Padrão'];
    }
});

async function printWithSystemCommand(filePath, fileType, printOptions) {
    try {
        
        const fsSync = require('fs');
        if (!fsSync.existsSync(filePath)) {
            return { success: false, message: `Arquivo não encontrado: ${filePath}` };
        }
        
        let command = `lp "${filePath}"`;
        
        if (fileType === 'pdf' && printOptions.pageRange) {
            command = `lp -o page-ranges=${printOptions.pageRange} "${filePath}"`;
        }
        
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileType)) {
            if (printOptions.imageSize === 'half') {
                command = `lp -o fit-to-page -o scaling=50 "${filePath}"`;
            } else {
                command = `lp -o fit-to-page "${filePath}"`;
            }
        }
        
        console.log('Executando comando de impressão:', command);
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr) {
            console.warn('Aviso do comando de impressão:', stderr);
        }
        
        console.log('Resultado da impressão:', stdout);
        
        if (stdout && stdout.includes('id de requisição')) {
            return { success: true, message: `Arquivo enviado para impressão. ${stdout.trim()}` };
        } else {
            return { success: true, message: "Arquivo enviado para impressão via comando do sistema." };
        }
        
    } catch (error) {
        console.error("Erro ao imprimir com comando do sistema:", error);
        return { success: false, message: `Erro de impressão: ${error.message}` };
    }
}

ipcMain.handle('print-file', async (event, filePath, fileType, printOptions) => {
    try {
        let printerName = 'default'; 
        
        try {
            const defaultPrinter = printer.getDefaultPrinter();
            if (defaultPrinter) {
                printerName = defaultPrinter.name;
                console.log('Usando impressora padrão:', printerName);
            }
        } catch (printerError) {
            console.log('Usando impressora padrão do sistema (fallback)');
        }

        let options = {
            printer: printerName,
            type: 'RAW', // Tipo de dado, 'RAW' para a maioria dos casos
            // title: `Imprimindo ${path.basename(filePath)}`, // Título do trabalho na fila de impressão
            // pageRanges: '', // Para PDF
            // media: 'A4', // Tamanho do papel (opções CUPS)
            // scale: 'fit-to-page' // Opções CUPS para imagens
        };

        if (fileType === 'pdf' && printOptions.pageRange) {
             options.printJob = printOptions.pageRange; // '1-5', '3' etc. CUPS entende isso.
             // O `node-printer` pode ter nuances sobre como passar page ranges.
             // Pode ser necessário usar `printer.printDirect` ou um método específico para PDF.
             // Para controle fino de PDF, muitas vezes usa-se uma ferramenta externa como `pdfunite` ou `gs` (Ghostscript)
             // para pré-processar o PDF antes de enviá-lo para a impressora.
             // Exemplo simplificado para CUPS via `lp`:
             // const { exec } = require('child_process');
             // exec(`lp -d ${printerName} -o page-ranges=${printOptions.pageRange} "${filePath}"`, (error, stdout, stderr) => { /* ... */ });
             // Ou usar a biblioteca `cups` do npm se ela oferecer melhor controle.
             // Para `node-printer` pode ser mais direto para o arquivo inteiro.
        }

        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileType)) {
        
            if (printOptions.imageSize === 'full') {
   
            } else if (printOptions.imageSize === 'half') {
  
            }
        }
        
   
        console.log("Usando comando do sistema para impressão");
        return await printWithSystemCommand(filePath, fileType, printOptions);

    } catch (error) {
        console.error("Erro no handler print-file:", error);
        return { success: false, message: error.message };
    }
});