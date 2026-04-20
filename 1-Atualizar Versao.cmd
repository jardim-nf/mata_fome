@echo off
TITLE IdeaFood - Gerador de Atualizacao
color 0B
echo ==========================================================
echo [ COMPILANDO NOVA VERSAO DO SISTEMA (MODO PRODUCAO) ]
echo Esse processo gera o código mais leve e rápido possível.
echo ==========================================================
echo.
call npm run build
echo.
echo ==========================================================
echo PRONTINHO! A NOVA VERSÃO FOI GERADA COM SUCESSO.
echo Pode fechar esta tela e dar dois cliques no "Iniciar Sistema (Caixa).cmd"
echo ==========================================================
pause
