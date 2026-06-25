# Base de Conhecimento de Suporte Técnico - Mata Fome / IdeaFood

Este documento contém o diagnóstico e os passos para solução dos problemas mais frequentes enfrentados pelos lojistas no sistema.

---

## 1. Problemas de Impressão (QZ Tray)
**Sintoma:** O sistema pede permissão toda vez que vai imprimir, ou a impressão automática não funciona, ou aparece erro de conexão com o QZ Tray.

### Solução:
Para remover o popup de permissão recorrente do QZ Tray, é necessário instalar o certificado de segurança autoassinado da plataforma.
1. **No macOS (Apple):**
   * Execute o script de configuração automática localizado na raiz do sistema: [3-Instalar Certificado QZ Tray.command](file:///Users/matheusjardim/Documents/matafome-landing-atualizado/3-Instalar%20Certificado%20QZ%20Tray.command).
   * Caso peça senha de administrador no terminal, digite-a para concluir a cópia do certificado para a pasta da aplicação.
2. **No Windows:**
   * Dê dois cliques no script localizado na raiz do sistema: `3-Instalar Certificado QZ Tray.cmd`.
3. **Pós-instalação:**
   * Feche o QZ Tray completamente (clique com o botão direito no ícone verde perto do relógio e vá em **Exit**).
   * Abra o QZ Tray novamente.
   * Atualize a página do navegador (F5) e tente imprimir. A impressão agora será silenciosa e automática.

---

## 2. Sistema de Caixa (PDV) Local Não Inicia
**Sintoma:** O painel local do caixa não carrega ou diz que não foi possível conectar ao servidor local.

### Solução:
O caixa local depende de um servidor local ativo na máquina.
1. **No macOS (Apple):**
   * Dê dois cliques no script [2-Iniciar Sistema Caixa.command](file:///Users/matheusjardim/Documents/matafome-landing-atualizado/2-Iniciar%20Sistema%20Caixa.command).
2. **No Windows:**
   * Dê dois cliques em `2-Iniciar Sistema Caixa.cmd`.
3. **Verificação:**
   * Mantenha a janela do terminal aberta enquanto estiver utilizando o sistema do caixa. Se fechar o terminal, o servidor local será encerrado.
   * Certifique-se de que nenhum outro aplicativo está utilizando a mesma porta do servidor local.

---

## 3. Como Atualizar a Versão do Sistema
**Sintoma:** Recursos novos não aparecem ou a equipe de suporte solicitou a atualização do sistema.

### Solução:
Rode o script de atualização integrado que puxa as últimas melhorias do servidor e reconstrói a aplicação:
1. **No macOS (Apple):**
   * Execute [1-Atualizar Versao.command](file:///Users/matheusjardim/Documents/matafome-landing-atualizado/1-Atualizar%20Versao.command).
2. **No Windows:**
   * Execute `1-Atualizar Versao.cmd`.
3. **Pós-atualização:**
   * O script fará o download da versão mais recente, instalará novas dependências (se houver) e recriará o build do frontend. Ao final, basta recarregar o navegador.

---

## 4. WhatsApp Desconectado (Robô de Pedidos)
**Sintoma:** O robô não responde aos clientes no WhatsApp, ou as mensagens enviadas pelo painel administrativo falham.

### Solução:
A conexão com o WhatsApp (via Uazapi ou Meta) pode expirar ou ser desconectada pelo aparelho do lojista.
1. **Reconectar o Uazapi:**
   * No painel de administração, clique no ícone de engrenagem (Configurações) no menu lateral.
   * Vá até a aba **WhatsApp**.
   * Se o status estiver como "Desconectado", clique em **Gerar QR Code**.
   * Abra o WhatsApp no celular, vá em **Aparelhos conectados > Conectar um aparelho** e escaneie o código na tela.
2. **Meta API (Instagram/Messenger):**
   * Certifique-se de que o campo `metaPageId` está configurado corretamente nas configurações principais do painel do estabelecimento.

---

## 5. Integração com o iFood
**Sintoma:** Pedidos do iFood não caem no painel do caixa, ou a conexão falha.

### Solução:
1. **Reautorizar Integração:**
   * No painel de configurações do iFood, verifique se a autorização do parceiro ainda está válida. Se necessário, refaça o login e gere um novo token de autorização.
2. **Problema de Polling/Webhook:**
   * Se o webhook do iFood falhar ou atrasar, o sistema conta com um mecanismo de contingência de *polling* (busca ativa). Certifique-se de que o polling está configurado de forma a buscar pedidos a cada poucos minutos sem sobrecarregar a cota da API.
