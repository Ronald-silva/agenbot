// test/tts_test.js - Script para testar o serviço TTS
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { synthesizeSpeech, synthesizeAndSaveToFile, AVAILABLE_VOICES } = require('../services/tts');

// Cria pasta para testes de áudio se não existir
const testOutputDir = path.join(__dirname, 'audio_output');
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

/**
 * Função de teste para síntese de voz
 */
async function runTTSTests() {
  try {
    console.log('🧪 Iniciando testes do serviço TTS...');

    // Teste 1: Mensagem curta
    const shortMessage = "Olá, sou o assistente do Felipe Relógios! Como posso ajudar?";
    console.log('\n📝 Teste 1: Mensagem curta');
    const shortAudioPath = path.join(testOutputDir, 'teste_curto.mp3');
    await synthesizeAndSaveToFile(shortMessage, shortAudioPath);
    
    // Teste 2: Mensagem média com produto
    const mediumMessage = `
    Olá! 👋 Sobre o Relógio Atlantis Masculino:

    📝 **Características:**
    Design robusto e elegante com pulseira metálica, mostrador moderno (preto ou prata) e resistência à água de até 50m. Ideal para quem busca estilo e durabilidade com ótimo custo-benefício.

    💰 **Valor:** R$ 80,00

    💳 **Pagamento:**
    - PIX, Cartão, Dinheiro

    ⏰ **Importante:**
    - Pronta retirada
    - Reserva: 24h
    - Retirada: pessoalmente ou Uber/mototáxi`;
    
    console.log('\n📝 Teste 2: Descrição de produto');
    const mediumAudioPath = path.join(testOutputDir, 'teste_medio.mp3');
    await synthesizeAndSaveToFile(mediumMessage, mediumAudioPath);    
    // Teste 3: Mensagem longa (deve acionar a segmentação)    
    const longMessage = `
    Bem-vindo ao Felipe Relógios! Somos uma loja especializada em relógios de alta qualidade, localizada no Beco da Poeira em Fortaleza.

    Nosso catálogo completo inclui:

    1. Atlantis Masculino (R$ 80,00) - Design robusto e elegante com pulseira metálica, mostrador moderno (preto ou prata) e resistência à água de até 50m. Ideal para quem busca estilo e durabilidade com ótimo custo-benefício.
    
    2. G-Shock Digital (R$ 35,90) - Modelo esportivo com visual moderno e acabamento fosco. Resistente a impactos, com pulseira em silicone e visor digital com funções de hora, data e cronômetro.
    
    3. Atlantis Gold (R$ 50,90) - Modelo leve e moderno com pulseira de borracha texturizada e caixa dourada. Disponível em mostradores coloridos (preto, azul e vermelho), resistente à água até 50m.
    
    4. Bulgari Cassino (R$ 90,90) - Inspirado no glamour dos cassinos, esse modelo traz um mostrador temático com visual de roleta e acabamento dourado imponente.
    
    5. Festina Dourado (R$ 80,90) - Design robusto, mostrador multifuncional e acabamento totalmente dourado. Ideal para quem busca um relógio de alto impacto visual.
    
    6. Festina Gold Blue (R$ 80,00) - Acabamento dourado premium e mostrador azul profundo. Equipado com cronógrafo funcional e estrutura robusta.
    
    7. Festina Gold White (R$ 80,90) - Design imponente com pulseira dourada de alta resistência e mostrador branco detalhado que inspira elegância.
    
    8. Bulgari Hélice Azul (R$ 90,90) - Um espetáculo visual com mostrador azul em formato de hélice, este relógio Bulgari une ousadia e sofisticação. Sua estrutura dourada impõe respeito.
    
    9. Atlantis 2 em 1 (R$ 90,90) - Combinando mostrador analógico clássico e visor digital funcional. Disponível nas versões branca e dourada, resistente à água (50M).

    Nossa loja fica localizada na Avenida Imperador, 546 Box-1300 F6 - Centro (conhecido como beco da poeira). Funcionamos de Segunda a Sexta das 7h às 17h e aos Sábados das 8h às 12h.

    Aceitamos pagamentos em PIX, cartão de crédito/débito e dinheiro. Não realizamos entregas, mas o cliente pode solicitar um Uber ou mototáxi para retirada.`;
    
    console.log('\n📝 Teste 3: Mensagem longa (com segmentação)');
    const longAudioPath = path.join(testOutputDir, 'teste_longo.mp3');
    await synthesizeAndSaveToFile(longMessage, longAudioPath);
    
    // Teste 4: Vozes diferentes
    const testVoices = ['nova', 'alloy', 'shimmer', 'fable'];
    const sampleText = "Olá, bem-vindo(a) ao Felipe Relógios. Como posso ajudar?";
    
    console.log('\n📝 Teste 4: Testando diferentes vozes');
    for (const voice of testVoices) {
      const voiceAudioPath = path.join(testOutputDir, `voz_${voice}.mp3`);
      console.log(`- Testando voz: ${voice}`);
      await synthesizeAndSaveToFile(sampleText, voiceAudioPath, voice);
    }
    
    console.log('\n✅ Todos os testes concluídos com sucesso!');
    console.log(`📂 Os arquivos de áudio foram salvos em: ${testOutputDir}`);
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error);
  }
}

// Executa os testes
runTTSTests();
