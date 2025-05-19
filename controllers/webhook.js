// controllers/webhook.js (RAG in-memory via contexts.json)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios    = require('axios');
const OpenAI   = require('openai');
const contexts = require('../contexts.json');
const { getClientState, setClientState } = require('../utils/state');

// Vars de ambiente
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN?.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN || !OPENAI_KEY) {
  console.error('❌ Defina ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Recupera contexto do JSON em memória
async function retrieveContext(question, topK = 5) {
  const embedResp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question
  });
  const qv = embedResp.data[0].embedding;

  const sims = contexts.map(c => ({ 
    snippet: c.snippet, 
    score: cosine(qv, c.embedding) 
  }));

  return sims
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ snippet }) => snippet)
    .join('\n---\n');
}

// Função de similaridade
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Verifica status da instância Z-API
async function checkInstance() {
  try {
    const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
    const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
    console.log('🔍 Z-API status:', data);
    if (!data.connected || !data.smartphoneConnected) {
      throw new Error(`Z-API offline: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ Erro ao verificar Z-API:', error.message);
    throw error;
  }
}

// Webhook principal
module.exports = async function webhook(req, res) {
  console.log('🔥 Felipe-Bot - Payload recebido:', JSON.stringify(req.body, null, 2));

  // Log do tipo de mensagem
  console.log('📋 Felipe-Bot - Tipo:', req.body.type, 'fromApi:', req.body.fromApi, 'fromMe:', req.body.fromMe);

  if (req.body.type !== 'ReceivedCallback' || req.body.fromApi || req.body.fromMe) {
    console.log('⏩ Ignorando mensagem que não é do cliente');
    return res.sendStatus(200);
  }

  const rawPhone = req.body.chatId || req.body.phone || '';
  const phone = rawPhone.split('@')[0];
  console.log('📞 Número detectado:', phone);
  if (!phone) {
    console.log('❌ Número não encontrado no payload');
    return res.status(400).json({ error: 'Número não encontrado' });
  }

  const message = req.body.text?.message || req.body.body || req.body.message || '';
  console.log('💬 Mensagem detectada:', message);
  if (!message) {
    console.log('❌ Mensagem vazia no payload');
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  console.log(`📩 De ${phone}: "${message}"`);

  try {
    await checkInstance();
    
    // Recupera ou inicializa o estado do cliente
    const clientState = getClientState(phone);
    console.log('🔑 Estado do cliente:', clientState);

    // Se o tipo de cliente ainda não foi identificado, vamos tentar identificar
    if (!clientState.type && !message.toLowerCase().includes('oi') && !message.toLowerCase().includes('olá')) {
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('lojista') || lowerMsg.includes('revenda') || lowerMsg.includes('atacado')) {
        clientState.type = 'lojista';
        setClientState(phone, clientState);
      } else if (lowerMsg.includes('cliente') || lowerMsg.includes('comprar') || lowerMsg.includes('particular')) {
        clientState.type = 'cliente';
        setClientState(phone, clientState);
      }
    }

    const context = await retrieveContext(message);
    console.log('📚 Contexto:', context);
      let basePrompt;
    const firstMessage = !clientState.type && (message.toLowerCase().includes('oi') || message.toLowerCase().includes('olá'));

    if (firstMessage) {
      basePrompt = `Você é o FelipeBot, atendente virtual da loja Felipe Relógios, especializada em relógios com ótimo custo-benefício.

Inicie com uma saudação acolhedora e pergunte o nome do cliente de forma gentil, como:
"Olá! Que bom te ver por aqui 😊 Posso te ajudar com algo? Ah, posso saber seu nome pra te atender melhor?"

Em seguida, após o cliente responder, use o nome com naturalidade e descubra se é lojista ou consumidor final com uma pergunta leve:
"Pra te atender melhor, você está comprando para você ou é lojista/revendedor?"`;
    } else if (clientState.type) {
      basePrompt = `Você é o FelipeBot, atendente virtual da loja Felipe Relógios. 
Você está atendendo um ${clientState.type === 'lojista' ? 'lojista/revendedor' : 'cliente final'}.

${clientState.type === 'lojista' ? `Conduza com entusiasmo e profissionalismo, focando em:
- Preços especiais no atacado
- Descontos progressivos por quantidade
- Pedido mínimo de 10 unidades
- Parcelamento em até 6x sem juros ou 30/60/90 no boleto

Use gatilhos como:
- "Esse modelo costuma ter alta demanda"
- "Um dos favoritos dos nossos revendedores"
- "Excelente margem de revenda"` :
`Personalize o atendimento focando em:
- Entender o estilo (casual, esportivo, elegante)
- Recomendar modelos adequados ao perfil
- Informar condições para cliente final
- Deixar claro que não há garantia no produto

Use gatilhos como:
- "Esse modelo tá incrível"
- "Visual bem imponente"
- "Custo-benefício top"`}

Use o nome do cliente apenas em momentos estratégicos:
- Ao mudar de assunto
- Ao fazer uma nova pergunta importante
- Evite repetir o nome em cada resposta

Use emojis com equilíbrio 😊🕒✨
Evite frases robóticas ou repetitivas
Responda sempre de forma fluida e natural`;
    } else {
      basePrompt = `Você é o FelipeBot, atendente virtual da loja Felipe Relógios.
Pergunte educadamente se a pessoa é lojista/revendedor ou cliente final:
"Pra te atender melhor, você está comprando para você ou é lojista/revendedor?"

Use linguagem natural e evite repetições.`;
    }

    const prompt = `${basePrompt}

Seja educado, humanizado e especialista. Use linguagem simples e direta com tom amigável.
A loja está localizada na Avenida Imperador, 546 - Centro (Beco da Poeira), Fortaleza-CE.

As informações sobre produtos, pagamentos, entregas e diferenciais estão abaixo:
---
${context}
---
Pergunta: ${message}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 300
    });    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 IA respondeu:', responseText);
    
    // Log do estado atual do cliente após processamento
    const finalState = getClientState(phone);
    console.log('📊 Estado final do cliente:', JSON.stringify(finalState, null, 2));

    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    await axios.post(
      sendUrl,
      { phone, message: responseText },
      { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
    );
    console.log('✅ Z-API respondeu');

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro interno', details: err.response?.data || err.message });
  }
};
