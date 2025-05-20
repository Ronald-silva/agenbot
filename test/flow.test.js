const { getClientState, setClientState, clearClientState } = require('../utils/state');
const webhook = require('../controllers/webhook');

// Mock do checkInstance
jest.mock('../controllers/webhook', () => {
    const originalModule = jest.requireActual('../controllers/webhook');
    return jest.fn(async (req, res) => {
        // Substituir checkInstance por uma função vazia
        const oldCheckInstance = originalModule.checkInstance;
        originalModule.checkInstance = async () => {};

        try {
            await originalModule(req, res);
        } finally {
            originalModule.checkInstance = oldCheckInstance;
        }
    });
});

// Mock do openai
jest.mock('../services/openai', () => ({
    chat: jest.fn(async (message) => 'Resposta mockada do GPT')
}));

// Mock para req e res
const mockReq = (message) => ({
    body: {
        type: 'ReceivedCallback',
        chatId: '85991575525@c.us',
        text: {
            message
        },
        fromMe: false,
        fromApi: false
    }
});

const mockRes = {
    json: (data) => console.log('Response:', data),
    sendStatus: (status) => console.log('Status:', status),
    status: (code) => ({
        json: (data) => console.log('Status:', code, 'Response:', data)
    })
};

describe('Fluxo de chat', () => {
    beforeEach(() => {
        // Limpa estado anterior
        clearClientState('85991575525');
    });    test('deve processar mensagens do cliente corretamente', async () => {
        console.log('\n=== Testando fluxo de identificação de cliente ===\n');

        // 1. Cliente diz "oi"
        console.log('1. Cliente: "oi"');
        await webhook(mockReq('oi'), mockRes);
        let state = getClientState('85991575525');
        console.log('Estado:', state);
        expect(state.lastQuestion).toBe('askName');

        // 2. Cliente informa nome
        console.log('\n2. Cliente: "Me chamo João"');
        await webhook(mockReq('Me chamo João'), mockRes);
        state = getClientState('85991575525');
        console.log('Estado:', state);
        expect(state.name).toBe('Me chamo João');
        expect(state.lastQuestion).toBe('askType');

        // 3. Cliente confirma que é cliente final
        console.log('\n3. Cliente: "Uso pessoal"');
        await webhook(mockReq('Uso pessoal'), mockRes);
        state = getClientState('85991575525');
        console.log('Estado:', state);
        expect(state.type).toBe('cliente');

        // 2. Cliente informa nome
        console.log('\n2. Cliente: "Me chamo João"');
        await webhook(mockReq('Me chamo João'), mockRes);
        console.log('Estado:', getClientState('85991575525'));

        // 3. Cliente confirma que é cliente final
        console.log('\n3. Cliente: "sim"');
        await webhook(mockReq('sim'), mockRes);
        console.log('Estado:', getClientState('85991575525'));
    });
});
