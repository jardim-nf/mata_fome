#!/bin/bash

# Garante que roda no diretório onde o script está localizado
cd "$(dirname "$0")"

# Carrega o NVM se estiver instalado no home do usuário
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
    nvm use 20 >/dev/null 2>&1
fi

echo "=========================================================="
echo "[ SERVIDOR OFFLINE INICIANDO JUNTO COM O SISTEMA WEB ]"
echo "Por favor, mantenha esta tela preta mínima aberta."
echo "=========================================================="
echo ""

cd local-server
node server.js

echo ""
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
