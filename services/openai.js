if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Verifica se a chave está presente
if (!process.env.OPENAI_API_KEY) {
  console.error('ERRO: OPENAI_API_KEY não encontrada no arquivo .env');
  process.exit(1);
}

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'OK' : 'NÃO ENCONTRADA');
console.log('Comprimento da chave:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);

const axios = require('axios');

module.exports = async (msg) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Chave da API da OpenAI não encontrada');
  }

  console.log('Enviando requisição para OpenAI...');
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Você é Carla, assistente da escola Luce.' },
        { role: 'user', content: msg }
      ],
      temperature: 0.5
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.choices[0].message.content;
};
