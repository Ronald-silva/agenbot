// controllers/webhook.js (RAG + áudio via Whisper e TTS OpenAI)
if (process.env.NODE_ENV !== 'production') require('dotenv').config();

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const OpenAI = require('openai');
const contexts = require('../contexts.json'); // array of {snippet, embedding}
// Importa serviço de síntese de voz (TTS) para respostas em áudio
const { synthesizeSpeech, AVAILABLE_VOICES } = require('../services/tts');

// Vars de ambiente
const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN?.trim();
const OPENAI_KEY     = process.env.OPENAI_API_KEY?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN || !OPENAI_KEY) {
  console.error('❌ Defina ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN e OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// Sem banco: simples função de similaridade
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

// Recupera contexto do JSON em memória
async function retrieveContext(question, topK = 3) {
  // 1) embedding da pergunta
  const embedResp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question
  });
  const qv = embedResp.data[0].embedding;

  // 2) calcula similaridade
  const sims = contexts.map(c => ({ snippet: c.snippet, score: cosine(qv, c.embedding) }));

  // 3) pega os topK
  return sims
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ snippet }) => snippet)
    .join('\n---\n');
}

// Verifica status da instância Z-API
async function checkInstance() {
  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/status`;
  const { data } = await axios.get(url, { headers: { 'Client-Token': CLIENT_TOKEN } });
  console.log('🔍 Z-API status:', data);
  if (!data.connected || !data.smartphoneConnected) {
    throw new Error(`Z-API offline: ${data.error}`);
  }
}

// Transcribe áudio via Whisper
async function transcribeAudioFromUrl(url) {
  try {
    const fs = require('fs');
    const path = require('path');
    const { v4: uuidv4 } = require('uuid');
    
    console.log('🔄 Baixando arquivo de áudio da URL:', url);
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(resp.data);
    
    // Cria um arquivo temporário para o áudio
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Gera um nome único para o arquivo de áudio
    const fileName = `audio_${uuidv4()}.ogg`;
    const filePath = path.join(tempDir, fileName);
    
    console.log(`💾 Salvando áudio em: ${filePath}`);
    fs.writeFileSync(filePath, buffer);
    
    // Lê o arquivo e passa para a API do Whisper
    const fileStream = fs.createReadStream(filePath);
    console.log('🎙️ Enviando áudio para transcrição via Whisper API...');
    
    // Criando objeto File para a API do OpenAI
    const tr = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'text'
    });
    
    console.log('🧹 Limpando arquivo temporário');
    try {
      fs.unlinkSync(filePath); // Remove o arquivo temporário
    } catch (cleanupError) {
      console.warn('⚠️ Não foi possível remover o arquivo temporário:', cleanupError.message);
    }
    
    return tr;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error.message);
    if (error.response) {
      console.error('📄 Detalhes do erro:', error.response.data);
    }
    throw new Error(`Falha na transcrição: ${error.message}`);
  }
}

// Função para extrair URL de áudio do payload, mesmo com JSON malformado
function extractAudioUrl(payload) {
  try {
    // Tenta extrações padrão primeiro
    if (payload.audio?.audioUrl) {
      return payload.audio.audioUrl;
    }
    if (payload.media?.url) {
      return payload.media.url;
    }
    
    // Se falhou, tenta extrair da string usando regex
    const payloadString = JSON.stringify(payload);
    const urlMatch = payloadString.match(/"audioUrl":"([^"]+)"/);
    if (urlMatch && urlMatch[1]) {
      console.log('🔍 URL do áudio extraída por regex:', urlMatch[1]);
      return urlMatch[1];
    }
    
    // Se ainda falhou, não há URL no payload
    throw new Error('URL do áudio não encontrada no payload');
  } catch (error) {
    throw new Error(`Falha ao extrair URL do áudio: ${error.message}`);
  }
}

module.exports = async function webhook(req, res) {  
  try {
    console.log('🔥 Payload recebido:', JSON.stringify(req.body));
    
    // Ignora mensagens enviadas pelo próprio bot ou via API
    if (req.body.type !== 'ReceivedCallback' || req.body.fromApi || req.body.fromMe) {
      return res.sendStatus(200);
    }
    
    // Identifica tipo de mensagem (texto, áudio, etc) - tratando potenciais erros de formato JSON
    // Verifica se existe áudio inspecionando todo o payload como string para capturar formatos malformados
    const payloadString = JSON.stringify(req.body);
    const containsAudio = payloadString.includes('"audio"') || payloadString.includes('"audio";') || req.body.type === 'audio';
    const messageType = containsAudio ? 'áudio' : 'texto';
    console.log(`📥 Tipo de mensagem recebida: ${messageType}`);

    // Extrai telefone
    const rawPhone = req.body.chatId || req.body.phone || '';
    const phone = rawPhone.split('@')[0];
    if (!phone) return res.status(400).json({ error: 'Número não encontrado' });

    await checkInstance();    // Detecta se é mensagem de áudio ou texto
    let message = req.body.text?.message || req.body.body || req.body.message || '';
    
    // Processa áudio - verifica todas as possibilidades de formato
    if (containsAudio) {
      console.log('🎤 Recebida mensagem de voz, transcrevendo...');
      
      try {
        // Tenta extrair a URL do áudio de todas as formas possíveis
        const audioUrl = extractAudioUrl(req.body);
        message = await transcribeAudioFromUrl(audioUrl);
        console.log('🗣 Transcrição completa:', message);
      } catch (audioError) {
        console.error('❌ Erro processando áudio:', audioError.message);
        return res.status(400).json({ error: 'Falha ao processar áudio: ' + audioError.message });
      }
    }
    
    if (!message) return res.status(400).json({ error: 'Mensagem vazia' });

    console.log(`📩 De ${phone}: "${message}"`);

    // Recupera contexto
    const context = await retrieveContext(message);
    console.log('📚 Contexto:', context);

    // Prompt RAG
    const prompt = `Você é o assistente da Felipe Relógios (Beco da Poeira). Seja profissional e direto.

PRODUTOS E DESCRIÇÕES EXATAS:
1. Atlantis Masculino (R$ 80,00) - "Design robusto e elegante com pulseira metálica, mostrador moderno (preto ou prata) e resistência à água de até 50m. Ideal para quem busca estilo e durabilidade com ótimo custo-benefício."
2. G-Shock Digital (R$ 35,90) - "Modelo esportivo com visual moderno e acabamento fosco. Resistente a impactos, com pulseira em silicone e visor digital com funções de hora, data e cronômetro."
3. Atlantis Gold (R$ 50,90) - "Modelo leve e moderno com pulseira de borracha texturizada e caixa dourada. Disponível em mostradores coloridos (preto, azul e vermelho), resistente à água até 50m."
4. Bulgari Cassino (R$ 90,90) - "Inspirado no glamour dos cassinos, esse modelo traz um mostrador temático com visual de roleta e acabamento dourado imponente."
5. Festina Dourado (R$ 80,90) - "Design robusto, mostrador multifuncional e acabamento totalmente dourado. Ideal para quem busca um relógio de alto impacto visual."
6. Festina Gold Blue (R$ 80,00) - "Acabamento dourado premium e mostrador azul profundo. Equipado com cronógrafo funcional e estrutura robusta."
7. Festina Gold White (R$ 80,90) - "Design imponente com pulseira dourada de alta resistência e mostrador branco detalhado que inspira elegância."
8. Bulgari Hélice Azul (R$ 90,90) - "Um espetáculo visual com mostrador azul em formato de hélice, este relógio Bulgari une ousadia e sofisticação. Sua estrutura dourada impõe respeito."
9. Atlantis 2 em 1 (R$ 90,90) - "Combinando mostrador analógico clássico e visor digital funcional. Disponível nas versões branca e dourada, resistente à água (50M)."

REGRAS:
1. Use SEMPRE as descrições EXATAS acima
2. Sem garantia - responda "a loja não oferece garantia"
3. Sem entregas - diga "solicite um Uber/mototáxi para coleta"
4. Endereço: Av. Imperador, 546 Box-1300 F6 - Centro (Beco da Poeira)
5. Horário: Seg-Sex 7h-17h, Sáb 8h-12h

FLUXO DE RESERVA:

1. QUANDO CLIENTE PEDIR INFORMAÇÃO DE PRODUTO:
Olá! 👋 Sobre o [PRODUTO]:

📝 **Características:**
[USAR A DESCRIÇÃO EXATA DO PRODUTO LISTADA ACIMA]

💰 **Valor:** R$ [PREÇO]

💳 **Pagamento:**
- PIX, Cartão, Dinheiro

⏰ **Importante:**
- Pronta retirada
- Reserva: 24h
- Retirada: pessoalmente ou Uber/mototáxi

🕒 **Horário:**
Seg-Sex 7h-17h, Sáb 8h-12h

📍 **Local:**
Av. Imperador, 546 Box-1300 F6 (Beco da Poeira)

Sugestões similares:
[SUGERIR 2 PRODUTOS DA MESMA CATEGORIA, USANDO NOME E PREÇO]

✨ Posso reservar para você?

2. QUANDO CLIENTE RESPONDER "sim" APÓS APRESENTAÇÃO DE PRODUTO:
Ótimo! 🎉 Sua reserva do [NOME EXATO DO PRODUTO] foi confirmada por 24h.

Para finalizar a compra:
- Venha até nossa loja ou
- Envie um Uber/mototáxi para retirada

Precisa de mais alguma informação? Estou à disposição! 😊

MANTENHA O CONTEXTO:
- Use SEMPRE o nome completo e exato dos produtos
- Se o cliente acabou de ver um produto e responde "sim", isso significa que ele quer reservar AQUELE produto
- Não apresente um produto novo quando o cliente confirmar uma reserva
- Não perca o contexto da conversa

---
${context}
---
Cliente: ${message}`;

    // Chama OpenAI
    const chatResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });
    const responseText = chatResp.choices[0].message.content.trim();
    console.log('🤖 Resposta texto:', responseText);
    
    // 1. Envia resposta em formato texto
    const sendTextUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;
    await axios.post(
      sendTextUrl,
      { phone, message: responseText },
      { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
    );
    
    // 2. Gera áudio da resposta (TTS) e envia como mensagem de voz
    try {
      console.log('🎵 Iniciando síntese de áudio para resposta...');
      // Usa voz feminina (NOVA) para o bot e velocidade levemente mais rápida para melhor experiência
      const audioBase64 = await synthesizeSpeech(responseText, AVAILABLE_VOICES.NOVA, { 
        model: 'tts-1', 
        speed: 1.1  // Velocidade um pouco mais rápida para melhor fluidez
      });
      console.log(`🔊 Áudio gerado com sucesso! (${audioBase64.length} bytes em base64)`);
      
      const sendAudioUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-audio`;
      await axios.post(
        sendAudioUrl,
        { phone, base64Audio: audioBase64, fileName: 'resposta.mp3' },
        { headers: { 'Content-Type': 'application/json', 'Client-Token': CLIENT_TOKEN } }
      );
      
      console.log('✅ Enviado com sucesso: texto + mensagem de voz');
      return res.json({ success: true, responseType: 'text+audio' });
    } catch (audioError) {
      console.error('⚠️ Erro ao processar áudio:', audioError.message);
      console.log('⚠️ Continuando apenas com a resposta em texto');
      return res.json({ success: true, responseType: 'text-only' });
    }
  } catch (err) {
    console.error('❌ Erro webhook:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro interno', details: err.response?.data || err.message });
  }
};
