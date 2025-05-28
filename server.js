// server.js

// Carrega variáveis de ambiente só em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

// Inicialização de diretórios e estruturas necessárias
console.log('🔧 Inicializando estruturas para o bot Felipe Relógios...');
require('./scripts/init');

const express = require('express');
const path = require('path');
// Webhook com suporte a mensagens de texto e voz
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

// Porta definida explicitamente como 8080 para o projeto Felipe Relógios
// Se estivermos em produção, use a porta do ambiente; caso contrário, use 8080
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : 8080;
console.log(`🔌 Iniciando servidor na porta: ${port}`);
// Porta verificada para evitar erros
if (!port) {
  console.error('❌ Porta não definida!');
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
