// test/webhook_audio_test.js - Teste específico para processamento de mensagens de áudio
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const { OpenAI } = require('openai');

// Inicializa cliente OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log('🧪 Iniciando teste detalhado de processamento de áudio...');

// URL de exemplo para teste (URL de áudio de um arquivo OGG no backblaze)
const AUDIO_TEST_URL = 'https://f004.backblazeb2.com/file/temp-file-download/instances/3E02D99CD208F05F0BC8FA8592F99CB9/D0F4E9D130C656B7F315FD37FD04CAB1/18kpAmebTfNdnw7z9Bl9jA==.ogg';

/**
 * Método antigo (com problema)
 */
async function transcribeAudioFromUrlOld(url) {
  try {
    console.log(`🔄 [Método antigo] Baixando áudio de: ${url}`);
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(resp.data);
    
    console.log(`📊 [Método antigo] Buffer obtido: ${buffer.length} bytes`);
    console.log('🔄 [Método antigo] Enviando para transcrição...');
    
    const tr = await openai.audio.transcriptions.create({ 
      file: buffer, 
      model: 'whisper-1', 
      response_format: 'text' 
    });
    
    console.log(`✅ [Método antigo] Transcrição concluída: "${tr}"`);
    return tr;
  } catch (error) {
    console.error('❌ [Método antigo] Erro:', error.message);
    if (error.response) {
      console.error('📝 Detalhes:', error.response.data);
      console.error('📊 Status:', error.response.status);
    }
    throw error;
  }
}

/**
 * Método novo (corrigido) - salva o arquivo temporariamente
 */
async function transcribeAudioFromUrlNew(url) {
  let tempFilePath = null;
  
  try {
    console.log(`🔄 [Método novo] Baixando áudio de: ${url}`);
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(resp.data);
    
    console.log(`📊 [Método novo] Buffer obtido: ${buffer.length} bytes`);
    
    // Determina a extensão do arquivo baseado na URL ou use .ogg como padrão
    let fileExt = '.ogg';
    if (url.includes('.mp3')) fileExt = '.mp3';
    if (url.includes('.wav')) fileExt = '.wav';
    if (url.includes('.m4a')) fileExt = '.m4a';
    
    // Cria um arquivo temporário
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `audio_${uuidv4()}${fileExt}`);
    fs.writeFileSync(tempFilePath, buffer);
    
    console.log(`💾 [Método novo] Áudio salvo temporariamente em: ${tempFilePath}`);
    console.log('🔄 [Método novo] Enviando para transcrição...');
    
    // Abre o arquivo para passar para a API
    const file = fs.createReadStream(tempFilePath);
    
    const tr = await openai.audio.transcriptions.create({ 
      file: file, 
      model: 'whisper-1', 
      response_format: 'text' 
    });
    
    console.log(`✅ [Método novo] Transcrição concluída: "${tr}"`);
    return tr;
  } catch (error) {
    console.error('❌ [Método novo] Erro:', error.message);
    if (error.response) {
      console.error('📝 Detalhes:', error.response.data);
      console.error('📊 Status:', error.response.status);
    }
    throw error;
  } finally {
    // Limpa o arquivo temporário se ele existir
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('🧹 [Método novo] Arquivo temporário removido');
    }
  }
}

/**
 * Executa os testes
 */
async function runTest() {
  console.log('\n🔬 Iniciando testes de transcrição de áudio...\n');
  
  // Tenta o método antigo (provavelmente vai falhar)
  try {
    console.log('🧪 TESTE 1: Método antigo');
    await transcribeAudioFromUrlOld(AUDIO_TEST_URL);
  } catch (error) {
    console.log('❌ Teste do método antigo falhou conforme esperado\n');
  }
  
  // Tenta o método novo
  try {
    console.log('\n🧪 TESTE 2: Método novo');
    const transcription = await transcribeAudioFromUrlNew(AUDIO_TEST_URL);
    console.log(`🎯 Transcrição final: "${transcription}"`);
  } catch (error) {
    console.log('❌ Teste do método novo falhou\n');
  }
  
  console.log('\n🏁 Testes concluídos!');
}

// Executa os testes
runTest();
