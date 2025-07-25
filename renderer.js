document.addEventListener('DOMContentLoaded', () => {
  // Elementos da UI
  const ui = {
    chooseBtn: document.getElementById('choose-folder'),
    fileList: document.getElementById('file-list'),
    modal: document.getElementById('modal'),
    pageInput: document.getElementById('page-input'),
    imageSizeSelect: document.getElementById('image-size'),
    printBtn: document.getElementById('print-btn'),
    closeBtn: document.getElementById('close-modal'),
    preview: document.getElementById('preview'),
    fileNameDisplay: document.getElementById('file-name'),
    loadingIndicator: createLoadingIndicator()
  };

  // Estado da aplicação
  const state = {
    currentFile: null,
    isLoading: false
  };

  // Verificação da API
  if (!window.electronAPI) {
    showAlert('Erro: Aplicação não está funcionando corretamente', 'error');
    return;
  }

  // Event Listeners
  ui.chooseBtn.addEventListener('click', () => handleSelectFolder(ui, state));
  
  // Usando event delegation para os itens da lista
  ui.fileList.addEventListener('click', (e) => {
    const listItem = e.target.closest('.file-item');
    if (listItem) {
      const filePath = listItem.dataset.filePath;
      if (filePath) {
        openPrintModal(filePath, ui, state);
      }
    }
  });

  ui.printBtn.addEventListener('click', () => handlePrint(ui, state));
  ui.closeBtn.addEventListener('click', () => closeModal(ui, state));
  
  // Inicialização
  document.body.appendChild(ui.loadingIndicator);
});

// Handlers principais
async function handleSelectFolder(ui, state) {
  try {
    setLoading(ui, state, true, 'Carregando arquivos...');
    
    const files = await window.electronAPI.selectFolder();
    ui.fileList.innerHTML = '';
    
    if (!files?.length) {
      showAlert('Nenhum arquivo encontrado', 'info');
      return;
    }

    files.forEach(file => {
      ui.fileList.appendChild(createFileItem(file));
    });

  } catch (error) {
    showAlert(`Erro: ${error.message}`, 'error');
    console.error('Erro ao carregar pasta:', error);
  } finally {
    setLoading(ui, state, false);
  }
}

async function handlePrint(ui, state) {
  if (!state.currentFile) return;

  try {
    setLoading(ui, state, true, 'Preparando impressão...');
    
    const result = await window.electronAPI.printFile(
      state.currentFile,
      ui.pageInput.value,
      ui.imageSizeSelect.value
    );

    if (result.success) {
      showAlert('Impressão enviada com sucesso!', 'success');
    } else {
      console.error('Falha na impressão:', result.errorDetails);
      showAlert(result.message, 'error');
    }

  } catch (error) {
    console.error('Erro inesperado:', error);
    showAlert(`Erro: ${error.message}`, 'error');
  } finally {
    setLoading(ui, state, false);
    closeModal(ui, state);
  }
}

// Funções de UI
function openPrintModal(filePath, ui, state) {
  const isPDF = filePath.toLowerCase().endsWith('.pdf');
  
  state.currentFile = filePath;
  ui.fileNameDisplay.textContent = getFileName(filePath);
  
  // Configura a UI conforme o tipo de arquivo
  ui.pageInput.style.display = isPDF ? 'block' : 'none';
  ui.imageSizeSelect.style.display = isPDF ? 'none' : 'block';
  ui.preview.style.display = isPDF ? 'none' : 'block';
  
  if (!isPDF) {
    ui.preview.src = `file://${filePath}`;
    ui.preview.onerror = () => {
      ui.preview.style.display = 'none';
    };
  }
  
  ui.modal.style.display = 'flex';
}

function closeModal(ui, state) {
  ui.modal.style.display = 'none';
  state.currentFile = null;
  ui.pageInput.value = ''; // Limpa o input de páginas
}

function createFileItem(filePath) {
  const item = document.createElement('li');
  item.className = 'file-item';
  item.dataset.filePath = filePath; // Armazena o caminho completo
  
  const isPDF = filePath.toLowerCase().endsWith('.pdf');
  const fileName = getFileName(filePath);
  
  // Ícone
  const icon = document.createElement('span');
  icon.className = 'file-icon';
  icon.textContent = isPDF ? '📄' : '🖼️';
  
  // Nome do arquivo
  const name = document.createElement('span');
  name.className = 'file-name';
  name.textContent = fileName;
  
  // Thumbnail para imagens
  if (!isPDF) {
    const thumb = document.createElement('img');
    thumb.src = `file://${filePath}`;
    thumb.className = 'file-thumb';
    thumb.alt = `Thumbnail ${fileName}`;
    item.appendChild(thumb);
  }
  
  item.appendChild(icon);
  item.appendChild(name);
  
  return item;
}

function setLoading(ui, state, isLoading, message = '') {
  state.isLoading = isLoading;
  
  if (isLoading) {
    ui.loadingIndicator.querySelector('.loading-text').textContent = message || 'Processando...';
    ui.loadingIndicator.style.display = 'flex';
    document.body.style.pointerEvents = 'none';
  } else {
    ui.loadingIndicator.style.display = 'none';
    document.body.style.pointerEvents = 'auto';
  }
}

function createLoadingIndicator() {
  const loader = document.createElement('div');
  loader.className = 'loading-overlay';
  
  loader.innerHTML = `
    <div class="loading-content">
      <div class="spinner"></div>
      <span class="loading-text"></span>
    </div>
  `;
  
  return loader;
}

function showAlert(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  document.body.appendChild(alert);
  
  setTimeout(() => {
    alert.classList.add('fade-out');
    setTimeout(() => alert.remove(), 500);
  }, 3000);
}

function getFileName(fullPath) {
  return fullPath.split(/[\\/]/).pop();
}