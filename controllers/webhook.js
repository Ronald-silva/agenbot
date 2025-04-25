// controllers/webhook.js
// Carrega variáveis de ambiente (em desenvolvimento via .env)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');
const OpenAI = require('openai');

// Validação das variáveis de ambiente
const rawInstanceId    = process.env.ZAPI_INSTANCE_ID;
const rawInstanceToken = process.env.ZAPI_INSTANCE_TOKEN;
const rawClientToken   = process.env.ZAPI_CLIENT_TOKEN;
const rawOpenAiKey     = process.env.OPENAI_API_KEY;

if (!rawInstanceId || !rawInstanceToken || !rawClientToken || !rawOpenAiKey) {
  console.error(
    '❌ Necessário definir ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e OPENAI_API_KEY'
  );
  process.exit(1);
}

const INSTANCE_ID    = rawInstanceId.trim();
const INSTANCE_TOKEN = rawInstanceToken.trim();
const CLIENT_TOKEN   = rawClientToken.trim();

// Inicializa cliente OpenAI
const openaiClient = new OpenAI({ apiKey: rawOpenAiKey });

/**
 * Verifica se a instância Z-API está conectada
 */
async function checkInstance() {
  const statusUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const resp = await axios.get(statusUrl, {
    headers: { 'Client-Token': CLIENT_TOKEN }
  });
  const { connected, smartphoneConnected, error } = resp.data;
  console.log('🔍 Z-API status:', resp.data);
  if (!connected || !smartphoneConnected) {
    throw new Error(`Z-API offline: ${error}`);
  }
}

/**
 * Handler do webhook para mensagens recebidas
 */
module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // Extrai telefone (removendo sufixo @c.us)
  let rawPhone = req.body.phone || req.body.chatId || '';
  const phone = rawPhone.replace(/@c\.us$/, '');

  // Extrai texto da mensagem
  const message =
    req.body.message ||
    req.body.body ||
    (req.body.data && req.body.data.body) ||
    '';

  if (!phone || !message) {
    console.warn('⚠️ Payload inesperado:', req.body);
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }

  console.log(`📩 Mensagem recebida de ${phone}: "${message}"`);

  try {
    // 1) Verifica conexão Z-API
    await checkInstance();

    // 2) Gera resposta via OpenAI
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente atencioso e prestativo.' },
        { role: 'user', content: message }
      ],
      max_tokens: 500
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 OpenAI respondeu:', responseText);

    // 3) Envia resposta via Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    const zapiResp = await axios.post(
      sendUrl,
      { phone, message: responseText },
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': CLIENT_TOKEN
        }
      }
    );
    console.log('✅ Z-API respondeu:', zapiResp.data);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no fluxo do webhook:', err.response?.data || err.message);
    const details = err.response?.data || err.message;
    return res.status(500).json({ error: 'Erro ao processar webhook', details });
  }
};
