// server.js

// Carrega variáveis de ambiente
require('dotenv').config();

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

// Health check Redis
const redis = require('./services/redis');
app.get('/health/redis', async (req, res) => {
  try {
    const isHealthy = await redis.healthCheck();
    if (isHealthy) {
      res.json({ status: 'ok', message: 'Redis conectado' });
    } else {
      res.status(500).json({ status: 'error', message: 'Redis não está respondendo' });
    }
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Webhook de mensagens
app.post('/webhook', webhook);

// Importa funções de estado
const { getClientState, setClientState } = require('./utils/state');

// Rota de teste para simular uma conversa
app.get('/test/chat', async (req, res) => {
  try {
    const phone = req.query.phone || '85991575525';
    const shouldClear = req.query.clear === 'true';
    
    if (shouldClear) {
      // Limpa o estado se clear=true
      await setClientState(phone, null);
    }
    
    // Obtém estado existente ou cria um novo
    let state = await getClientState(phone);
    const existingCreatedAt = state?.metadata?.createdAt;
    console.log('Estado atual:', state);
    
    // Se não tiver nome, simula primeira interação
    if (!state.name) {
      state = await setClientState(phone, {
        ...state,
        name: 'João',
        lastQuestion: 'askType',
        messages: [
          { role: 'user', content: 'Olá' },
          { role: 'assistant', content: 'Qual é seu nome?' },
          { role: 'user', content: 'João' },
          { role: 'assistant', content: 'Olá João! Você é cliente final ou lojista?' }
        ],
        metadata: {
          ...state.metadata,
          createdAt: existingCreatedAt || Date.now()
        }
      });
    }
    
    // Se tiver nome mas não tiver tipo, simula segunda interação
    if (state.name && !state.type) {
      state = await setClientState(phone, {
        ...state,
        type: 'cliente',
        lastQuestion: 'chat',
        metadata: {
          ...state.metadata,
          createdAt: existingCreatedAt || state.metadata.createdAt
        }
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Teste de conversa simulado com sucesso',
      finalState: state 
    });
  } catch (err) {
    console.error('❌ Erro no teste:', err);
    res.status(500).json({ error: err.message });
  }
});

// Porta dinâmica fornecida pelo host (Railway, Heroku, etc.)
const port = process.env.PORT || 3001;
const host = 'localhost';

app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://${host}:${port}`);
});

// Desligamento gracioso
process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, realizando desligamento gracioso...');
  process.exit(0);
});
