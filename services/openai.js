// openai.js
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4-turbo-preview';
const MAX_RETRIES = 3;

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não definida no .env');
    process.exit(1);
}

const SUPPORTED_MODELS = ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'];
if (!SUPPORTED_MODELS.includes(OPENAI_MODEL)) {
    console.error('❌ Modelo OpenAI inválido:', OPENAI_MODEL);
    console.error('Use um destes:', SUPPORTED_MODELS.join(', '));
    process.exit(1);
}

console.log('✅ Usando modelo OpenAI:', OPENAI_MODEL);

// Função principal de chat
async function chat(message, phone, retries = MAX_RETRIES) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um assistente virtual especializado em atendimento ao cliente para uma loja de relógios. Seja cordial e profissional.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('❌ Erro na chamada OpenAI:', error.message);
        
        if (retries > 0) {
            console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return chat(message, phone, retries - 1);
        }
        
        throw new Error('Falha ao gerar resposta após várias tentativas');
    }
}

module.exports = { chat };
