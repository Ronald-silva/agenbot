// controllers/webhook.js (RAG in-memory via contexts.json)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios    = require('axios');
const OpenAI   = require('openai');
const contexts = require('../contexts.json'); // array of {snippet, embedding}

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

// Sem banco: simples função de similaridade
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Recupera contexto do JSON em memória
async function retrieveContext(question, topK = 3) {
  // 1) embedding da pergunta
  const embedResp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question
  });
  const qv = embedResp.data[0].embedding;

  // 2) calcula similaridade
  const sims = contexts.map(c => ({ snippet: c.snippet, score: cosine(qv, c.embedding) }));

  // 3) pega os topK
  return sims
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ snippet }) => snippet)
    .join('\n---\n');
}

// Verifica status da instância Z-API
async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
  console.log('🔍 Z-API status:', data);
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // Filtra apenas mensagens de usuário
  if (req.body.type !== 'ReceivedCallback' || req.body.fromApi || req.body.fromMe) {
    return res.sendStatus(200);
  }

  // Extrai telefone
  const rawPhone = req.body.chatId || req.body.phone || '';
  const phone = rawPhone.split('@')[0];
  if (!phone) return res.status(400).json({ error: 'Número não encontrado' });

  // Extrai mensagem
  const message = req.body.text?.message || req.body.body || req.body.message || '';
  if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

  console.log(`📩 De ${phone}: "${message}"`);

  try {
    await checkInstance();
    const context = await retrieveContext(message);
    console.log('📚 Contexto:', context);

    const prompt = `Você é o assistente da Felipe Relógios (Beco da Poeira). Seja profissional e direto.

PRODUTOS:
Clássicos (R$): Atlantis Masculino (80), Bulgari Cassino (90,90), Festina Dourado (80,90), Gold Blue (80), Gold White (80,90), Bulgari Hélice (90,90), Atlantis 2em1 (90,90)
Esportivo (R$): G-Shock (35,90)
Casual (R$): Atlantis Gold (50,90)

REGRAS:
1. Sem garantia - responda "a loja não oferece garantia"
2. Sem entregas - diga "solicite um Uber/mototáxi para coleta"
3. Endereço: Av. Imperador, 546 Box-1300 F6 - Centro (Beco da Poeira)
4. Horário: Seg-Sex 7h-17h, Sáb 8h-12h

FLUXO DE RESERVA:

1. QUANDO CLIENTE PEDIR INFORMAÇÃO DE PRODUTO:
Olá! 👋 Sobre o [PRODUTO]:

📝 **Características:**
[DESCRIÇÃO]

💰 **Valor:** R$ [PREÇO]

💳 **Pagamento:**
- PIX, Cartão, Dinheiro

⏰ **Importante:**
- Pronta retirada
- Reserva: 24h
- Retirada: pessoalmente ou Uber/mototáxi

🕒 **Horário:**
Seg-Sex 7h-17h, Sáb 8h-12h

📍 **Local:**
Av. Imperador, 546 Box-1300 F6 (Beco da Poeira)

[SUGERIR 2 SIMILARES]

✨ Posso reservar para você?

2. QUANDO CLIENTE RESPONDER "sim" APÓS APRESENTAÇÃO DE PRODUTO:
Ótimo! 🎉 Sua reserva do [PRODUTO MENCIONADO ANTERIORMENTE] foi confirmada por 24h.

Para finalizar a compra:
- Venha até nossa loja ou
- Envie um Uber/mototáxi para retirada

Precisa de mais alguma informação? Estou à disposição! 😊

3. QUANDO CLIENTE RESPONDER "não":
Sem problemas! Posso te apresentar outros modelos ou tirar outras dúvidas? Estou aqui para ajudar! 😊

4. MANTENHA O CONTEXTO:
- Se o cliente acabou de pedir informações sobre um produto e responde "sim", isso significa que ele quer reservar AQUELE produto
- Não apresente um produto novo quando o cliente confirmar uma reserva
- Não perca o contexto da conversa

---
${context}
---
Pergunta: ${message}`;    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 IA respondeu:', responseText);

    // Envia via Z-API
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
