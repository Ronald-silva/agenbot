// controllers/webhook.js
if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const axios  = require('axios');
const OpenAI = require('openai');

// Variáveis de ambiente
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN?.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN || !OPENAI_KEY) {
  console.error('❌ Faltando uma ou mais variáveis de ambiente: ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN, OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url,
    { headers: { 'Client-Token': CLIENT_TOKEN } }
  );
  console.log('🔍 Z-API status:', data);
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // Filtra somente callbacks de mensagem recebida e ignora mensagens do bot
  if (req.body.type !== 'ReceivedCallback' || req.body.fromApi === true || req.body.fromMe === true) {
    return res.sendStatus(200);
  }

   // Normalize telefone do usuário (só chatId ou from, sem connectedPhone)
const rawPhone = req.body.chatId
|| req.body.from
|| '';
// remove tudo a partir do “@” (c.us, l, etc)
const phone = rawPhone.split('@')[0];


  // Normalize texto: texto pode vir em text.message ou body
  const message = req.body.text?.message
    || req.body.body
    || req.body.message
    || '';

  if (!phone || !message) {
    console.warn('⚠️ Payload inválido ou incompleto:', req.body);
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }
  console.log(`📩 Mensagem de ${phone}: "${message}"`);

  try {
    await checkInstance();

    // Chama OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é o LuceBot, assistente do Colégio Luce. Seja profissional, claro e institucional, respondendo dúvidas de matrícula, calendário, localização e redirecionando para atendimento humano quando necessário.' },
        { role: 'user',   content: message }
      ],
      max_tokens: 300
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 Resposta IA:', responseText);

    // Envia via Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    const zapiResp = await axios.post(
      sendUrl,
      { phone, message: responseText },
      { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
    );
    console.log('✅ Z-API respondeu:', zapiResp.data);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao processar webhook:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro interno', details: err.response?.data || err.message });
  }
};
