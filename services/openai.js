// openai.js
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERRO: OPENAI_API_KEY não encontrada no arquivo .env');
  process.exit(1);
}

const CONTEXTS_PATH = path.join(__dirname, 'contexts.json');
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
        {
          model: 'text-embedding-ada-002',
          input: ctx.snippet
        },
        {
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        }
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
    {
      model: 'text-embedding-ada-002',
      input: text
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    }
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
async function getRelevantSnippets(query, topK = 3) {
  await ensureEmbeddings();
  const qEmb = await getEmbedding(query);
  const sims = contexts
    .map(ctx => ({
      snippet: ctx.snippet,
      score: cosineSimilarity(qEmb, ctx.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(x => x.snippet);
  return sims;
}

/**
 * Função principal: recebe a mensagem do usuário, busca contextos
 * relevantes e chama o chat/completions da OpenAI
 */
async function chat(msg) {
  console.log('🔍 Buscando contextos relevantes...');
  const snippets = await getRelevantSnippets(msg);

  const systemPrompt = `
Você é Carla, assistente da Escola Lucê. Utilize estas informações para responder às perguntas:
${snippets.map(s => `- ${s}`).join('\n')}
`.trim();

  console.log('💬 Enviando requisição de chat/completions para a OpenAI...');
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: msg }
      ],
      temperature: 0.5
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return resp.data.choices[0].message.content.trim();
}

module.exports = { chat };
