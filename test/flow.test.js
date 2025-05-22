const axios = require('axios');
const webhook = require('../controllers/webhook');
const { getClientState, setClientState } = require('../utils/state');
const { chat } = require('../services/openai');

jest.mock('axios');
jest.mock('../services/openai');

beforeAll(() => {
  // Mock para chamadas à Z-API
  axios.get.mockImplementation(() =>
    Promise.resolve({ data: { connected: true, smartphoneConnected: true } })
  );
  axios.post.mockImplementation(() =>
    Promise.resolve({ data: { success: true } })
  );

  // Mock para o chat do OpenAI
  chat.mockImplementation((message, phone) => {
    if (message.includes('dê boas vindas a um novo cliente')) {
      return Promise.resolve('Olá! Bem-vindo(a) à Felipe Relógios! 😊 Como posso te ajudar hoje? Posso saber seu nome, por favor?');
    } else if (message.includes('O cliente acabou de informar que se chama')) {
      return Promise.resolve('Prazer em conhecê-lo(a)! Você está comprando para uso pessoal ou é lojista/revendedor?');
    } else if (message.includes('é um lojista/revendedor')) {
      return Promise.resolve('Ótimo! Para lojistas, temos condições especiais: descontos progressivos por quantidade, pedido mínimo de 10 unidades, e parcelamento em até 6x sem juros ou 30/60/90 no boleto. Qual quantidade você tem interesse?');
    } else if (message.includes('é um cliente final')) {
      return Promise.resolve('Que bom tê-lo(a) aqui! 😊 Qual estilo de relógio você procura? Clássico, esportivo ou casual?');
    }
    return Promise.resolve('Resposta mockada para mensagem geral.');
  });
});

beforeEach(() => {
  // Limpa o estado antes de cada teste
  setClientState('85991575525', null);
  setClientState('old-user', null);
});

afterAll(() => {
  jest.restoreAllMocks();
});

function mockReq(message, phone = '85991575525') {
  return {
    body: {
      type: 'ReceivedCallback',
      chatId: `${phone}@c.us`,
      text: { message },
      fromMe: false,
      fromApi: false
    }
  };
}

const mockRes = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  sendStatus: jest.fn()
};

describe('Fluxo de chat', () => {
  test('deve processar mensagens do cliente corretamente', async () => {
    console.log('\n=== Testando fluxo de identificação de cliente ===\n');

    // 1. Cliente: "oi"
    console.log('1. Cliente: "oi"');
    await webhook(mockReq('oi'), mockRes);
    let state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.lastQuestion).toBe('askName');
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });

    // 2. Cliente informa nome
    console.log('\n2. Cliente: "João"');
    await webhook(mockReq('João'), mockRes);
    state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.name).toBe('João');
    expect(state.lastQuestion).toBe('askType');
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });

    // 3. Cliente informa tipo
    console.log('\n3. Cliente: "sou lojista"');
    await webhook(mockReq('sou lojista'), mockRes);
    state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.type).toBe('lojista');
    expect(state.lastQuestion).toBe(null);
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  });

  test('deve rejeitar nomes muito curtos', async () => {
    // 1. Cliente: "oi"
    await webhook(mockReq('oi'), mockRes);
    let state = getClientState('85991575525');
    expect(state.lastQuestion).toBe('askName');
    expect(state.name).toBe(null); // Confirma que name é null inicialmente

    // 2. Cliente informa nome curto
    await webhook(mockReq('A'), mockRes);
    state = getClientState('85991575525');
    expect(state.name).toBe(null); // Confirma que name continua null
    expect(state.lastQuestion).toBe('askName');
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  });
});