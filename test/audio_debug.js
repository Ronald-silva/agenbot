// audio_debug.js - Script para debug do serviço de áudio
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { synthesizeSpeech, AVAILABLE_VOICES } = require('../services/tts');

// Configurações
const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID?.trim();
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN?.trim();
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN?.trim();

if (!INSTANCE_ID || !INSTANCE_TOKEN || !CLIENT_TOKEN) {
  console.error('❌ Variáveis de ambiente Z-API não definidas');
  process.exit(1);
}

// Texto para teste de síntese
const testText = "Teste de áudio do bot Felipe Relógios. Esta mensagem é gerada pelo serviço TTS para diagnóstico.";
// Número para teste (você pode substituir pelo seu número para receber o teste)
const testPhone = "5585988776655"; // ⚠️ Substitua pelo seu número no formato 5585988776655

async function runAudioTest() {
  try {
    console.log('🧪 Iniciando teste de áudio...');
    
    // Passo 1: Gerar áudio base64
    console.log('🔊 Gerando áudio TTS...');
    let audioBase64;
    try {
      audioBase64 = await synthesizeSpeech(testText, AVAILABLE_VOICES.NOVA, {
        model: 'tts-1',
        speed: 1.0
      });
      console.log(`✅ Áudio gerado: ${audioBase64.length} bytes em base64`);
      
      // Salvar para debugging
      const buffer = Buffer.from(audioBase64, 'base64');
      fs.writeFileSync(path.join(__dirname, 'debug_audio.mp3'), buffer);
      console.log('💾 Áudio salvo em test/debug_audio.mp3');
    } catch (ttsError) {
      console.error('❌ Erro ao gerar áudio:', ttsError.message);
      return;
    }
      // Passo 2: Testar envio para Z-API
    console.log('📤 Enviando áudio para Z-API...');
    // Tentando com o endpoint correto (pode ter sido atualizado)
    const sendAudioUrl = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-audio`;
    
    try {      const response = await axios.post(
        sendAudioUrl,
        { 
          phone: testPhone, 
          base64Audio: audioBase64,
          fileName: 'teste_audio.mp3'
        },
        { 
          headers: { 
            'Content-Type': 'application/json', 
            'Client-Token': CLIENT_TOKEN 
          } 
        }
      );
      
      console.log('✅ Resposta Z-API:', response.data);
      console.log('🎉 Teste completo! Verifique seu WhatsApp para ver se o áudio chegou.');
    } catch (zapiError) {
      console.error('❌ Erro ao enviar para Z-API:', zapiError.message);
      if (zapiError.response) {
        console.error('📝 Detalhes:', zapiError.response.data);
      }
    }
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executa teste
runAudioTest();
