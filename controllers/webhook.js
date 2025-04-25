// controllers/webhook.js
if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const axios  = require('axios');
const OpenAI = require('openai');

// Vars de ambiente já validadas anteriormente...
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY.trim();

const openai = new OpenAI({ apiKey: OPENAI_KEY });

async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // 1) Filtra apenas callbacks de recebimento de usuário
  if (req.body.type !== 'ReceivedCallback' || req.body.fromApi === true) {
    return res.sendStatus(200);
  }

  // 2) Normalize phone e message
  const rawPhone = req.body.chatId || req.body.from || '';
  const phone    = rawPhone.replace(/@c\.us$/, '');
  const message  = req.body.text?.message || req.body.body || '';

  if (!phone || !message) {
    console.warn('⚠️ Payload inválido:', req.body);
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }
  console.log(`📩 De ${phone}: "${message}"`);

  try {
    // 3) Confirma Z-API conectada
    await checkInstance();

    // 4) Gera resposta com OpenAI
    const completion  = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Você é o LuceBot, assistente do Colégio Luce. Fale de modo profissional, claro e institucional.
Atenda dúvidas de matrícula, calendário, localização, projetos e redirecione para atendimento humano quando necessário.
`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 Resposta IA:', responseText);

    // 5) Envia de volta via Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    const zapiResp = await axios.post(
      sendUrl,
      { phone, message: responseText },
      { headers: { 'Client-Token': CLIENT_TOKEN } }
    );
    console.log('✅ Z-API respondeu:', zapiResp.data);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.response?.data || err.message);
    const details = err.response?.data || err.message;
    return res.status(500).json({ error: 'Erro interno', details });
  }
};
