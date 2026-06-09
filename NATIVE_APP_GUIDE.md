# Guia: Como Gerar e Publicar os Aplicativos Nativos (Android & iOS)

Este guia explica como compilar seu projeto web em React/Vite usando **Capacitor** para rodar nativamente em celulares e tablets, e como publicá-los nas lojas oficiais.

---

## Pré-requisitos
1. **Node.js** instalado na máquina de desenvolvimento.
2. **Android (para gerar APK/AAB):** Android Studio instalado com SDKs configurados.
3. **iOS (para gerar App de iPhone):** Computador macOS com Xcode instalado e conta de desenvolvedor da Apple.

---

## Passo 1: Instalar o Capacitor
Abra o terminal na pasta raiz do projeto e execute a instalação das dependências do Capacitor:
```bash
npm install @capacitor/core @capacitor/cli
```

---

## Passo 2: Instalar e Adicionar as Plataformas
Instale as bibliotecas nativas e crie as pastas dos projetos móveis no repositório:

### Para Android:
```bash
npm install @capacitor/android
npx cap add android
```

### Para iOS:
```bash
npm install @capacitor/ios
npx cap add ios
```

---

## Passo 3: Fluxo de Desenvolvimento e Build
Sempre que fizer alterações no seu código React/Vite e quiser visualizá-las no celular, siga este fluxo:

1. **Compilar a versão web:**
   ```bash
   npm run build
   ```
   *(Este comando gera a pasta `dist` com os arquivos estáticos atualizados).*

2. **Sincronizar os arquivos com o projeto mobile:**
   ```bash
   npx cap sync
   ```
   *(Este comando copia o conteúdo de `dist` para dentro dos builds de Android e iOS).*

---

## Passo 4: Abrir os Projetos nos Ambientes Nativos

### Para Compilar e Testar no Android:
Abra o projeto no Android Studio pelo terminal com o comando:
```bash
npx cap open android
```
* **No Android Studio:**
  * Aguarde o carregamento do Gradle (pode levar alguns minutos na primeira vez).
  * Conecte um celular físico via USB (com Depuração USB ativa) ou use um Emulador.
  * Clique no botão **Run (Ícone Play Verde)** no topo para instalar o app.
  * Para gerar o APK final: Vá em **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

### Para Compilar e Testar no iOS:
Abra o projeto no Xcode (somente no macOS) com o comando:
```bash
npx cap open ios
```
* **No Xcode:**
  * Selecione o destino (seu iPhone físico ou um simulador de iOS).
  * Configure a assinatura (Signing & Capabilities) informando seu Apple ID.
  * Clique no botão **Play** no canto superior esquerdo para instalar o app.

---

## Passo 5: Geração de Versão de Produção e Lojas

### Google Play Store (Android):
1. No Android Studio, vá em **Build > Generate Signed Bundle / APK**.
2. Selecione **Android App Bundle (AAB)** (obrigatório para novas publicações).
3. Crie uma chave de assinatura segura (Keystore) e salve a senha.
4. O arquivo `.aab` gerado na pasta `release` deve ser enviado para o Console do Google Play.

### Apple App Store (iOS):
1. No Xcode, mude o destino de build para **Any iOS Device (arm64)**.
2. Vá em **Product > Archive**.
3. Siga o assistente de distribuição clicando em **Distribute App** para subir o build diretamente para o App Store Connect.
