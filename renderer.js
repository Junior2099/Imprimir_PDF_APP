const selectFolderButton = document.getElementById('select-folder');
const folderPathElement = document.getElementById('folder-path');
const fileListElement = document.getElementById('file-list');
const previewImage = document.getElementById('preview-image');
const fileInfoElement = document.getElementById('file-info');
const printerSelect = document.getElementById('printer-select');
const pdfOptionsDiv = document.getElementById('pdf-options');
const imageOptionsDiv = document.getElementById('image-options');
const pageRangeInput = document.getElementById('page-range');
const printButton = document.getElementById('print-button');
const printStatus = document.getElementById('print-status');

let currentFolderPath = null;
let selectedFile = null; 

function showElement(element) {
    element.classList.remove('hidden');
}

function hideElement(element) {
    element.classList.add('hidden');
}

function updatePrintButtonState() {
    printButton.disabled = !selectedFile;
}

async function loadPrinters() {
    const printers = await window.electronAPI.getPrinters();
    printerSelect.innerHTML = ''; 
    if (printers && printers.length > 0) {
        printers.forEach(printerName => {
            const option = document.createElement('option');
            option.value = printerName;
            option.textContent = printerName;
            printerSelect.appendChild(option);
        });
    } else {
    
        const option = document.createElement('option');
        option.value = 'default';
        option.textContent = 'Impressora Padrão';
        printerSelect.appendChild(option);
    }

}


selectFolderButton.addEventListener('click', async () => {
    console.log('Botão de selecionar pasta clicado');
    const folderPath = await window.electronAPI.selectFolderDialog();
    console.log('Pasta selecionada:', folderPath);
    
    if (folderPath) {
        currentFolderPath = folderPath;
        folderPathElement.textContent = `Pasta selecionada: ${folderPath}`;
        
        console.log('Solicitando lista de arquivos...');
        let files;
        try {
            files = await window.electronAPI.listFiles(folderPath);
            console.log('Arquivos recebidos:', files);
        } catch (error) {
            console.error('Erro ao obter lista de arquivos:', error);
            const li = document.createElement('li');
            li.textContent = `Erro ao listar arquivos: ${error.message}`;
            li.style.color = 'red';
            fileListElement.appendChild(li);
            return;
        }
        
        fileListElement.innerHTML = ''; 
        selectedFile = null; 
        updatePrintButtonState();
        previewImage.style.display = 'none';
        fileInfoElement.style.display = 'block';
        fileInfoElement.textContent = 'Selecione um arquivo para pré-visualizar ou ver informações.';
        hideElement(pdfOptionsDiv);
        hideElement(imageOptionsDiv);
        printStatus.textContent = '';

        if (files && files.length > 0) {
            console.log(`Encontrados ${files.length} arquivos suportados`);
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.name;
                li.dataset.fullPath = file.fullPath;
                li.dataset.type = file.type;
                li.addEventListener('click', () => {

                    Array.from(fileListElement.children).forEach(item => item.classList.remove('selected'));
                    li.classList.add('selected');

                    selectedFile = file;
                    updatePrintButtonState();
                    printStatus.textContent = ''; 

            
                    if (file.type === 'pdf') {
                        previewImage.style.display = 'none';
                        fileInfoElement.style.display = 'block';
                        fileInfoElement.textContent = `Arquivo PDF: ${file.name}`;
                        showElement(pdfOptionsDiv);
                        hideElement(imageOptionsDiv);
                        pageRangeInput.value = ''; 
                    } else { 
                        previewImage.src = file.fullPath;
                        previewImage.style.display = 'block';
                        fileInfoElement.style.display = 'none';
                        hideElement(pdfOptionsDiv);
                        showElement(imageOptionsDiv);
                    }
                });
                fileListElement.appendChild(li);
            });
        } else {
            console.log('Nenhum arquivo suportado encontrado');
            const li = document.createElement('li');
            li.textContent = 'Nenhum arquivo suportado nesta pasta.';
            fileListElement.appendChild(li);
        }
    } else {
        console.log('Nenhuma pasta foi selecionada');
    }
});

printButton.addEventListener('click', async () => {
    if (!selectedFile) {
        printStatus.textContent = 'Por favor, selecione um arquivo para imprimir.';
        printStatus.className = 'status-error';
        return;
    }

    const printerName = printerSelect.value || 'default';
    console.log('Imprimindo com impressora:', printerName);

    let printOptions = {};

    if (selectedFile.type === 'pdf') {
        printOptions.pageRange = pageRangeInput.value.trim();
        
    } else { 
        const selectedImageSize = document.querySelector('input[name="image-size"]:checked');
        printOptions.imageSize = selectedImageSize ? selectedImageSize.value : 'full';
    }

    printStatus.textContent = 'Enviando para impressão...';
    printStatus.className = ''; 

    const result = await window.electronAPI.printFile(selectedFile.fullPath, selectedFile.type, printOptions);

    if (result.success) {
        printStatus.textContent = result.message;
        printStatus.className = 'status-success';
    } else {
        printStatus.textContent = `Erro ao imprimir: ${result.message}`;
        printStatus.className = 'status-error';
    }
});

window.addEventListener('DOMContentLoaded', loadPrinters);