// generate_embeddings.js
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const contextsPath = path.join(__dirname, 'contexts.json');

let contexts;
try {
  const fileContent = fs.readFileSync(contextsPath, 'utf-8');
  contexts = JSON.parse(fileContent);
  
  if (!Array.isArray(contexts)) {
    throw new Error('O arquivo contexts.json deve conter um array');
  }
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('❌ Arquivo contexts.json não encontrado');
  } else {
    console.error('❌ Erro ao ler contexts.json:', error.message);
  }
  process.exit(1);
}

(async () => {
  for (const c of contexts) {
    if (!Array.isArray(c.embedding) || c.embedding.length === 0) {
      const resp = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: c.snippet
      });
      c.embedding = resp.data[0].embedding;
      console.log(`→ Embedding gerado para snippet: "${c.snippet.slice(0,30)}…"`);
    }
  }
  fs.writeFileSync(contextsPath, JSON.stringify(contexts, null, 2));
  console.log('✅ contexts.json atualizado com todos os embeddings.');
})();
