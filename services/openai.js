// openai.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const OPENAI_MODEL = 'gpt-4-turbo-preview'; // Modelo mais recente e rápido

if (!OPENAI_API_KEY) {
  console.error('❌ ERRO: OPENAI_API_KEY não encontrada no arquivo .env');
  process.exit(1);
}

// Valida se o modelo é suportado
const SUPPORTED_MODELS = ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'];
if (!SUPPORTED_MODELS.includes(OPENAI_MODEL)) {
  console.error('❌ ERRO: Modelo OpenAI inválido. Use um destes:', SUPPORTED_MODELS.join(', '));
  process.exit(1);
}

console.log('✅ Usando modelo OpenAI:', OPENAI_MODEL);

const CONTEXTS_PATH = path.join(__dirname, '..', 'contexts.json');
let contexts = JSON.parse(fs.readFileSync(CONTEXTS_PATH, 'utf-8'));

/**
 * Gera embeddings para cada snippet que ainda não tiver vetor e
 * atualiza o contexts.json para as próximas vezes.
 */
async function ensureEmbeddings() {
  let updated = false;
  for (const ctx of contexts) {
    if (!Array.isArray(ctx.embedding) || ctx.embedding.length === 0) {
      const resp = await axios.post(
        'https://api.openai.com/v1/embeddings',
        { model: 'text-embedding-ada-002', input: ctx.snippet },
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
      );
      ctx.embedding = resp.data.data[0].embedding;
      updated = true;
    }
  }
  if (updated) {
    fs.writeFileSync(CONTEXTS_PATH, JSON.stringify(contexts, null, 2));
  }
}

/**
 * Retorna o embedding de um texto qualquer
 */
async function getEmbedding(text) {
  const resp = await axios.post(
    'https://api.openai.com/v1/embeddings',
    { model: 'text-embedding-ada-002', input: text },
    { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
  );
  return resp.data.data[0].embedding;
}

/**
 * Cosine similarity entre dois vetores
 */
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/**
 * Retorna os topK snippets mais relevantes para a query
 */
async function getRelevantSnippets(query, topK = 5) {
  await ensureEmbeddings();
  const qEmb = await getEmbedding(query);
  
  // Expande a query com sinônimos e termos relacionados
  const expandedQueries = [
    query,
    query.toLowerCase(),
    query.replace(/relógio/g, 'watch'),
    query.replace(/comprar/g, 'adquirir')
  ];
  
  // Busca snippets para cada variação da query
  const allResults = await Promise.all(
    expandedQueries.map(async q => {
      const qEmb = await getEmbedding(q);
      return contexts
        .map(ctx => ({ 
          snippet: ctx.snippet, 
          score: cosineSimilarity(qEmb, ctx.embedding)
        }));
    })
  );
  
  // Combina e remove duplicatas
  const mergedResults = allResults
    .flat()
    .reduce((acc, curr) => {
      const existing = acc.find(x => x.snippet === curr.snippet);
      if (!existing) {
        acc.push(curr);
      } else if (curr.score > existing.score) {
        existing.score = curr.score;
      }
      return acc;
    }, []);
  
  // Filtra apenas resultados com boa relevância
  return mergedResults
    .filter(x => x.score > 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.snippet);
}

// Sistema de memória de contexto
const conversationMemory = new Map();

function updateMemory(chatId, message, response) {
  if (!conversationMemory.has(chatId)) {
    conversationMemory.set(chatId, []);
  }
  
  const memory = conversationMemory.get(chatId);
  memory.push({ role: 'user', content: message });
  memory.push({ role: 'assistant', content: response });
  
  // Mantém apenas as últimas 10 mensagens para não sobrecarregar
  if (memory.length > 10) {
    memory.splice(0, 2);
  }
}

function getMemoryContext(chatId) {
  return conversationMemory.get(chatId) || [];
}

/**
 * Função principal: recebe a mensagem do usuário, busca contextos
 * relevantes e chama o chat/completions da OpenAI
 */
async function chat(msg, chatId) {
  console.log('🔍 Buscando contextos relevantes...');
  const snippets = await getRelevantSnippets(msg);
  
  // Recupera o histórico da conversa
  const conversationHistory = getMemoryContext(chatId);
  const systemPrompt = [
    'Você é o FelipeBot, um consultor especializado em relógios de luxo com anos de experiência no mercado.',
    'Características do seu comportamento:',
    '- Demonstre profundo conhecimento técnico sobre relógios',
    '- Seja empático e personalizado nas respostas',
    '- Faça perguntas relevantes para entender melhor a necessidade do cliente',
    '- Ofereça sugestões personalizadas baseadas no perfil e preferências',
    '- Explique termos técnicos de forma simples e acessível',
    '- Destaque benefícios e diferenciais dos produtos',
    '- Mantenha um tom profissional mas amigável',
    'Use estas informações como base para responder:',
    ...snippets.map(s => `- ${s}`)
  ].join('\n');

  console.log('💬 Enviando requisição de chat/completions (GPT-4) para a OpenAI...');
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: msg }
      ],
      temperature: 0.7 // Um pouco mais criativo nas respostas
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const responseMessage = resp.data.choices[0].message.content.trim();

  // Atualiza a memória da conversa
  updateMemory('default', msg, responseMessage);

  return responseMessage;
}

module.exports = { chat };
