const { ipcRenderer } = require('electron')

const button = document.getElementById('choose-folder')
const list = document.getElementById('pdf-list')
const modal = document.getElementById('modal')
const pageInput = document.getElementById('page-input')
const modalOk = document.getElementById('modal-ok')
const modalCancel = document.getElementById('modal-cancel')
const selectedFileEl = document.getElementById('selected-file')

let currentFile = null

button.addEventListener('click', async () => {
  console.log('Selecionando pasta...')
  const files = await ipcRenderer.invoke('select-folder')
  console.log('Arquivos encontrados:', files)

  list.innerHTML = ''
  files.forEach(file => {
    const li = document.createElement('li')
    li.textContent = file
    li.onclick = () => {
      console.log('Arquivo clicado:', file)
      currentFile = file
      selectedFileEl.textContent = `Arquivo: ${file}`
      pageInput.value = ''
      modal.style.display = 'flex'
      pageInput.focus()
    }
    list.appendChild(li)
  })
})

modalOk.onclick = async () => {
  const page = pageInput.value.trim()
  if (!page) {
    alert('Digite as páginas para imprimir.')
    return
  }
  modal.style.display = 'none'
  console.log(`Imprimindo ${currentFile} na(s) página(s): ${page}`)
  const result = await ipcRenderer.invoke('print-pdf', currentFile, page)
  console.log('Resultado:', result)
  alert(result)
}

modalCancel.onclick = () => {
  modal.style.display = 'none'
  console.log('Impressão cancelada.')
}
