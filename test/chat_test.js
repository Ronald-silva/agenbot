// test/chat_test.js
require('dotenv').config();
const { chat } = require('../services/openai');

async function testChat() {
    const questions = [
        "Qual o horário de funcionamento da loja?",
        "Vocês fazem entrega?",
        "Como posso pagar minha compra?",
        "Onde fica a loja?",
        "Sou lojista, quais as condições especiais?"
    ];

    console.log('🤖 Testando o chatbot...\n');

    for (const question of questions) {
        console.log('👤 Pergunta:', question);
        const response = await chat(question, question.includes('lojista') ? 'lojista' : 'cliente');
        console.log('🤖 Resposta:', response);
        console.log('-------------------\n');
    }
}

testChat().catch(console.error);
