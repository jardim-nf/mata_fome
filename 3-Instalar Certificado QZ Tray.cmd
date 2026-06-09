@echo off
setlocal EnableDelayedExpansion
REM Auto-elevar para administrador
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

TITLE IdeaFood - Instalar Certificado QZ Tray
color 0B
echo ==========================================================
echo [ CONFIGURANDO QZ TRAY PARA IDEAFOOD ]
echo Isso permite impressao automatica sem popup de permissao.
echo ==========================================================
echo.

echo [1/5] Parando QZ Tray...
taskkill /IM "qz-tray.exe" /F >nul 2>&1
taskkill /IM "javaw.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul
echo       QZ Tray parado!

echo.
echo [2/5] Salvando certificado override.crt...
if not exist "C:\ProgramData\qz\ssl" mkdir "C:\ProgramData\qz\ssl"
(
echo -----BEGIN CERTIFICATE-----
echo MIIDTTCCAjWgAwIBAgIBATANBgkqhkiG9w0BAQsFADBqMRkwFwYDVQQDExBJZGVh
echo Rm9vZCBRWiBDZXJ0MQswCQYDVQQGEwJCUjELMAkGA1UECBMCQ0UxEjAQBgNVBAcT
echo CUZvcnRhbGV6YTERMA8GA1UEChMISWRlYUZvb2QxDDAKBgNVBAsTA1BEVjAeFw0y
echo NjA1MjIxMzM4MDBaFw0zNjA1MjIxMzM4MDBaMGoxGTAXBgNVBAMTEElkZWFGb29k
echo IFFaIENlcnQxCzAJBgNVBAYTAkJSMQswCQYDVQQIEwJDRTESMBAGA1UEBxMJRm9y
echo dGFsZXphMREwDwYDVQQKEwhJZGVhRm9vZDEMMAoGA1UECxMDUERWMIIBIjANBgkq
echo hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt+mNwGIR3deXjH+aGyOKL2T4stndsNCL
echo tM9QyJ83nphv6kbCaM8bVCztjahHXjJD2o9FAkdDWQFXqPbCC/NrO3BQJLPb9Z7w
echo KnF57pj87Ixx1D0jqHQrK7mBUrdXNDhdFxHGsOId5sDjwu4abTKqQ/k6OKL77Fz7
echo FZzGyEQsUZ1yIB23Q7Yg/RKi7SP7rG3O+ptqfNkaJojR0xNjqGSbdpplZfNaUhF6
echo X8hbFUw/e9KBbTnTc4KqGc0MaYCptsJtxvCTS/ERE6t72npGSdnLIobQBn5tjP6H
echo j5/NHZVr9vmFyDpBagZBqy4sCsLAFiekp16p6bldv68hjgUloJMolwIDAQABMA0G
echo CSqGSIb3DQEBCwUAA4IBAQCUUfN2PJL7YW9hXIlnTff6bwLg/YuTEJnbwWv5fDQs
echo HYx1pUvR4RO37+WGjkFoMvb8zcBLPESjbyug8eymH+M1/A9phlds8+gVp4tTcfWT
echo j6uvYTBSlwjoA7Ahv1ZAT5c+fUCDiirFi1jteftZhvLkvbYl18pfkNl1MB1GFn8Z
echo nsal2XGsmZFlRCgSJYsaxonbIb9gHDcPnAZyIFDw/9KfVRWfpjK+JZ7sqTx/gjE4
echo McO5IHGtptPZPQqS9epwsiUrFjpmcGq0euNxpKrurm8vuOLzLl9xyOCn2lGG3Swg
echo sdJ8I4ESlHVGPPMbORxlRqNFT+tgpFOJxOf19DXsxEFd
echo -----END CERTIFICATE-----
) > "C:\ProgramData\qz\ssl\override.crt"
echo       Certificado salvo em: C:\ProgramData\qz\ssl\override.crt

echo.
echo [3/5] Adicionando authcert.override no properties (Program Files)...

REM Detectar onde esta o qz-tray.properties
set "QZ_PROPS="
if exist "C:\Program Files\QZ Tray\qz-tray.properties" set "QZ_PROPS=C:\Program Files\QZ Tray\qz-tray.properties"
if exist "C:\Program Files (x86)\QZ Tray\qz-tray.properties" set "QZ_PROPS=C:\Program Files (x86)\QZ Tray\qz-tray.properties"

if "%QZ_PROPS%"=="" (
    echo       Properties nao encontrado em Program Files.
    echo       Verificando alternativas...
    if exist "C:\Program Files\QZ Tray" set "QZ_PROPS=C:\Program Files\QZ Tray\qz-tray.properties"
    if exist "C:\Program Files (x86)\QZ Tray" set "QZ_PROPS=C:\Program Files (x86)\QZ Tray\qz-tray.properties"
)

if not "%QZ_PROPS%"=="" (
    findstr /C:"authcert.override" "%QZ_PROPS%" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo       authcert.override ja existe!
    ) else (
        echo.>> "%QZ_PROPS%"
        echo # IdeaFood - Certificado auto-assinado>> "%QZ_PROPS%"
        echo authcert.override=C\:\\ProgramData\\qz\\ssl\\override.crt>> "%QZ_PROPS%"
        echo       Adicionado ao: %QZ_PROPS%
    )
)

echo.
echo [4/5] Copiando properties para ProgramData tambem...
REM Copia pra garantir que o QZ Tray encontre em qualquer lugar
if not "%QZ_PROPS%"=="" (
    copy /Y "%QZ_PROPS%" "C:\ProgramData\qz\qz-tray.properties" >nul 2>&1
    echo       Copiado para C:\ProgramData\qz\qz-tray.properties
) else (
    REM Cria um novo se nao encontrou nenhum
    (
    echo # IdeaFood - Configuracao QZ Tray
    echo authcert.override=C\:\\ProgramData\\qz\\ssl\\override.crt
    ) > "C:\ProgramData\qz\qz-tray.properties"
    echo       Criado em C:\ProgramData\qz\qz-tray.properties
)

echo.
echo [5/5] Reiniciando QZ Tray...
timeout /t 2 /nobreak >nul
if exist "C:\Program Files\QZ Tray\qz-tray.exe" (
    start "" "C:\Program Files\QZ Tray\qz-tray.exe"
    echo       QZ Tray reiniciado!
) else if exist "C:\Program Files (x86)\QZ Tray\qz-tray.exe" (
    start "" "C:\Program Files (x86)\QZ Tray\qz-tray.exe"
    echo       QZ Tray reiniciado!
) else (
    echo       Abra o QZ Tray manualmente.
)

echo.
echo ==========================================================
echo PRONTO! Recarregue a pagina (F5) e teste imprimir.
echo ==========================================================
pause
