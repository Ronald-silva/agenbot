// test/flow.test.js
process.env.NODE_ENV = 'test';

const redisClient = require('../services/redis');
const { chat } = require('../services/openai');

// Mock do OpenAI
jest.mock('../services/openai', () => ({
  chat: jest.fn().mockResolvedValue('Resposta simulada do OpenAI')
}));

describe('Fluxo de chat', () => {
  let webhook;

  beforeEach(async () => {
    // Reseta os módulos e limpa o Redis antes de cada teste
    jest.resetModules();
    await redisClient.flushAll();
    jest.clearAllMocks();
    webhook = require('../controllers/webhook');
  });

  afterAll(async () => {
    await redisClient.close();
  });

  // Helper para criar requisições de mensagem
  function createRequest(message) {
    return {
      body: {
        type: 'ReceivedCallback',
        text: { message },
        fromMe: false,
        fromApi: false,
        chatId: '85991575525@c.us',
      }
    };
  }

  // Helper para criar resposta mock
  function createResponse() {
    return {
      json: jest.fn((x) => x),
      status: jest.fn().mockReturnThis(),
      sendStatus: jest.fn()
    };
  }

  test('deve validar tamanho mínimo do nome', async () => {
    const res = createResponse();
    
    // Inicia conversa
    let response = await webhook(createRequest('oi'), res);
    expect(response.success).toBe(true);

    // Tenta nome curto
    response = await webhook(createRequest('a'), res);
    expect(response.success).toBe(true);

    // Verifica se ainda está pedindo o nome
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(2);
  });

  test('deve processar fluxo completo corretamente', async () => {
    const res = createResponse();
    
    // Fluxo: oi -> nome -> tipo
    let response = await webhook(createRequest('oi'), res);
    expect(response.success).toBe(true);

    response = await webhook(createRequest('João Silva'), res);
    expect(response.success).toBe(true);

    response = await webhook(createRequest('cliente'), res);
    expect(response.success).toBe(true);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(3);
  });

  test('deve lidar com falhas do Redis', async () => {
    const res = createResponse();

    // Simula falha do Redis
    const originalGet = redisClient.get;
    redisClient.get = jest.fn().mockRejectedValueOnce(new Error('Redis error'));

    const response = await webhook(createRequest('oi'), res);
    
    // Restaura função original
    redisClient.get = originalGet;

    expect(response.success).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});