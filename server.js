const express = require('express');
const dotenv  = require('dotenv');
const path    = require('path');
const webhook = require('./controllers/webhook');

// Verifica se o arquivo .env existe
const envPath = path.join(__dirname, '.env');
console.log('Caminho do .env:', envPath);
console.log('Arquivo .env existe?', require('fs').existsSync(envPath));

// Carrega as variáveis de ambiente
dotenv.config();

// Log das variáveis de ambiente após o carregamento
console.log('Variáveis de ambiente carregadas:', {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Presente' : 'Ausente',
  PORT: process.env.PORT || '3000 (padrão)'
});

const app = express();
app.use(express.json());

// Serve arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota de status
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Webhook da Z-API
app.post('/webhook', webhook);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor rodando em http://${HOST}:${PORT}`);
});
