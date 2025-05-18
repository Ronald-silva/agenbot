// server.js

// Carrega variáveis de ambiente só em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const webhook = require('./controllers/webhook');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check para produção
app.get('/health', (_, res) => res.sendStatus(200));

// Webhook de mensagens
app.post('/webhook', webhook);

// Porta dinâmica fornecida pelo host (Railway, Heroku, etc.)
const port = process.env.PORT;
if (!port) {
  console.error('❌ Environment variable PORT is not defined.');
  process.exit(1);
}
const host = '0.0.0.0';

app.listen(port, host, () => {
  console.log(`✅ Servidor rodando em http://${host}:${port}`);
});

// Desligamento gracioso
process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, realizando desligamento gracioso...');
  process.exit(0);
});
