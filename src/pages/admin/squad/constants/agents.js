// Roster of agents in the squad
export const AGENTS = {
  oscar: { id: 'oscar', nome: 'Oscar Niemeyer', cargo: 'Arquiteto/Analista', emoji: '🔍', color: 0xe2e8f0, phase: 'architecture' },
  leo: { id: 'leo', nome: 'Sheldon', cargo: 'Front-end Sênior (Bazinga!)', emoji: '🎨', color: 0x38bdf8, phase: 'ui' },
  afrodite: { id: 'afrodite', nome: 'Nairobi', cargo: 'Líder de Banco & Dev Backend', emoji: '🌸', color: 0xf43f5e, phase: 'backend' },
  thor: { id: 'thor', nome: 'Ragnar', cargo: 'QA & Validador de Elite', emoji: '⚡', color: 0xeab308, phase: 'qa' },
  sabotagem: { id: 'sabotagem', nome: 'Sabotagem', cargo: 'Marketing & Copy', emoji: '🎤', color: 0x22c55e, phase: 'marketing' }
};

// Coffee Break dialogue topics
export const COFFEE_TOPICS = [
  {
    name: "gravidade_zero",
    steps: [
      { agent: 'leo', text: "Gente, a máquina de café italiana do buffet está tendo problemas de vazamento na gravidade zero da NASA!" },
      { agent: 'afrodite', text: "Calma Shaldon, a bomba de pressão da máquina compensa isso. Nenhuma gota vai flutuar no nosso console." },
      { agent: 'thor', text: "Por Odin! Meu machado viking também flutuaria no espaço? Quero testar a gravidade zero agora mesmo!" },
      { agent: 'oscar', text: "Sem arremessar armas no Centro de Controle, Ragnar. A beleza do espaço está no silêncio e na leveza de suas curvas." },
      { agent: 'sabotagem', text: "Se o café flutuar, meu flow vai pras estrelas! A gravidade é zero mas o compromisso é cem por cento!" }
    ]
  },
  {
    name: "comida_astronauta",
    steps: [
      { agent: 'sabotagem', text: "Aí equipe, esse sachê liofilizado sabor hambúrguer do espaço que peguei no refeitório é meio esquisito..." },
      { agent: 'leo', text: "Lógico! A sublimação remove a água sob vácuo para preservação ideal de nutrientes. É pura física aplicada!" },
      { agent: 'thor', text: "Prefiro um javali assado em Valhalla, mas essa pasta em tubo dá força para decapitar bugs no console!" },
      { agent: 'afrodite', text: "O importante é que a telemetria com a Terra e com o banco de dados do Matheusjardim está em órbita nominal." },
      { agent: 'oscar', text: "O alimento espacial tem funcionalidade, mas carece da harmonia e da poesia de um bom almoço na Terra." }
    ]
  },
  {
    name: "bug_sexta",
    steps: [
      { agent: 'thor', text: "Gente, encontrei um bug crítico de faturamento no Firestore!" },
      { agent: 'afrodite', text: "Não é possível, Ragnar. Eu testei essa collection ontem na transação e estava tudo ok..." },
      { agent: 'leo', text: "Ah, deve ser no front. Acho que esqueci de converter o valor para centavos no input do PDV." },
      { agent: 'oscar', text: "Calma, equipe. A elegância exige paciência. Vamos analisar o diagrama de classes antes de alterar o código." },
      { agent: 'sabotagem', text: "Vocês que lutem com o código, eu já vou subir uma campanha de desconto para compensar o downtime!" }
    ]
  },
  {
    name: "caneca_sumida",
    steps: [
      { agent: 'sabotagem', text: "Pessoal, papo sério... Quem pegou minha caneca de café com estampa de microfone?" },
      { agent: 'leo', text: "Ih, pior que eu vi o Oscar levando uma caneca parecida lá para a prateleira de livros..." },
      { agent: 'oscar', text: "Ora, eu apenas apreciei o design geométrico daquela peça. Mas já a devolvi ao buffet." },
      { agent: 'afrodite', text: "Ah, então foi por isso que achei ela limpa na pia. Deixei ela secando do lado da máquina de expresso." },
      { agent: 'thor', text: "Validado! Caneca localizada e devolvida com sucesso para o marketing. Caso encerrado!" }
    ]
  }
];
