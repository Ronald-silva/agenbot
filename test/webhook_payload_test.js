// test/webhook_payload_test.js - Teste do webhook com payload malformado
require('dotenv').config();
const webhook = require('../controllers/webhook');

// Simulação de resposta HTTP
const mockRes = {
  status: (code) => ({
    json: (data) => console.log(`[Resposta ${code}]:`, JSON.stringify(data))
  }),
  sendStatus: (code) => console.log(`[Resposta ${code}]`),
  json: (data) => console.log(`[Resposta OK]:`, JSON.stringify(data))
};

// Criamos uma string JSON malformada, depois convertemos de volta para objeto
const malformedPayloadStr = `{
  "isStatusReply": false,
  "chatLid": "216183051673677@lid",
  "connectedPhone": "558591575525",
  "waitingMessage": false,
  "isEdit": false,
  "isGroup": false,
  "isNewsletter": false,
  "instanceId": "3E02D99CD208F05F0BC8FA8592F99CB9",
  "messageId": "D0F4E9D130C656B7F315FD37FD04CAB1",
  "phone": "558591993833",
  "fromMe": false,
  "momment": 1748385499576,
  "status": "RECEIVED",
  "chatName": "Ronald numero:",
  "senderPhoto": null,
  "senderName": "Ronald",
  "photo": "https://pps.whatsapp.net/v/t61.24694-24/429507778_410088288463959_2507105294755072472_n.jpg?ccb=11-4&oh=01_Q5Aa1gGMmrRtz81LYhy5yaH4J6MuW-86gCdLGZSO1g3ayW2ncA&oe=6843359E&_nc_sid=5e03e0&_nc_cat=103",
  "broadcast": false,
  "participantLid": null,
  "forwarded": false,
  "type": "ReceivedCallback",
  "fromApi": false,
  "audio": {
    "ptt": true,
    "seconds": 1,
    "audioUrl": "https://f004.backblazeb2.com/file/temp-file-download/instances/3E02D99CD208F05F0BC8FA8592F99CB9/D0F4E9D130C656B7F315FD37FD04CAB1/18kpAmebTfNdnw7z9Bl9jA==.ogg",
    "mimeType": "audio/ogg; codecs=opus",
    "viewOnce": false
  }
}`;

// Criamos o objeto correto para o teste
const mockReq = {
  body: JSON.parse(malformedPayloadStr)
};

// Teste do webhook
async function runTest() {
  console.log('🧪 Testando webhook com payload malformado...');
  console.log('📝 Payload inclui "audio";: em vez de "audio":', );
  
  try {
    await webhook(mockReq, mockRes);
    console.log('✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executa o teste
runTest();
