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

PRODUTOS E DESCRIÇÕES EXATAS:
1. Atlantis Masculino (R$ 80,00) - "Design robusto e elegante com pulseira metálica, mostrador moderno (preto ou prata) e resistência à água de até 50m. Ideal para quem busca estilo e durabilidade com ótimo custo-benefício."
2. G-Shock Digital (R$ 35,90) - "Modelo esportivo com visual moderno e acabamento fosco. Resistente a impactos, com pulseira em silicone e visor digital com funções de hora, data e cronômetro."
3. Atlantis Gold (R$ 50,90) - "Modelo leve e moderno com pulseira de borracha texturizada e caixa dourada. Disponível em mostradores coloridos (preto, azul e vermelho), resistente à água até 50m."
4. Bulgari Cassino (R$ 90,90) - "Inspirado no glamour dos cassinos, esse modelo traz um mostrador temático com visual de roleta e acabamento dourado imponente."
5. Festina Dourado (R$ 80,90) - "Design robusto, mostrador multifuncional e acabamento totalmente dourado. Ideal para quem busca um relógio de alto impacto visual."
6. Festina Gold Blue (R$ 80,00) - "Acabamento dourado premium e mostrador azul profundo. Equipado com cronógrafo funcional e estrutura robusta."
7. Festina Gold White (R$ 80,90) - "Design imponente com pulseira dourada de alta resistência e mostrador branco detalhado que inspira elegância."
8. Bulgari Hélice Azul (R$ 90,90) - "Um espetáculo visual com mostrador azul em formato de hélice, este relógio Bulgari une ousadia e sofisticação. Sua estrutura dourada impõe respeito."
9. Atlantis 2 em 1 (R$ 90,90) - "Combinando mostrador analógico clássico e visor digital funcional. Disponível nas versões branca e dourada, resistente à água (50M)."

REGRAS:
1. Use SEMPRE as descrições EXATAS acima
2. Sem garantia - responda "a loja não oferece garantia"
3. Sem entregas - diga "solicite um Uber/mototáxi para coleta"
4. Endereço: Av. Imperador, 546 Box-1300 F6 - Centro (Beco da Poeira)
5. Horário: Seg-Sex 7h-17h, Sáb 8h-12h

FLUXO DE RESERVA:

1. QUANDO CLIENTE PEDIR INFORMAÇÃO DE PRODUTO:
Olá! 👋 Sobre o [PRODUTO]:

📝 **Características:**
[USAR A DESCRIÇÃO EXATA DO PRODUTO LISTADA ACIMA]

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

Sugestões similares:
[SUGERIR 2 PRODUTOS DA MESMA CATEGORIA, USANDO NOME E PREÇO]

✨ Posso reservar para você?

2. QUANDO CLIENTE RESPONDER "sim" APÓS APRESENTAÇÃO DE PRODUTO:
Ótimo! 🎉 Sua reserva do [NOME EXATO DO PRODUTO] foi confirmada por 24h.

Para finalizar a compra:
- Venha até nossa loja ou
- Envie um Uber/mototáxi para retirada

Precisa de mais alguma informação? Estou à disposição! 😊

MANTENHA O CONTEXTO:
- Use SEMPRE o nome completo e exato dos produtos
- Se o cliente acabou de ver um produto e responde "sim", isso significa que ele quer reservar AQUELE produto
- Não apresente um produto novo quando o cliente confirmar uma reserva
- Não perca o contexto da conversa

---
${context}
---
Pergunta: ${message}`;

    const completion = await openai.chat.completions.create({
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
