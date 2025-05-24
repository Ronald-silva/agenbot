// generate_embeddings.js
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const contextsPath = path.join(__dirname, 'contexts.json');
let contexts       = JSON.parse(fs.readFileSync(contextsPath, 'utf-8'));

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
