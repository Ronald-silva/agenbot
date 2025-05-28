// scripts/init.js - Inicializa estruturas necessárias para o bot
const fs = require('fs');
const path = require('path');

console.log('🔧 Inicializando estruturas para o Felipe Bot...');

// Cria diretório temp para arquivos temporários
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  console.log('📁 Criando diretório temp...');
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('✅ Diretório temp criado com sucesso!');
} else {
  console.log('✅ Diretório temp já existe.');
}

// Limpa arquivos temporários antigos
const files = fs.readdirSync(tempDir);
if (files.length > 0) {
  console.log(`🧹 Limpando ${files.length} arquivo(s) temporário(s) antigo(s)...`);
  files.forEach(file => {
    try {
      fs.unlinkSync(path.join(tempDir, file));
    } catch (error) {
      console.error(`❌ Erro ao remover arquivo ${file}:`, error.message);
    }
  });
  console.log('✅ Diretório temp limpo com sucesso!');
}

console.log('✅ Inicialização concluída!');
