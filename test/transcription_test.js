// test/transcription_test.js - Teste de transcrição de áudio
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// Inicializando cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// URL do áudio de teste - substitua pela URL real de um áudio recebido
const TEST_AUDIO_URL = "https://f004.backblazeb2.com/file/temp-file-download/instances/3E02D99CD208F05F0BC8FA8592F99CB9/D0F4E9D130C656B7F315FD37FD04CAB1/18kpAmebTfNdnw7z9Bl9jA==.ogg";

// Função de transcrição aprimorada
async function transcribeAudioFromUrl(url) {
  try {
    console.log('🔄 Baixando arquivo de áudio da URL:', url);
    
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      headers: {
        'Accept': '*/*',
        'User-Agent': 'Felipe-Bot/1.0'
      }
    });
    
    const buffer = Buffer.from(response.data);
    
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
    console.log(`📊 Tamanho do arquivo: ${buffer.length} bytes`);
    
    // Verifica se o arquivo tem conteúdo
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new Error('Arquivo de áudio está vazio');
    }
    
    // Lê o arquivo e passa para a API
    console.log('🎙️ Enviando áudio para transcrição via Whisper API...');
    const fileStream = fs.createReadStream(filePath);
    
    // Cria a transcrição
    const result = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'text'
    });
    
    console.log('🧹 Limpando arquivo temporário');
    fs.unlinkSync(filePath);
    
    console.log('✅ Transcrição concluída com sucesso!');
    return result;
  } catch (error) {
    console.error('❌ Erro ao transcrever áudio:', error.message);
    if (error.response) {
      console.error('📄 Detalhes do erro HTTP:', error.response.status, error.response.statusText);
      console.error('📄 Corpo da resposta:', error.response.data);
    } else if (error.request) {
      console.error('📄 Erro na requisição:', error.request);
    }
    throw error;
  }
}

// Teste principal
async function runTest() {
  try {
    console.log('🧪 Iniciando teste de transcrição de áudio...');
    console.log(`🔗 URL do áudio: ${TEST_AUDIO_URL}`);
    
    const transcription = await transcribeAudioFromUrl(TEST_AUDIO_URL);
    console.log('\n📝 Resultado da transcrição:');
    console.log(transcription);
    
  } catch (error) {
    console.error('❌ Teste falhou:', error);
  }
}

// Executa o teste
runTest();
