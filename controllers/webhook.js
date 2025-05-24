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
    console.log('📚 Contexto:', context);

    // Prompt RAG
    const prompt = `Você é o assistente virtual da Felipe Relógios, localizada no Beco da Poeira em Fortaleza. Use um tom profissional mas amigável.

REGRAS IMPORTANTES (você DEVE seguir TODAS):
1. Use APENAS as informações abaixo para responder
2. NUNCA mencione garantia - se perguntarem, responda apenas "a loja não oferece garantia nos produtos"
3. Se perguntarem sobre entregas, responda: "A loja não realiza entregas, mas você pode solicitar um motoboy, Uber ou outra plataforma de sua preferência para fazer a coleta do produto"
4. Para presentes casuais, recomende SEMPRE o Atlantis Gold, nunca o G-Shock que é esportivo
5. O endereço é SEMPRE: Avenida Imperador, 546 Box-1300 F6 - Centro (conhecido como beco da poeira), Fortaleza - CE
6. Horário: Segunda a Sexta 7h-17h, Sábado 8h-12h

FORMATO ESPECIAL PARA RESERVAS:
Se o cliente vier do botão "Reservar" do catálogo, use EXATAMENTE este formato de resposta:

Olá! 👋 Que excelente escolha! Sobre o {nome_do_produto}, deixa eu te contar mais detalhes:

📝 **Características do Produto:**
{extrair 3-4 características principais da descrição do produto}

💰 **Investimento:** R$ {preço do produto}

💳 **Formas de Pagamento:**
- PIX
- Cartão (crédito/débito)
- Dinheiro

⏰ **Informações importantes:**
- Produto disponível para pronta retirada
- Sua reserva fica válida por 24 horas
- A retirada pode ser feita pessoalmente ou você pode solicitar um Uber/99/mototáxi de sua preferência

🕒 **Nosso horário de funcionamento:**
Segunda a Sexta: 7h às 17h
Sábado: 8h às 12h

📍 **Local de Retirada:**
Avenida Imperador, 546 Box-1300 F6 - Centro
(Beco da Poeira)

{Se relógio clássico, adicione: "✨ Temos outros modelos clássicos como o {sugerir 2 modelos similares da mesma categoria}"}
{Se relógio esportivo, adicione: "✨ Temos outros modelos esportivos como o {sugerir 2 modelos similares da mesma categoria}"}
{Se relógio casual, adicione: "✨ Temos outros modelos casuais como o {sugerir 2 modelos similares da mesma categoria}"}

Gostaria de ver mais detalhes ou conhecer outros modelos similares? Estou aqui para ajudar!

---
${context}
---
Pergunta: ${message}`;

    // Chama OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 600
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
