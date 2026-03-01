// src/scripts/importMenu.js

// 1. Importar o SDK do Firebase Admin
const admin = require('firebase-admin');

// --- INÍCIO DO DEBUG ---
if (typeof admin !== 'object' || !admin || typeof admin.initializeApp !== 'function') {
    console.error("ERRO CRÍTICO: 'admin' não é um objeto Firebase Admin SDK válido após require.");
    console.error("Isso pode indicar um problema na instalação do 'firebase-admin' ou no ambiente Node.js.");
    process.exit(1); // Saia imediatamente com erro
}
console.log("Debug: 'admin' object carregado com sucesso.");
// --- FIM DO DEBUG ---

// 2. Importar as credenciais da sua service account
const serviceAccount = require('../../keys/serviceAccountKey.json'); // <-- CONFIRME ESTE CAMINHO REAL!

// --- INÍCIO DO DEBUG ---
console.log("Debug: Tipo de 'serviceAccount' após require:", typeof serviceAccount);
// Apenas exiba algumas chaves para não expor a private_key inteira no console
console.log("Debug: Conteúdo de 'serviceAccount' object (primeiras chaves):", {
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email
});
// --- FIM DO DEBUG ---

// 3. Inicializar o aplicativo Firebase Admin
// Adicione um bloco try-catch para lidar com o erro "app already exists"
try {
  // Verifica se o aplicativo já foi inicializado
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK inicializado com sucesso.");
  } else {
    console.log("Firebase Admin SDK já inicializado.");
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase Admin SDK:", error);
  // Se o erro for diferente de "app already exists", saia com erro
  if (!error.message.includes("app already exists")) {
      process.exit(1); // Saia com erro
  }
}

// Obter a instância do Firestore do Admin SDK
const db = admin.firestore();

// 4. Defina o ID do estabelecimento
// CERTIFIQUE-SE QUE ESTE ID É O MESMO DO DOCUMENTO QUE VOCÊ TEM OU QUER CRIAR NO FIRESTORE!
const estabelecimentoId = "SgQtnaNq4LTT3TqwpdzH"; // <-- CONFIRME ESTE ID!

