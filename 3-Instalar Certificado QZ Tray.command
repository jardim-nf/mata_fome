#!/bin/bash

# Garante que roda no diretório onde o script está localizado
cd "$(dirname "$0")"

echo "=========================================================="
echo "[ CONFIGURANDO QZ TRAY PARA IDEAFOOD / MATAFOME ]"
echo "Isso permite impressao automatica sem popup de permissao."
echo "=========================================================="
echo ""

echo "[1/5] Parando QZ Tray..."
# Encerra o QZ Tray caso esteja aberto
killall "QZ Tray" >/dev/null 2>&1
killall "java" >/dev/null 2>&1
sleep 2
echo "      QZ Tray parado!"
echo ""

echo "[2/5] Criando diretório e salvando certificado override.crt..."
QZ_DIR="$HOME/Library/Application Support/qz"
mkdir -p "$QZ_DIR/ssl"

cat << 'EOF' > "$QZ_DIR/ssl/override.crt"
-----BEGIN CERTIFICATE-----
MIIDTTCCAjWgAwIBAgIBATANBgkqhkiG9w0BAQsFADBqMRkwFwYDVQQDExBJZGVh
Rm9vZCBRWiBDZXJ0MQswCQYDVQQGEwJCUjELMAkGA1UECBMCQ0UxEjAQBgNVBAcT
CUZvcnRhbGV6YTERMA8GA1UEChMISWRlYUZvb2QxDDAKBgNVBAsTA1BEVjAeFw0y
N0A1MjIxMzM4MDBaFw0zNjA1MjIxMzM4MDBaMGoxGTAXBgNVBAMTEElkZWFGb29k
IFFaIENlcnQxCzAJBgNVBAYTAkJSMQswCQYDVQQIEwJDRTESMBAGA1UEBxMJRm9y
dGFsZXphMREwDwYDVQQKEwhJZGVhRm9vZDEMMAoGA1UECxMDUERWMIIBIjANBgkq
hkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt+mNwGIR3deXjH+aGyOKL2T4stndsNCL
tM9QyJ83nphv6kbCaM8bVCztjahHXjJD2o9FAkdDWQFXqPbCC/NrO3BQJLPb9Z7w
KnF57pj87Ixx1D0jqHQrK7mBUrdXNDhdFxHGsOId5sDjwu4abTKqQ/k6OKL77Fz7
FZzGyEQsUZ1yIB23Q7Yg/RKi7SP7rG3O+ptqfNkaJojR0xNjqGSbdpplZfNaUhF6
X8hbFUw/e9KBbTnTc4KqGc0MaYCptsJtxvCTS/ERE6t72npGSdnLIobQBn5tjP6H
j5/NHZVr9vmFyDpBagZBqy4sCsLAFiekp16p6bldv68hjgUloJMolwIDAQABMA0G
CSqGSIb3DQEBCwUAA4IBAQCUUfN2PJL7YW9hXIlnTff6bwLg/YuTEJnbwWv5fDQs
HYx1pUvR4RO37+WGjkFoMvb8zcBLPESjbyug8eymH+M1/A9phlds8+gVp4tTcfWT
j6uvYTBSlwjoA7Ahv1ZAT5c+fUCDiirFi1jteftZhvLkvbYl18pfkNl1MB1GFn8Z
nsal2XGsmZFlRCgSJYsaxonbIb9gHDcPnAZyIFDw/9KfVRWfpjK+JZ7sqTx/gjE4
McO5IHGtptPZPQqS9epwsiUrFjpmcGq0euNxpKrurm8vuOLzLl9xyOCn2lGG3Swg
sdJ8I4ESlHVGPPMbORxlRqNFT+tgpFOJxOf19DXsxEFd
-----END CERTIFICATE-----
EOF

echo "      Certificado salvo em: $QZ_DIR/ssl/override.crt"
echo ""

echo "[3/5] Adicionando authcert.override no properties..."
PROPS_FILE="$QZ_DIR/qz-tray.properties"

if [ ! -f "$PROPS_FILE" ]; then
    touch "$PROPS_FILE"
fi

# Remove linhas existentes que configuram authcert.override para evitar duplicados
if grep -q "authcert.override" "$PROPS_FILE"; then
    # Faz backup
    cp "$PROPS_FILE" "$PROPS_FILE.bak"
    # Remove as linhas existentes de authcert.override
    sed -i '' '/authcert.override/d' "$PROPS_FILE"
fi

# Adiciona o caminho com barra invertida escapando os espaços (Application\ Support) para o properties do Java
# No properties do Java, o caractere '\' é o escape, então escapamos o espaço e duplicamos a barra invertida se necessário.
# Vamos escrever duas opções de caminhos para maior compatibilidade.
ESC_PATH=$(echo "$QZ_DIR/ssl/override.crt" | sed 's/ /\\ /g')

echo "" >> "$PROPS_FILE"
echo "# IdeaFood - Certificado auto-assinado" >> "$PROPS_FILE"
echo "authcert.override=$ESC_PATH" >> "$PROPS_FILE"
echo "      Configuração adicionada em: $PROPS_FILE"
echo ""

echo "[4/5] Copiando certificado para o diretório de recursos da aplicação..."
# Tenta copiar o certificado também diretamente para o bundle do QZ Tray se ele existir
APP_RESOURCES="/Applications/QZ Tray.app/Contents/Resources"
if [ -d "$APP_RESOURCES" ]; then
    echo "      QZ Tray instalado em /Applications. Copiando override.crt..."
    # Pode requerer sudo se a pasta /Applications tiver restrições de escrita
    if [ -w "$APP_RESOURCES" ]; then
        cp "$QZ_DIR/ssl/override.crt" "$APP_RESOURCES/override.crt"
        echo "      Copiado com sucesso para $APP_RESOURCES/override.crt!"
    else
        echo "      Permissões insuficientes para gravar em /Applications sem sudo."
        echo "      Tentando copiar com privilégios de administrador (digite sua senha se solicitado)..."
        sudo cp "$QZ_DIR/ssl/override.crt" "$APP_RESOURCES/override.crt"
        if [ $? -eq 0 ]; then
            echo "      Copiado com sucesso para $APP_RESOURCES/override.crt usando sudo!"
        else
            echo "      AVISO: Não foi possível copiar para a pasta /Applications."
            echo "      Mas a configuração local no seu usuário já foi realizada."
        fi
    fi
else
    echo "      Aviso: QZ Tray.app não encontrado em /Applications."
    echo "      Instale o QZ Tray no seu Mac e depois execute esse script novamente"
    echo "      para garantir que o certificado seja copiado para a pasta da aplicação."
fi
echo ""

echo "[5/5] Concluído!"
echo "Abra o QZ Tray manualmente e recarregue a página (F5) no navegador."
echo "=========================================================="
echo ""

read -n 1 -s -r -p "Pressione qualquer tecla para finalizar..."
