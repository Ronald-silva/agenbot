// controllers/webhook.js
require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');

// Carregar e limpar variáveis de ambiente
const rawInstanceId    = process.env.ZAPI_INSTANCE_ID;
const rawInstanceToken = process.env.ZAPI_INSTANCE_TOKEN;
const rawClientToken   = process.env.ZAPI_CLIENT_TOKEN;

if (!rawInstanceId || !rawInstanceToken || !rawClientToken) {
  console.error('❌ ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN ou ZAPI_CLIENT_TOKEN não definidos no .env');
  process.exit(1);
}

const INSTANCE_ID    = rawInstanceId.trim();
const INSTANCE_TOKEN = rawInstanceToken.trim();  // Token principal da instância
const CLIENT_TOKEN   = rawClientToken.trim();    // Token de segurança extra

// Inicializar cliente OpenAI
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Verifica se a instância Z-API está conectada e pronta
 */
async function checkInstance() {
  const statusUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const resp = await axios.get(statusUrl, {
    headers: { 'Client-Token': CLIENT_TOKEN }
  });
  const { connected, smartphoneConnected, error } = resp.data;
  console.log('🔍 Status da instância Z-API:', resp.data);
  if (!connected || !smartphoneConnected) {
    throw new Error(`Instância Z-API offline: ${error || 'not connected'}`);
  }
  return resp.data;
}

/**
 * Handler principal do webhook
 */
module.exports = async function webhook(req, res) {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }

  console.log(`📩 Mensagem recebida de ${phone}: "${message}"`);

  try {
    // 1) Verificar instância Z-API
    await checkInstance();

    // 2) Gerar resposta via OpenAI
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é um assistente atencioso e prestativo.' },
        { role: 'user',   content: message }
      ],
      max_tokens: 500
    });
    const responseText = completion.choices[0].message.content.trim();
    console.log('🤖 OpenAI respondeu:', responseText);

    // 3) Enviar resposta para Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    const zapiResp = await axios.post(
      sendUrl,
      { phone, message: responseText },
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': CLIENT_TOKEN  // Token de segurança extra
        }
      }
    );

    console.log('✅ Z-API respondeu:', zapiResp.data);
    return res.json({ success: true });

  } catch (err) {
    console.error('❌ Erro no fluxo do webhook:', err.response?.data || err.message || err);
    const details = err.response?.data || err.message;
    return res.status(500).json({ error: 'Erro ao processar webhook', details });
  }
};
