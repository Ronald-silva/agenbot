// controllers/webhook.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');
const OpenAI = require('openai');

// Leitura e validação das variáveis de ambiente
const rawInstanceId    = process.env.ZAPI_INSTANCE_ID;
const rawInstanceToken = process.env.ZAPI_INSTANCE_TOKEN;
const rawClientToken   = process.env.ZAPI_CLIENT_TOKEN;
const rawOpenAiKey     = process.env.OPENAI_API_KEY;

if (!rawInstanceId || !rawInstanceToken || !rawClientToken || !rawOpenAiKey) {
  console.error(
    '❌ Você precisa definir ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e OPENAI_API_KEY'
  );
  process.exit(1);
}

const INSTANCE_ID    = rawInstanceId.trim();
const INSTANCE_TOKEN = rawInstanceToken.trim();
const CLIENT_TOKEN   = rawClientToken.trim();

// Inicializa cliente OpenAI
const openaiClient = new OpenAI({ apiKey: rawOpenAiKey });

// Função para checar se a instância Z-API está conectada
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

// Handler principal do webhook
module.exports = async function webhook(req, res) {
  console.log('🔥 Payload recebido:', JSON.stringify(req.body));

  // Extrai o telefone do payload (suporte a vários campos possíveis)
  let rawPhone =
    req.body.phone ||
    req.body.chatId ||
    req.body.from ||
    (req.body.data && req.body.data.chatId) ||
    '';
  const phone = rawPhone.replace(/@c\.us$/, '');

  // Extrai o texto da mensagem (suporte a vários formatos)
  const message =
    req.body.message ||
    req.body.body ||
    (req.body.text && req.body.text.message) ||
    (req.body.data && req.body.data.body) ||
    '';

  if (!phone || !message) {
    console.warn('⚠️ Payload inesperado ou incompleto:', req.body);
    return res.status(400).json({ error: 'Dados incompletos', details: req.body });
  }

  console.log(`📩 Mensagem recebida de ${phone}: "${message}"`);

  try {
    // 1) Verifica conexão da instância Z-API
    await checkInstance();

    // 2) Chama OpenAI para gerar resposta
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

    // 3) Envia resposta para Z-API
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
    const details = err.response?.data || err.message;
    return res.status(500).json({ error: 'Erro no webhook', details });
  }
};
