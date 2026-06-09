#!/bin/bash

# Garante que roda no diretório onde o script está localizado
cd "$(dirname "$0")"

echo "=========================================================="
echo "[ CONFIGURANDO AMBIENTE MACOS PARA IDEAFOOD / MATAFOME ]"
echo "=========================================================="
echo ""

# 1. Limpar node_modules antigos (Windows) para evitar conflitos de permissão/binários
echo "[1/5] Removendo pastas node_modules antigas (limpeza de transição)..."
rm -rf node_modules
rm -rf local-server/node_modules
rm -rf functions/node_modules
echo "Limpeza concluída!"
echo ""

# 2. Instalar NVM se não existir
if [ ! -d "$HOME/.nvm" ]; then
    echo "[2/5] Instalando NVM (Node Version Manager)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    echo "NVM instalado com sucesso!"
else
    echo "[2/5] NVM já está instalado."
fi

# Carregar o NVM no shell atual
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# 3. Instalar e usar Node 20 (LTS recomendado para Vite 7 e ferramentas modernas)
echo ""
echo "[3/5] Instalando Node.js versão 20..."
nvm install 20
nvm use 20
nvm alias default 20

echo "Node.js $(node -v) e npm $(npm -v) ativos!"
echo ""

# 4. Instalar as dependências do projeto
echo "[4/5] Instalando dependências do projeto npm (instalando do zero para macOS)..."

echo "-> Instalando dependências do Frontend (raiz)..."
npm install --legacy-peer-deps

echo "-> Instalando dependências do Servidor Local..."
cd local-server
npm install
cd ..

echo "-> Instalando dependências das Cloud Functions (Firebase)..."
cd functions
npm install
cd ..
echo ""

# 5. Configurar permissões de execução dos scripts .command
echo "[5/5] Configurando permissões de execução dos scripts .command..."
chmod +x "1-Atualizar Versao.command"
chmod +x "2-Iniciar Sistema Caixa.command"
chmod +x "3-Instalar Certificado QZ Tray.command"
chmod +x "setup-mac.command"
echo "Permissões de execução configuradas!"
echo ""

# 6. Executar o script do QZ Tray
echo "=========================================================="
echo "[ CONFIGURAÇÃO DO CERTIFICADO QZ TRAY ]"
echo "=========================================================="
./"3-Instalar Certificado QZ Tray.command"
echo ""

echo "=========================================================="
echo "AMBIESTE MACOS CONFIGURADO COM SUCESSO!"
echo "Você pode abrir o sistema usando os seguintes atalhos:"
echo "  - 1-Atualizar Versao.command (Para compilar novas versões)"
echo "  - 2-Iniciar Sistema Caixa.command (Para abrir o PDV/Caixa local)"
echo "=========================================================="
echo ""

read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
