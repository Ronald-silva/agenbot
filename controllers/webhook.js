// controllers/webhook.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const axios   = require('axios');
const OpenAI  = require('openai');

const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Checa status da Z-API
async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

module.exports = async function webhook(req, res) {
  // 1) Capture payload
  console.log('🔥 Payload:', req.body);
  if (req.body.fromApi || req.body.event !== 'incoming-message') {
    return res.sendStatus(200);
  }

  // 2) Normalize
  const rawPhone = req.body.phone || req.body.chatId || '';
  const phone    = rawPhone.replace(/@c\.us$/, '');
  const message  = req.body.body || req.body.text?.message || req.body.message || '';

  if (!phone || !message) {
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }
  console.log(`📩 De ${phone}: "${message}"`);

  try {
    await checkInstance();

    // 3) Monta o prompt customizado para Colégio Luce
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Você é o LuceBot, assistente oficial do Colégio Luce. 
Fale sempre de forma clara, acolhedora, profissional e com tom institucional.
Seja objetivo em respostas sobre:
 • Matrículas e bolsas  
 • Valores e formas de pagamento  
 • Turnos, horários e calendário letivo  
 • Localização, transporte e contato  
 • Projetos pedagógicos e eventos da escola  
Nunca informe dados pessoais ou confidenciais; redirecione para contato humano quando necessário.`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 LuceBot respondeu:', responseText);

    // 4) Envia via Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    await axios.post(
      sendUrl,
      { phone, message: responseText },
      { headers: { 'Client-Token': CLIENT_TOKEN } }
    );
    console.log('✅ Enviado a', phone);
    return res.json({ success: true });

  } catch (err) {
    console.error('❌ Erro no webhook:', err.message || err);
    return res.status(500).json({ error: 'Erro interno', details: err.message });
  }
};
