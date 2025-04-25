if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const path = require('path');
const webhook = require('./controllers/webhook');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/webhook', webhook);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// **ÚNICA** chamada a listen:
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Servidor rodando em http://${HOST}:${PORT}`);
});

// (Opcional) Tratamento de erro no listen:
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso. Finalize o outro processo ou mude a porta.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, realizando desligamento gracioso...');
  // Código de limpeza aqui
  process.exit(0);
});
