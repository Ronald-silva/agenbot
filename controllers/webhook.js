const axios = require('axios');
const { chat } = require('../services/openai');
const { getClientState, setClientState } = require('../utils/state');
const { getStoreInfo, getAllProducts, getProductById, getProductsByCategory, formatProductInfo, formatPrice } = require('../utils/catalog');

const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_INSTANCE_TOKEN}`;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

// Verifica se a loja está aberta (segunda a sábado, 9h às 17h)
function isStoreOpen() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hour * 60 + minutes;

  const isOpenDay = dayOfWeek >= 1 && dayOfWeek <= 6;
  const isOpenHour = timeInMinutes >= 9 * 60 && timeInMinutes < 17 * 60;

  return isOpenDay && isOpenHour;
}

// Função para enviar mensagem via Z-API
async function sendMessage(phone, message) {
  try {
    const response = await axios.post(
      `${ZAPI_URL}/send-text`,
      {
        phone: phone.replace(/\D/g, ''),
        message: message
      },
      {
        headers: {
          'Client-Token': ZAPI_CLIENT_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Resposta enviada: ${message}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem via Z-API:', error.message || error);
    throw error;
  }
}

// Função para formatar lista de produtos
function formatProductList(products) {
  if (!products || products.length === 0) {
    return "Nenhum produto encontrado nesta categoria.";
  }

  return products.map((product, index) => {
    return `${index + 1}. ${formatProductInfo(product)}\n`;
  }).join('\n');
}

// Função para lidar com o catálogo de produtos
function handleProductCatalog(userMessage, currentState) {
  const stateMapping = {
    'VIEW_ALL_PRODUCTS': getAllProducts(),
    'VIEW_CLASSIC_PRODUCTS': getProductsByCategory('Clássico'),
    'VIEW_SPORT_PRODUCTS': getProductsByCategory('Esportivo'),
    'VIEW_CASUAL_PRODUCTS': getProductsByCategory('Casual'),
    'VIEW_DIGITAL_PRODUCTS': getProductsByCategory('Digital'),
    'VIEW_FEMALE_PRODUCTS': getProductsByCategory('Feminino')
  };

  const products = stateMapping[currentState];
  if (!products) return null;

  return formatProductList(products);
}

// Função para lidar com informações da loja
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

  message += `\n📌 *Observações*\n`;
  storeInfo.observations.forEach(observation => {
    message += `• ${observation}\n`;
  });

  return message;
}

// Função principal do webhook
const webhook = async (req, res) => {
  try {
    console.log('🔥 Payload recebido:', JSON.stringify(req.body));

    const { chatId, text, fromMe, fromApi } = req.body;
    if (fromMe || fromApi) {
      return res.json({ success: true });
    }

    if (!chatId || !text || !text.message) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const phone = chatId.split('@')[0];
    const message = text.message.trim().toLowerCase();
    let state = getClientState(phone);
    let response = '';

    // Verifica se a loja está aberta
    const storeStatus = isStoreOpen() ? "🟢 *Loja Aberta*" : "🔴 *Loja Fechada* (Atendimento online disponível)";
    let responsePrefix = `${storeStatus}\n\n`;

    // Incrementa interações
    state.metadata.interactions += 1;
    state.metadata.lastUpdated = Date.now();

    // Fluxo de identificação
    if (!state.name) {
      if (state.lastQuestion === 'askName') {
        const name = text.message.trim();
        if (name.length < 2) {
          response = "Desculpe, o nome parece muito curto. Pode me dizer seu nome completo, por favor?";
          state.lastQuestion = 'askName';
        } else {
          state.name = name;
          response = await chat(`O cliente acabou de informar que se chama "${state.name}". Por favor, dê boas vindas e pergunte se é um cliente final ou lojista/revendedor de uma forma amigável e profissional.`, phone);
          state.lastQuestion = 'askType';
        }
      } else {
        response = await chat("Por favor, dê boas vindas a um novo cliente e peça seu nome de forma amigável e profissional.", phone);
        state.lastQuestion = 'askName';
      }
    } else if (!state.type) {
      if (state.lastQuestion === 'askType') {
        const typeResponse = message;
        if (typeResponse.includes('lojista') || typeResponse.includes('revendedor')) {
          state.type = 'lojista';
          response = await chat(`O cliente ${state.name} é um lojista/revendedor. Por favor, explique nossas condições especiais de atacado de forma clara e profissional, incluindo descontos progressivos, pedido mínimo e formas de pagamento diferenciadas.`, phone);
          state.lastQuestion = null;
        } else {
          state.type = 'cliente';
          response = await chat(`O cliente ${state.name} é um cliente final para uso pessoal. Pergunte sobre qual estilo de relógio ele procura (clássico, esportivo ou casual) ou recomende algo com base nas preferências.`, phone);
          state.lastQuestion = null;
        }
      } else {
        response = await chat(`O cliente ${state.name} ainda não informou se é cliente final ou lojista/revendedor. Pergunte novamente de forma amigável e profissional.`, phone);
        state.lastQuestion = 'askType';
      }
    } else {
      // Fluxo de navegação pelo catálogo ou informações
      const catalogResponse = handleProductCatalog(message, state.currentState);
      if (catalogResponse) {
        response = catalogResponse;
      } else if (state.currentState === 'STORE_INFO_STATE') {
        response = handleStoreInfo();
      } else if (message.includes('reservar')) {
        let product = null;
        const matchByNumber = message.match(/reservar\s+(\d+)/i);
        const matchById = message.match(/reservar\s+([a-z0-9-]+)/i);

        if (matchByNumber) {
          const productIndex = parseInt(matchByNumber[1]) - 1;
          const products = getAllProducts();
          if (productIndex >= 0 && productIndex < products.length) {
            product = products[productIndex];
          }
        } else if (matchById) {
          const productId = matchById[1];
          product = getProductById(productId);
        }

        if (product) {
          const reservationTime = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
          response = `✅ *Reserva Confirmada!*\n\nVocê reservou o *${product.name}* por ${formatPrice(product.price)}.\n*Data/Hora da Reserva*: ${reservationTime}\nO produto estará separado por 24h na loja Felipe Relógios (Avenida Imperador, 546 Box-12 - Centro).\n\nPara retirada, aceitamos PIX, cartões ou dinheiro. Se preferir entrega, você pode contratar um serviço de transporte (moto, Uber, etc.), sendo o custo por sua conta.\n\nQualquer dúvida, estamos à disposição! 😊`;
          state.lastReservation = product.id;
        } else {
          response = "❌ Desculpe, não encontrei o produto. Use o número do produto (ex.: 'reservar 1') ou o ID (ex.: 'reservar atlantis-masculino'). Para ver os produtos disponíveis, envie 'catálogo'.";
        }
      } else {
        response = await chat(message, phone);
      }
    }

    // Adiciona o status da loja à resposta
    response = responsePrefix + response;

    // Salva o estado
    setClientState(phone, state);

    // Envia a resposta ao cliente
    await sendMessage(phone, response);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.message || err);
    res.status(500).json({ error: 'Erro interno', details: err.message || err });
  }
};

module.exports = webhook;