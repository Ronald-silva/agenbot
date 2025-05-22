const axios = require('axios');
const { chat } = require('../services/openai');
const { getClientState, setClientState } = require('../utils/state');
const { getStoreInfo, getAllProducts, getProductById, getProductsByCategory, formatProductInfo, formatPrice } = require('../utils/catalog');

const ZAPI_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_INSTANCE_TOKEN}`;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

// Verifica se a loja está aberta (segunda a sábado, 9h às 17h)
function isStoreOpen() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hour * 60 + minutes;

  const isOpenDay = dayOfWeek >= 1 && dayOfWeek <= 6;
  const isOpenHour = timeInMinutes >= 9 * 60 && timeInMinutes < 17 * 60;

  return isOpenDay && isOpenHour;
}

// Função para enviar mensagem via Z-API
async function sendMessage(phone, message) {
  const maxRetries = 3;
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      console.log(`📤 Enviando mensagem para ${phone} (tentativa ${attempt}/${maxRetries})`);
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
      console.log(`✅ Mensagem enviada (tentativa ${attempt}/${maxRetries})`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem via Z-API (tentativa ${attempt}/${maxRetries}):`, error.response?.data || error.message || error);
      if (attempt === maxRetries) throw error;
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
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

// Função para lidar com saudações
function handleGreeting(message, state) {
  const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
  const lowerMessage = message.toLowerCase();
  const isGreeting = greetings.some(greeting => lowerMessage.includes(greeting));

  if (!isGreeting) return null;

  if (!state.name) {
    return null;
  }

  const timeOfDay = new Date().getHours();
  let greetingResponse = '';
  if (lowerMessage.includes('bom dia') && timeOfDay < 12) {
    greetingResponse = `Bom dia, ${state.name}! Como posso te ajudar hoje? 😊`;
  } else if (lowerMessage.includes('boa tarde') && timeOfDay >= 12 && timeOfDay < 18) {
    greetingResponse = `Boa tarde, ${state.name}! Como posso te ajudar hoje? 😊`;
  } else if (lowerMessage.includes('boa noite') && timeOfDay >= 18) {
    greetingResponse = `Boa noite, ${state.name}! Como posso te ajudar hoje? 😊`;
  } else {
    greetingResponse = `Olá, ${state.name}! Como posso te ajudar hoje? 😊`;
  }

  if (state.type === 'lojista') {
    greetingResponse += '\nSe precisar de ajuda com pedidos no atacado, é só me avisar!';
  } else {
    greetingResponse += '\nPosso te ajudar a encontrar o relógio perfeito, é só me dizer o que você procura!';
  }

  return greetingResponse;
}

// Função principal do webhook
const webhook = async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('🔥 Webhook recebido:', JSON.stringify(req.body));

    const { chatId, text, fromMe, fromApi } = req.body;
    if (fromMe || fromApi) {
      console.log('📥 Mensagem ignorada: fromMe ou fromApi');
      return res.json({ success: true });
    }

    if (!chatId || !text || !text.message) {
      console.log('❌ Dados inválidos no payload');
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const phone = chatId.split('@')[0];
    const message = text.message.trim().toLowerCase();
    let state = getClientState(phone);
    let response = '';

    console.log(`📊 Estado inicial do cliente ${phone}:`, JSON.stringify(state));

    const storeStatus = isStoreOpen() ? "🟢 *Loja Aberta*" : "🔴 *Loja Fechada* (Atendimento online disponível)";
    let responsePrefix = `${storeStatus}\n\n`;

    state.metadata.interactions += 1;
    state.metadata.lastUpdated = Date.now();

    if (!state.name) {
      if (state.lastQuestion === 'askName') {
        const name = text.message.trim();
        if (name.length < 2) {
          response = "Desculpe, o nome parece muito curto. Pode me dizer seu nome completo, por favor?";
          state.lastQuestion = 'askName';
        } else {
          state.name = name;
          console.log(`📋 Nome do cliente definido: ${state.name}`);
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
          console.log(`📋 Tipo do cliente definido: lojista`);
          response = await chat(`O cliente ${state.name} é um lojista/revendedor. Por favor, explique nossas condições especiais de atacado de forma clara e profissional, incluindo descontos progressivos, pedido mínimo e formas de pagamento diferenciadas.`, phone);
          state.lastQuestion = null;
        } else {
          state.type = 'cliente';
          console.log(`📋 Tipo do cliente definido: cliente`);
          response = await chat(`O cliente ${state.name} é um cliente final para uso pessoal. Pergunte sobre qual estilo de relógio ele procura (clássico, esportivo ou casual) ou recomende algo com base nas preferências.`, phone);
          state.lastQuestion = null;
        }
      } else {
        response = await chat(`O cliente ${state.name} ainda não informou se é cliente final ou lojista/revendedor. Pergunte novamente de forma amigável e profissional.`, phone);
        state.lastQuestion = 'askType';
      }
    } else {
      const greetingResponse = handleGreeting(message, state);
      if (greetingResponse) {
        console.log(`📢 Resposta de saudação gerada: ${greetingResponse}`);
        response = greetingResponse;
      } else {
        const catalogResponse = handleProductCatalog(message, state.currentState);
        if (catalogResponse) {
          console.log(`📢 Resposta do catálogo gerada: ${catalogResponse}`);
          response = catalogResponse;
        } else if (state.currentState === 'STORE_INFO_STATE') {
          response = handleStoreInfo();
          console.log(`📢 Resposta de informações da loja gerada: ${response}`);
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
            console.log(`📢 Resposta de reserva gerada: ${response}`);
          } else {
            response = "❌ Desculpe, não encontrei o produto. Use o número do produto (ex.: 'reservar 1') ou o ID (ex.: 'reservar atlantis-masculino'). Para ver os produtos disponíveis, envie 'catálogo'.";
            console.log(`📢 Resposta de erro na reserva: ${response}`);
          }
        } else {
          console.log(`📞 Enviando mensagem "${message}" para OpenAI`);
          response = await chat(message, phone);
          console.log(`📢 Resposta da OpenAI: ${response}`);
        }
      }
    }

    response = responsePrefix + response;
    console.log(`📢 Resposta final gerada: ${response}`);

    setClientState(phone, state);
    console.log(`📊 Estado final do cliente ${phone}:`, JSON.stringify(state));

    await sendMessage(phone, response);
    console.log(`✅ Processamento completo em ${Date.now() - startTime}ms`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.message || err);
    res.status(500).json({ error: 'Erro interno', details: err.message || err });
  }
};

module.exports = webhook;