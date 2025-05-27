// services/tts.js
// Serviço de Text-to-Speech usando a OpenAI (modelo tts-1)

const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Inicializa cliente OpenAI com sua chave de API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Vozes disponíveis na API TTS da OpenAI
 * @type {Object}
 */
const AVAILABLE_VOICES = {
  NOVA: 'nova',      // Feminina, brasileira, padrão para o bot
  ALLOY: 'alloy',    // Masculina, neutra
  SHIMMER: 'shimmer', // Feminina, positiva
  FABLE: 'fable',    // Masculina, mais jovem
  ECHO: 'echo',      // Masculina, mais profunda
  ONYX: 'onyx'       // Masculina, séria
};

/**
 * Divide texto longo em segmentos menores, baseado em pontuação.
 * Isso ajuda a processar textos muito longos com a API TTS.
 * @private
 * @param {string} text - Texto a ser segmentado
 * @param {number} [maxLength=4000] - Tamanho máximo de cada segmento
 * @returns {string[]} - Array de segmentos de texto
 */
function segmentText(text, maxLength = 4000) {
  if (text.length <= maxLength) return [text];
  
  // Pontuações para dividir o texto
  const segments = [];
  let currentSegment = "";
  
  // Dividir por parágrafos ou frases
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    if ((currentSegment + sentence).length <= maxLength) {
      currentSegment += (currentSegment ? " " : "") + sentence;
    } else {
      if (currentSegment) segments.push(currentSegment);
      currentSegment = sentence;
    }
  }
  
  if (currentSegment) segments.push(currentSegment);
  return segments;
}

/**
 * Sintetiza texto em áudio (formato MP3) e retorna o conteúdo em base64.
 * @param {string} text - O texto que será convertido em voz.
 * @param {string} [voice='nova'] - Opção de voz ('nova', 'alloy', 'shimmer', 'fable', 'echo', 'onyx').
 * @param {object} [options] - Opções adicionais
 * @param {string} [options.model='tts-1'] - Modelo TTS (tts-1 ou tts-1-hd para maior qualidade)
 * @param {number} [options.speed=1.0] - Velocidade de reprodução (0.25 a 4.0)
 * @returns {Promise<string>} - Base64 do arquivo MP3 gerado.
 */
async function synthesizeSpeech(text, voice = AVAILABLE_VOICES.NOVA, options = {}) {
  try {
    const { model = 'tts-1', speed = 1.0 } = options;
    
    // Segmentação de texto longo
    const MAX_TTS_LENGTH = 4000; // Limite seguro para a API
    const segments = segmentText(text, MAX_TTS_LENGTH);
    
    // Log para monitoramento
    console.log(`🔊 Gerando áudio: ${text.slice(0, 50)}... (${voice}, velocidade: ${speed}, segmentos: ${segments.length})`);
    
    // Se temos apenas um segmento, processo normal
    if (segments.length === 1) {
      const mp3Response = await openai.audio.speech.create({
        model,
        voice,
        input: text,
        speed
      });
      
      // Converte ArrayBuffer em Buffer e depois em base64
      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      return buffer.toString('base64');
    } 
    // Se tivermos múltiplos segmentos, processamos apenas o primeiro
    // Uma implementação completa combinaria todos os segmentos
    else {
      console.log(`🔀 Texto dividido em ${segments.length} segmentos para processamento`);
      
      // Processa apenas o primeiro segmento para evitar complicações com concatenação de áudio
      const mp3Response = await openai.audio.speech.create({
        model,
        voice, 
        input: segments[0] + "... [Mensagem resumida para áudio]",
        speed
      });
      
      // Converte ArrayBuffer em Buffer e depois em base64
      const buffer = Buffer.from(await mp3Response.arrayBuffer());
      return buffer.toString('base64');
    }
  } catch (error) {
    console.error('❌ Erro ao sintetizar áudio:', error);
    throw error;
  }
}

/**
 * Sintetiza texto em áudio e salva em um arquivo mp3 (útil para testes)
 * @param {string} text - O texto que será convertido em voz
 * @param {string} outputPath - Caminho de saída do arquivo MP3
 * @param {string} [voice='nova'] - Opção de voz 
 * @param {object} [options] - Opções adicionais
 * @returns {Promise<string>} - Caminho do arquivo salvo
 */
async function synthesizeAndSaveToFile(text, outputPath, voice = AVAILABLE_VOICES.NOVA, options = {}) {
  try {
    const { model = 'tts-1', speed = 1.0 } = options;
    
    const mp3Response = await openai.audio.speech.create({
      model,
      voice,
      input: text,
      speed
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✅ Áudio salvo em: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Erro ao salvar áudio:', error);
    throw error;
  }
}

module.exports = { 
  synthesizeSpeech, 
  synthesizeAndSaveToFile,
  AVAILABLE_VOICES
};
