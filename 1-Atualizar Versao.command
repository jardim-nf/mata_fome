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
echo "[ COMPILANDO NOVA VERSÃO DO SISTEMA (MODO PRODUÇÃO) ]"
echo "Esse processo gera o código mais leve e rápido possível."
echo "=========================================================="
echo ""

npm run build

echo ""
echo "=========================================================="
echo "PRONTINHO! A NOVA VERSÃO FOI GERADA COM SUCESSO."
echo "Pode fechar esta tela e dar dois cliques no \"2-Iniciar Sistema Caixa.command\""
echo "=========================================================="
echo ""

read -n 1 -s -r -p "Pressione qualquer tecla para continuar..."
