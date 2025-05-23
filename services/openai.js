const { OpenAI } = require('openai');
const storeInfo = require('../data/store_info.json');

// Inicializa o cliente OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Gera o system prompt com informações e regras da loja
 */
function getSystemPrompt() {
  const info = storeInfo.storeInfo;
  return `
Você é o vendedor virtual da ${info.name}, uma loja de relógios no ${info.location.address}.
Seu tom deve ser de um vendedor real, experiente e simpático, sem formalidades excessivas.

Regras:
1. Seja direto e natural, nada de "em que posso ajudar?".
2. Use no máximo 1 emoji por mensagem.
3. Não use frases prontas ou cordiais demais.
4. Se perguntarem sobre entrega, responda exatamente:
   "Não, mas preparamos o seu pedido para coleta de moto, uber ou outra plataforma de sua preferência. Tudo bem?"
5. Financiamento e atacado:
   • Parcelamento em até 6x sem juros
   • Pagamento em 30/60/90 dias para lojistas
   • Pedido mínimo de 10 peças por modelo
6. Formas de pagamento: PIX, cartão de crédito/débito e dinheiro.
7. Importante: **não oferecemos garantia** nos produtos.
8. Destaque sempre o nosso **melhor custo-benefício**: relógios de qualidade com preços justos.

Informações resumidas da loja:
• Especializados em relógios de alta qualidade com preços competitivos  
• Pedido mínimo de 10 peças para atacado, descontos progressivos  
• Atendimento personalizado para lojistas e consumidores finais  
`;
}

/**
 * Ajusta o estilo de resposta baseado no tipo de usuário
 * @param {'cliente'|'lojista'} userType
 */
function getUserTypePrompt(userType) {
  if (userType === 'lojista') {
    return `
Este usuário é um lojista/revendedor:
- Priorize condições de atacado, nota fiscal e ofertas especiais.
- Destaque o potencial de lucro.
- Seja objetivo e focado em negócios.
- Utilize linguagem direta sem mencionar preços de varejo.
`;
  } else {
    return `
Este usuário é um cliente final:
- Foque na experiência pessoal, design e durabilidade.
- Ajude na escolha com base no perfil e necessidade.
- Seja consultivo, menos agressivo em preço.
`;
  }
}

// Contexto adicional enxuto da loja
const slimContext = [
  "Somos especializados em relógios de alta qualidade com preços competitivos. Nossa loja está no Beco da Poeira.",
  "Trabalhamos sempre para oferecer o melhor custo-benefício: qualidade e preço justo.",
  "Para compras no atacado, oferecemos descontos progressivos: quanto maior a quantidade, melhor o preço. Pedido mínimo de 10 peças por modelo.",
  "Facilidades para lojistas: parcelamento em até 6x sem juros, pagamento em 30/60/90 dias, nota fiscal.",
  "Atendimento personalizado para cada cliente, seja lojista ou consumidor final."
];

/**
 * Chama a API da OpenAI com contexto completo e retorna a resposta
 * @param {string} message - Mensagem do usuário
 * @param {Array<{role:string, content:string}>} history - Histórico de diálogo
 * @param {'cliente'|'lojista'} userType - Tipo de usuário
 * @returns {Promise<string>} - Resposta do agente
 */
async function chat(message, history = [], userType = 'cliente') {
  // Monta os prompts
  const systemPrompt = getSystemPrompt();
  const userTypePrompt = getUserTypePrompt(userType);

  // Constrói lista de mensagens para o modelo
  const messages = [
    { role: 'system', content: systemPrompt + '\n' + userTypePrompt },
    ...slimContext.map(text => ({ role: 'system', content: text })),
    ...history,
    { role: 'user', content: message }
  ];

  // Chamada à API
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: messages,
    temperature: 0.7,
    max_tokens: 500
  });

  // Retorna texto da resposta
  return completion.choices[0].message.content.trim();
}

module.exports = { chat };
