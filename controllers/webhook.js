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
async function retrieveContext(question, topK = 5) {
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

    // Recupera contexto
    const context = await retrieveContext(message);
    console.log('📚 Contexto:', context);    // Prompt RAG
    const prompt = `Você é o assistente virtual da Felipe Relógios, localizada no Beco da Poeira em Fortaleza. Seu objetivo é ajudar os clientes a encontrar o relógio perfeito e fornecer informações precisas sobre nossos produtos e serviços. Use um tom profissional mas amigável.

IMPORTANTE:
1. NUNCA faça suposições ou invente informações sobre produtos
2. Use APENAS os modelos, preços e características mencionados no contexto fornecido
3. NUNCA mencione nada sobre garantia dos produtos
4. Se não tiver certeza sobre uma informação, diga que precisará verificar
5. Nunca mencione produtos ou preços que não estejam no contexto
6. Se alguém perguntar sobre garantia, responda que a loja não oferece garantia nos produtos\n---\n${context}\n---\nPergunta: ${message}`;

    // Chama OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [ { role: 'system', content: prompt } ],
      max_tokens: 300
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
