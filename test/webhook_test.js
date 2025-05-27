// test/webhook_test.js - Script para simular requisições para o webhook
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const webhook = require('../controllers/webhook');

console.log('🧪 Simulando requisições para o webhook...');

// Objeto de resposta simulado
const mockResponse = {
  status: (code) => ({
    json: (data) => console.log(`[Resposta ${code}]:`, data)
  }),
  sendStatus: (code) => console.log(`[Resposta ${code}]`),
  json: (data) => console.log('[Resposta 200]:', data)
};

// Simulação 1: Mensagem de texto simples
async function testTextMessage() {
  console.log('\n📱 Simulando mensagem de texto do cliente');
  
  const mockTextRequest = {
    body: {
      type: 'ReceivedCallback',
      chatId: '5585988776655@c.us',
      phone: '5585988776655@c.us',
      message: 'Olá, gostaria de informações sobre o relógio Atlantis',
      fromMe: false,
      fromApi: false
    }
  };
  
  try {
    await webhook(mockTextRequest, mockResponse);
    console.log('✅ Teste de mensagem de texto concluído');
  } catch (error) {
    console.error('❌ Erro ao testar mensagem de texto:', error);
  }
}

// Simulação 2: Mensagem de áudio (se possível)
// Esta função apenas simula o formato de uma mensagem de áudio
async function testAudioMessage() {
  console.log('\n🎤 Simulando mensagem de áudio do cliente');
  
  // Na realidade, a URL seria de um áudio real
  const mockAudioUrl = 'https://exemplo.com/audio.mp3'; 
  
  const mockAudioRequest = {
    body: {
      type: 'audio',
      chatId: '5585988776655@c.us',
      phone: '5585988776655@c.us',
      media: {
        url: mockAudioUrl
      },
      fromMe: false,
      fromApi: false
    }
  };
  
  console.log('⚠️ Este teste exige um arquivo de áudio real para transcrição');
  console.log('🔍 Em ambiente real, a transcrição seria processada pelo serviço Whisper');
}

// Simulação 3: Resposta de confirmação para um produto
async function testConfirmationMessage() {
  console.log('\n✅ Simulando confirmação de reserva');
  
  const mockConfirmRequest = {
    body: {
      type: 'ReceivedCallback',
      chatId: '5585988776655@c.us',
      phone: '5585988776655@c.us',
      message: 'Sim, quero reservar',
      fromMe: false,
      fromApi: false
    }
  };
  
  try {
    await webhook(mockConfirmRequest, mockResponse);
    console.log('✅ Teste de confirmação concluído');
  } catch (error) {
    console.error('❌ Erro ao testar confirmação:', error);
  }
}

// Executar os testes
async function runTests() {
  try {
    await testTextMessage();
    console.log('\n⏳ Aguardando 5 segundos antes do próximo teste...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await testConfirmationMessage();
    
    // testAudioMessage() - comentado pois requer um áudio real
    
    console.log('\n🏁 Testes concluídos!');
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  }
}

// Inicia os testes
runTests();
