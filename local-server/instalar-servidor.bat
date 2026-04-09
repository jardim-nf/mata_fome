@echo off
title Instalador IdeaFood - Servidor Local
color 0A
echo.
echo ========================================================
echo       INSTALADOR - Servidor Local IdeaFood
echo ========================================================
echo.
echo Este instalador vai:
echo   1. Copiar o servidor para C:\IdeaFood
echo   2. Configurar para iniciar automaticamente com o Windows
echo.
pause

echo.
echo [1/3] Criando pasta C:\IdeaFood ...
if not exist "C:\IdeaFood" mkdir "C:\IdeaFood"

echo [2/3] Copiando ServidorIdeaFood.exe ...
copy /Y "%~dp0ServidorIdeaFood.exe" "C:\IdeaFood\ServidorIdeaFood.exe"

echo [3/3] Criando atalho na Inicializacao do Windows ...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut([System.IO.Path]::Combine($ws.SpecialFolders('Startup'), 'ServidorIdeaFood.lnk')); $sc.TargetPath = 'C:\IdeaFood\ServidorIdeaFood.exe'; $sc.WorkingDirectory = 'C:\IdeaFood'; $sc.Description = 'Servidor Local IdeaFood - Sincronizacao Offline'; $sc.Save()"

echo.
echo ========================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo O servidor foi instalado em: C:\IdeaFood\ServidorIdeaFood.exe
echo Ele vai iniciar AUTOMATICAMENTE toda vez que o Windows ligar.
echo.
echo Deseja iniciar o servidor agora? (S/N)
set /p resposta="> "
if /I "%resposta%"=="S" (
    start "" "C:\IdeaFood\ServidorIdeaFood.exe"
    echo Servidor iniciado! Verifique o IP na janela que abriu.
)
echo.
pause
