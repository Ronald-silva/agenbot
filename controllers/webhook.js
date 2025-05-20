// controllers/webhook.js
// Webhook para atendimento via Z-API e OpenAI (GPT-4o) com estado por cliente

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');
const { chat } = require('../services/openai'); // usa openai.js refatorado
const { getClientState, setClientState } = require('../utils/state');
const { getStoreInfo, getAllProducts, getProductsByCategory, formatProductInfo } = require('../utils/catalog');

// Variáveis de ambiente
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN) {
  console.error('❌ Defina ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN no .env');
  process.exit(1);
}

// Checa status da instância Z-API
async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error || 'sem conexão'}`);
  }
}

// Formata lista de produtos para exibição
function formatProductList(products) {
  let message = "🕐 *Catálogo de Produtos*\n\n";
  products.forEach((product, index) => {
    message += `${index + 1}. ${product.name} - ${formatPrice(product.price)}\n`;
  });
  message += "\nPara ver detalhes de um produto, envie o número correspondente.";
  return message;
}

// Manipula catálogo de produtos com base no estado do usuário
function handleProductCatalog(userMessage, currentState) {
  const stateMapping = {
    'VIEW_ALL_PRODUCTS': getAllProducts(),
    'VIEW_CLASSIC_PRODUCTS': getProductsByCategory('Clássico'),
    'VIEW_SPORT_PRODUCTS': getProductsByCategory('Esportivo'),
    'VIEW_CASUAL_PRODUCTS': getProductsByCategory('Casual')
  };

  const products = stateMapping[currentState];
  if (!products) return null;

  return formatProductList(products);
}

// Manipula informações da loja
function handleStoreInfo() {
  const storeInfo = getStoreInfo();
  let message = "ℹ️ *Informações da Loja*\n\n";
  
  message += `🕐 *Horário de Funcionamento*\n`;
  message += `${storeInfo.hours.weekdays}\n`;
  message += `${storeInfo.hours.weekends}\n`;
  message += `${storeInfo.hours.online}\n\n`;

  message += `📍 *Endereço*\n`;
  message += `${storeInfo.location.address}\n\n`;

  message += `📱 *Contato*\n`;
  message += `WhatsApp: ${storeInfo.contact.whatsapp}\n`;
  message += `Instagram: ${storeInfo.contact.instagram}\n\n`;

  message += `💳 *Políticas da Loja*\n`;
  Object.values(storeInfo.policies).forEach(policy => {
    message += `• ${policy}\n`;
  });

  return message;
}

// Função principal do webhook
module.exports = async function webhook(req, res) {
  try {
    const body = req.body;
    console.log('🔥 Payload recebido:', JSON.stringify(body));

    // Ignora mensagens que não sejam de usuário
    if (body.type !== 'ReceivedCallback' || body.fromApi || body.fromMe) {
      return res.sendStatus(200);
    }

    const rawPhone = body.chatId || body.phone || '';
    const phone = rawPhone.split('@')[0];
    if (!phone) return res.status(400).json({ error: 'Número não encontrado' });

    const message = body.text?.message || body.body || '';
    if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

    await checkInstance();    // Carrega estado do cliente
    const state = getClientState(phone) || { lastQuestion: null, name: null, type: null };

    // Define prompt base e atualiza estado se for pergunta de nome/tipo
    let response;
    if (!state.name) {
      // Pergunta inicial de nome
      if (state.lastQuestion === 'askName') {
        state.name = message.trim();
        response = await chat(`O cliente acabou de informar que se chama "${state.name}". Por favor, dê boas vindas e pergunte se é um cliente final ou lojista/revendedor de uma forma amigável e profissional.`, phone);
        state.lastQuestion = 'askType';
      } else {
        response = await chat("Por favor, dê boas vindas a um novo cliente e peça seu nome de forma amigável e profissional.", phone);
        state.lastQuestion = 'askName';
      }
    } else if (!state.type) {
      // Pergunta de tipo de cliente
      const lower = message.toLowerCase();
      if (/lojista|revenda|atacado/.test(lower)) {
        state.type = 'lojista';
        response = await chat(`O cliente ${state.name} é um lojista/revendedor. Por favor, explique nossas condições especiais de atacado, descontos progressivos e parcelamento, e pergunte sobre a quantidade de interesse.`, phone);
      } else {
        state.type = 'cliente';
        response = await chat(`O cliente ${state.name} é um cliente final para uso pessoal. Por favor, dê boas vindas e pergunte sobre qual estilo de relógio ele procura (clássico, esportivo ou casual).`, phone);
      }
      state.lastQuestion = null;
    } else {
      // Fluxo geral: use OpenAI para resposta natural com contexto completo
      setClientState(phone, state);
      response = await chat(message, phone);
    }

    // Salva estado atualizado
    setClientState(phone, state);

    // Envia resposta via Z-API
    const sendUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    await axios.post(sendUrl,
      { phone, message: response },
      { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
    );

    console.log('✅ Resposta enviada:', response);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.message || err);
    res.status(500).json({ error: 'Erro interno', details: err.message || err });
  }
};
