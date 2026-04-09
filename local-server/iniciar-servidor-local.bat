@echo off
title Servidor Local MataFome (Sincronizacao)
echo =========================================
echo  Iniciando Servidor Local de Sincronizacao
echo =========================================
echo Verificando node_modules...
if not exist node_modules (
    echo Instalando dependencias iniciais...
    npm install
) else (
    echo Dependencias ok!
)

echo.
echo Iniciando Servidor...
echo Mantenha esta janela aberta enquanto o restaurante estiver operando.
echo.
npm start

pause
