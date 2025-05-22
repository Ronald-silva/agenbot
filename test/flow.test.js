const webhook = require('../controllers/webhook');
const { getClientState } = require('../utils/state');
const axios = require('axios');

jest.mock('axios');
jest.mock('../services/openai', () => ({
  chat: jest.fn()
}));
const { chat } = require('../services/openai');

describe('Fluxo de chat', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = (message) => ({
      body: {
        type: 'ReceivedCallback',
        chatId: '85991575525@c.us',
        text: { message },
        fromMe: false,
        fromApi: false
      }
    });
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    axios.post.mockResolvedValue({ success: true });
    // Limpa o estado antes de cada teste
    const state = getClientState('85991575525');
    state.lastQuestion = null;
    state.name = null;
    state.type = null;
    state.metadata = {
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      interactions: 0
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('deve processar mensagens do cliente corretamente', async () => {
    console.log('\n=== Testando fluxo de identificação de cliente ===\n');

    // 1. Cliente: "oi"
    console.log('1. Cliente: "oi"');
    chat.mockResolvedValueOnce('Olá! Bem-vindo(a) à Felipe Relógios! 😊 Como posso te ajudar hoje? Posso saber seu nome, por favor?');
    await webhook(mockReq('oi'), mockRes);
    let state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.lastQuestion).toBe('askName');
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });

    // 2. Cliente informa nome
    console.log('\n2. Cliente: "João"');
    chat.mockResolvedValueOnce('Prazer em conhecê-lo(a)! Você está comprando para uso pessoal ou é lojista/revendedor?');
    await webhook(mockReq('João'), mockRes);
    state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.name).toBe('João');
    expect(state.lastQuestion).toBe('askType');
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });

    // 3. Cliente informa tipo
    console.log('\n3. Cliente: "sou lojista"');
    chat.mockResolvedValueOnce('Ótimo! Para lojistas, temos condições especiais: descontos progressivos por quantidade, pedido mínimo de 10 unidades, e parcelamento em até 6x sem juros ou 30/60/90 no boleto. Qual quantidade você tem interesse?');
    await webhook(mockReq('sou lojista'), mockRes);
    state = getClientState('85991575525');
    console.log('Estado:', state);
    expect(state.type).toBe('lojista');
    expect(state.lastQuestion).toBe(null);
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  }, 10000);

  it('deve rejeitar nomes muito curtos', async () => {
    // 1. Cliente: "oi"
    chat.mockResolvedValueOnce('Olá! Bem-vindo(a) à Felipe Relógios! 😊 Como posso te ajudar hoje? Posso saber seu nome, por favor?');
    await webhook(mockReq('oi'), mockRes);
    let state = getClientState('85991575525');
    expect(state.lastQuestion).toBe('askName');
    expect(state.name).toBe(null);

    // 2. Cliente informa nome curto
    chat.mockResolvedValueOnce('Desculpe, o nome parece muito curto. Pode me dizer seu nome completo, por favor?');
    await webhook(mockReq('A'), mockRes);
    state = getClientState('85991575525');
    expect(state.lastQuestion).toBe('askName');
    expect(state.name).toBe(null);
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  }, 10000);
});