#!/bin/bash

# Define o nome de usuário (substitua 'cliente' se for outro)
USERNAME="cliente"

# Define o caminho completo para o AppImage
APPIMAGE_PATH="/home/${USERNAME}/.dist/ImagePDFPrinter-1.0.0.AppImage"

# Define o caminho para o diretório de ações do Nemo
NEMO_ACTIONS_DIR="${HOME}/.local/share/nemo/actions"

# Define o nome do arquivo da ação do Nemo
NEMO_ACTION_FILE="${NEMO_ACTIONS_DIR}/imprimir_com_imagepdfprinter.nemo_action"

echo "Configurando ação 'Imprimir' para o Nemo..."

# 1. Cria o diretório de ações do Nemo se não existir
mkdir -p "${NEMO_ACTIONS_DIR}"

# 2. Verifica se o AppImage existe
if [ ! -f "${APPIMAGE_PATH}" ]; then
    echo "Erro: O arquivo AppImage não foi encontrado em ${APPIMAGE_PATH}"
    echo "Certifique-se de que 'ImagePDFPrinter-1.0.0.AppImage' está em ~/.dist/ ou ajuste a variável APPIMAGE_PATH no script."
    exit 1
fi

# 3. Garante que o AppImage seja executável
echo "Garantindo permissões de execução para o AppImage..."
chmod +x "${APPIMAGE_PATH}"

# 4. Cria o conteúdo do arquivo .nemo_action
cat <<EOF > "${NEMO_ACTION_FILE}"
[Nemo Action]
Name=Imprimir
Comment=Abre o ImagePDFPrinter AppImage para imprimir arquivos selecionados
Exec=${APPIMAGE_PATH} %F
Icon-Name=printer
Selection=any
Mimetypes=image/*;application/pdf;
EOF

echo "Arquivo de ação do Nemo criado/atualizado em: ${NEMO_ACTION_FILE}"
echo "Reiniciando Nemo para aplicar as alterações..."

# 5. Reinicia o Nemo
nemo -q
sleep 1 # Dá um pequeno tempo para o Nemo fechar
nemo &

echo "Configuração concluída! Teste clicando com o botão direito em um arquivo de imagem ou PDF."
echo "Se o nome de usuário não for 'cliente', edite o script para ajustar a variável USERNAME."
