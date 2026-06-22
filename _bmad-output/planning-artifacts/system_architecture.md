# System Architecture Plan

**Arquiteto:** Oscar Niemeyer 🔍

## Detalhes do Plano
O objetivo é criar uma função em 'functions/createMasterUser.js' que permita a inserção do novo usuário master no Firestore. O arquivo 'functions/api/admin.js' será alterado para chamar esta nova função e garantir a criação do usuário a partir de uma requisição. O responsável pela lógica de inserção e segurança é Afrodite.

### Arquivos Identificados
- Criar: functions/createMasterUser.js
- Alterar: functions/api/admin.js