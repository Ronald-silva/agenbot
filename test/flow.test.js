const { getClientState, setClientState, clearClientState } = require('../utils/state');
const webhook = require('../controllers/webhook');

// Mock para req e res
const mockReq = (message) => ({
    body: {
        type: 'ReceivedCallback',
        chatId: '85991575525@c.us',
        message,
        fromMe: false,
        fromApi: false
    }
});

const mockRes = {
    json: (data) => console.log('Response:', data),
    sendStatus: (status) => console.log('Status:', status)
};

// Limpa estado anterior
clearClientState('85991575525');

// Testa o fluxo completo
async function testFlow() {
    console.log('\n=== Testando fluxo de identificação de cliente ===\n');

    // 1. Cliente diz "oi"
    console.log('1. Cliente: "oi"');
    await webhook(mockReq('oi'), mockRes);
    console.log('Estado:', getClientState('85991575525'));

    // 2. Cliente informa nome
    console.log('\n2. Cliente: "Me chamo João"');
    await webhook(mockReq('Me chamo João'), mockRes);
    console.log('Estado:', getClientState('85991575525'));

    // 3. Cliente confirma que é cliente final
    console.log('\n3. Cliente: "sim"');
    await webhook(mockReq('sim'), mockRes);
    console.log('Estado:', getClientState('85991575525'));
}

// Executa o teste
testFlow().catch(console.error);