// 5. O objeto completo do cardápio (cole todo o JSON aqui)
const cardapioCompletoParaFirebase = {
  cardapio: [
    {
      "categoria": "PORÇÕES",
      "subtitulo": "PRA ABRIR O APETITE OU BELISCAR COM A GALERA!",
      "itens": [
        { "nome": "BATATA FRITA PALITO INDIVIDUAL", "descricao": null, "preco": 8.00 },
        { "nome": "BATATA FRITA PALITO G SIMPLES", "descricao": "500GR", "preco": 30.00 },
        { "nome": "BATATA FRITA PALITO G CHEDDAR+BACON", "descricao": null, "preco": 38.00 },
        { "nome": "BATATA FRITA PALITO G CALABRESA+PARMESÃO", "descricao": null, "preco": 40.00 },
        { "nome": "BATATA FRITA PALITO G C/COSTELA COM CATUPIRY", "descricao": null, "preco": 60.00 }
      ]
    },
    {
      "categoria": "PETISCOS",
      "subtitulo": null,
      "itens": [
        { "nome": "FRANGO CROCANTE", "descricao": "400GR + FRITAS 400GR + 2 MOLHOS", "preco": 55.00 },
        { "nome": "DADINHO DE TAPIOCA", "descricao": "COM GELÉIA DE PIMENTA", "preco": 24.00 },
        { "nome": "COSTELINHA AO BBQ", "descricao": "500GR + FRITAS + ANÉIS DE CEBOLA", "preco": 75.00 }
      ]
    },
    {
      "categoria": "PIZZAS",
      "subtitulo": "GOSTOSAS, BEM RECHEADAS,.... MAMAMIA!",
      "observacao_geral": "35 CM - TODOS OS SABORES: R$ 60,00 CADA",
      "itens": [
        { "nome": "PORTUGUESA DA CASA", "descricao": null, "preco": 60.00 },
        { "nome": "ALHO ESPECIAL", "descricao": null, "preco": 60.00 },
        { "nome": "BACON ESPECIAL", "descricao": null, "preco": 60.00 },
        { "nome": "CALABRESA COM REQUEIJÃO", "descricao": null, "preco": 60.00 },
        { "nome": "MARGUERITA", "descricao": "MUSSARELA, TOMATE, MANJERICÃO", "preco": 60.00 },
        { "nome": "FRANGO COM REQUEIJÃO", "descricao": null, "preco": 60.00 },
        { "nome": "MISTA", "descricao": "QUEIJO E PRESUNTO", "preco": 60.00 },
        { "nome": "CARBONARA", "descricao": "OVO, BACON, PARMESÃO, REQUEIJÃO", "preco": 60.00 },
        { "nome": "4 QUEIJOS", "descricao": "MUSSARELA, CHEDDAR, CATUPIRY, PARMESÃO", "preco": 60.00 },
        { "nome": "CONFETE COM CHOCOLATE", "descricao": null, "preco": 60.00 },
        { "nome": "BANANA NEVADA", "descricao": null, "preco": 60.00 },
        { "nome": "PRESTÍGIO", "descricao": null, "preco": 60.00 },
        { "nome": "CREME DE AVELÃ COM MORANGO", "descricao": null, "preco": 60.00 }
          ]
        },
        {
          "categoria": "BURGUERS CONVENCIONAIS",
          "subtitulo": null,
          "itens": [
            { "nome": "BURGUER SIMPLES", "descricao": "PÃO, CARNE DE HAMBÚRGUER, SALADA, MOLHO DA CHEF", "preco": 12.00 },
            { "nome": "X BURGUER", "descricao": "PÃO, CARNE DE HAMBÚRGUER, QUEIJO MUSSARELA, SALADA, MOLHO DA CHEF", "preco": 16.00 },
            { "nome": "X BURGUER BACON", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, BACON, SALADA, MOLHO DA CHEF", "preco": 19.00 },
            { "nome": "X EGG BACON", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, BACON, OVO, SALADA, MOLHO DA CHEF", "preco": 23.00 },
            { "nome": "X BURGUER CHEDDAR", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, CHEDDAR, BACON, OVO, SALADA, MOLHO DA CHEF", "preco": 25.00 },
            { "nome": "X BURGUER FRANGO", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, FRANGO DESFIADO, OVO, SALADA, MOLHO DA CHEF", "preco": 26.00 },
            { "nome": "X CALABRESA", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, CALABRESA, OVO, SALADA, MOLHO DA CHEF", "preco": 26.00 },
            { "nome": "X TUDO", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, PRESUNTO, BACON, OVO, SALADA, MOLHO DA CHEF", "preco": 28.00 },
            { "nome": "X TUDO DUPLO", "descricao": "PÃO, 2 CARNES, 2 QUEIJO MUSSARELA, PRESUNTO, BACON, OVO, SALADA, MOLHO DA CHEF", "preco": 33.00 },
            { "nome": "X BLACK", "descricao": "PÃO, CARNE, QUEIJO MUSSARELA, PRESUNTO, CALABRESA, FRANGO DESFIADO, BACON, OVO, SALADA, CHEDDAR, MOLHO DA CHEF", "preco": 36.00 }
          ]
        },
        {
          "categoria": "BURGUERS ARTESANAIS",
          "subtitulo": null,
          "itens": [
            { "nome": "DEAD POOL", "descricao": "PÃO VERMELHO, CHEDDAR CREMOSO E MAIONESE DA CHEF", "preco": 20.00 },
            { "nome": "HOMEM DE FERRO", "descricao": "PÃO AUSTRALIANO, CHEDDAR CREMOSO, BACON CROCANTE, MOLHO BBQ E MAIONESE DA CHEF", "preco": 27.00 },
            { "nome": "THOR", "descricao": "PÃO BRIOCHE, QUEIJO MAÇARICADO, BACON CROCANTE, MOLHO BBQ E MAIONESE DA CHEF", "preco": 27.00 },
            { "nome": "BATMAN", "descricao": "PÃO BRIOCHE, QUEIJO MAÇARICADO, BACON CROCANTE, BATATA PALHA, MOSTARDA E MEL, ALFACE E MAIONESE DA CHEF", "preco": 28.00 },
            { "nome": "SUPER MAN", "descricao": "PÃO VERMELHO, CHEDDAR CREMOSO, GELÉIA DE PIMENTA, BACON CROCANTE, FAROFA DE NACHOS E MAIONESE DA CHEF", "preco": 29.00 },
            { "nome": "HULK", "descricao": "2 BLENDS, PÃO VERDE, QUEIJO MAÇARICADO, 3 ANÉIS DE CEBOLA EMPANADOS, BACON CARAMELIZADO E MAIONESE DA CHEF", "preco": 37.00 },
            { "nome": "VÍBORA", "descricao": "2 BLENDS, PÃO VERDE, QUEIJO MAÇARICADO, 2 ANÉIS DE CEBOLA, CEBOLA ROXA, BACON CROCANTE, ALFACE E MAIONESE DA CHEF. ACOMPANHA BATATA PALITO COM CHEDDAR.", "preco": 40.00 }
          ]
        },
        {
          "categoria": "COMBOS",
          "subtitulo": "NOSSO FRANGO CROCANTE AQUI BRILHA!",
          "observacao_geral": "32$ CADA",
          "itens": [
            { "nome": "SUPER CHICKEN COMBO 1", "descricao": "BURGUER + REFRI LATA + FRITAS INDIV. FILÉS DE FRANGO CROCANTE OU GRELHADO NO PÃO BRIOCHE, MOLHO BBQ, QUEIJO MAÇARICADO, 2 ANÉIS DE CEBOLA EMPANADOS E MAIONESE", "preco": 32.00 },
            { "nome": "SUPER CHICKEN COMBO 2", "descricao": "BURGUER + REFRI LATA + FRITAS INDIV. FILÉS DE FRANGO CROCANTE OU GRELHADO NO PÃO BRIOCHE, CHEDDAR CREMOSO, 2 ANÉIS DE CEBOLA EMPANADOS E MAIONESE DA CHEF", "preco": 32.00 }
          ]
        },
        {
          "categoria": "ADICIONAIS",
          "subtitulo": null,
          "itens": [
            { "nome": "FAROFA DE NACHOS", "descricao": null, "preco": 4.00 },
            { "nome": "BLEND 130GR", "descricao": null, "preco": 7.00 },
            { "nome": "BATATA PALHA", "descricao": null, "preco": 3.00 },
            { "nome": "QUEIJO MAÇARICADO", "descricao": null, "preco": 3.00 },
            { "nome": "CEBOLA CARAMELIZADA", "descricao": null, "preco": 3.00 },
            { "nome": "CHEDDAR CREMOSO", "descricao": null, "preco": 4.00 },
            { "nome": "CEBOLA ROXA", "descricao": null, "preco": 2.00 },
            { "nome": "ANEL DE CEBOLA (UNID)", "descricao": null, "preco": 2.00 },
            { "nome": "MOLHO GORGONZOLA", "descricao": null, "preco": 7.00 },
            { "nome": "GELÉIA DE PIMENTA", "descricao": null, "preco": 3.00 },
            { "nome": "BACON CROCANTE", "descricao": null, "preco": 4.00 },
            { "nome": "ALHO CROCANTE", "descricao": null, "preco": 3.00 },
            { "nome": "ALFACE AMERICANA", "descricao": null, "preco": 2.00 },
            { "nome": "MOSTARDA E MEL", "descricao": null, "preco": 2.00 },
            { "nome": "MOLHO BBQ", "descricao": null, "preco": 2.00 },
            { "nome": "PICKLES", "descricao": null, "preco": 2.00 },
            { "nome": "OVO FRITO (UNID)", "descricao": null, "preco": 3.00 }
          ]
        },
        {
          "categoria": "BEBIDAS",
          "subtitulo": null,
          "itens": [
            { "nome": "REFRIGERANTE LATA", "descricao": null, "preco": 7.00 },
            { "nome": "COCA COLA 2 LITROS", "descricao": null, "preco": 15.00 },
            { "nome": "GUARAVITA", "descricao": null, "preco": 3.00 },
            { "nome": "GUARAVITON", "descricao": null, "preco": 7.00 },
            { "nome": "H2O (LIMÃO OU LIMONETO)", "descricao": null, "preco": 8.00 },
            { "nome": "SUCO LATA SABORES", "descricao": null, "preco": 7.00 },
            { "nome": "ÁGUA SEM GÁS", "descricao": null, "preco": 3.00 },
            { "nome": "ÁGUA COM GÁS", "descricao": null, "preco": 4.00 },
            { "nome": "CHOPP ARTESANAL TULIPA", "descricao": null, "preco": 10.00 },
            { "nome": "CHOPP ARTESANAL CANECA", "descricao": null, "preco": 12.99 },
            { "nome": "VINHO TAÇA", "descricao": null, "preco": 24.00 }
          ]
        }
      ],
      "informacoes_contato": {
        "horario_funcionamento": "SEXTA, SÁBADO E DOMINGO DE 18H AS 23:30H",
        "telefone_whatsapp": "22992825109",
        "endereco": "CENTRO DE BARRA ALEGRE, AO LADO DA PINGUELA - RJ",
        "instagram": "@BLACKBURGUERBJ"
      }
    };

// A função de importação
async function performImport() {
  try {
    const estabelecimentoRef = db.collection("estabelecimentos").doc(estabelecimentoId);
    await estabelecimentoRef.set(cardapioCompletoParaFirebase, { merge: true }); // Usando set com merge: true
    console.log("✅ Cardápio importado com sucesso para o Firestore!");
    process.exit(0); // Sair do script com sucesso
  } catch (error) {
    console.error("❌ Erro ao importar cardápio para o Firestore:", error);
    process.exit(1); // Sair do script com erro
  }
}

performImport();