// controllers/webhook.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios  = require('axios');
const OpenAI = require('openai');

// --- Variáveis de ambiente ---
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN?.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN || !OPENAI_KEY) {
  console.error(
    '❌ Defina todas as vars: ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e OPENAI_API_KEY'
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// --- Função de check da instância Z-API ---
async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, {
    headers: { 'Client-Token': CLIENT_TOKEN }
  });
  console.log('🔍 Z-API status:', data);
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

// --- Handler do webhook ---
module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // 1) Só processa callbacks de mensagem recebida
  if (
    req.body.type !== 'ReceivedCallback' ||
    req.body.fromApi === true ||
    req.body.fromMe === true
  ) {
    return res.sendStatus(200);
  }

  // 2) Extrai o telefone do usuário: chatId ou phone
  const rawPhone = req.body.chatId || req.body.phone || '';
  const phone = rawPhone.split('@')[0];  // remove sufixo depois do '@'
  if (!phone) {
    console.warn('⚠️ Número não encontrado no payload:', req.body);
    return res.sendStatus(400);
  }

  // 3) Extrai o texto da mensagem
  const message =
    req.body.text?.message ||
    req.body.body ||
    req.body.message ||
    '';
  if (!message) {
    console.warn('⚠️ Texto não encontrado no payload:', req.body);
    return res.sendStatus(400);
  }

  console.log(`📩 De ${phone}: "${message}"`);

  try {
    // 4) Confirma instância ativa
    await checkInstance();

    // 5) Gera resposta com IA
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
Você é o LuceBot, assistente do Colégio Luce. 
Fale de forma profissional e institucional, respondendo dúvidas de:
- Matrículas e valores
- Calendário e horários
- Localização e transporte
- Projetos e eventos
Encaminhe ao atendimento humano quando necessário.
`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 300
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 IA respondeu:', responseText);

    // 6) Envia de volta pelo Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    const zapiResp = await axios.post(
      sendUrl,
      { phone, message: responseText },
      { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
    );
    console.log('✅ Z-API respondeu:', zapiResp.data);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.response?.data || err.message);
    return res
      .status(500)
      .json({ error: 'Erro interno', details: err.response?.data || err.message });
  }
};
