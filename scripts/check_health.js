// check_health.js - Script para verificar saúde do serviço
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// Configurações
const PORT = process.env.PORT || 8080;
const HEALTH_URL = `http://localhost:${PORT}/health`;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

async function checkServerHealth() {
  try {
    console.log(`🔍 Verificando servidor na porta ${PORT}...`);
    const response = await axios.get(HEALTH_URL, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log('✅ Servidor está respondendo corretamente.');
      return true;
    } else {
      console.error(`❌ Servidor retornou status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Servidor não está respondendo:', error.message);
    return false;
  }
}

async function checkZAPIConnection() {
  try {
    if (!ZAPI_INSTANCE_ID || !ZAPI_INSTANCE_TOKEN || !ZAPI_CLIENT_TOKEN) {
      console.error('❌ Configurações da Z-API incompletas. Verifique as variáveis de ambiente.');
      return false;
    }
    
    console.log('🔍 Verificando conexão com Z-API...');
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_INSTANCE_TOKEN}/status`;
    const { data } = await axios.get(url, { 
      headers: { 'Client-Token': ZAPI_CLIENT_TOKEN },
      timeout: 10000
    });
    
    console.log('📊 Status Z-API:', data);
    
    if (data.connected && data.smartphoneConnected) {
      console.log('✅ Z-API conectada e smartphone pareado.');
      return true;
    } else {
      console.error('❌ Z-API desconectada ou smartphone não pareado.');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao verificar Z-API:', error.message);
    return false;
  }
}

async function main() {
  console.log('🩺 Iniciando verificação de saúde do serviço...');
  
  const serverOk = await checkServerHealth();
  const zapiOk = await checkZAPIConnection();
  
  if (serverOk && zapiOk) {
    console.log('\n🟢 Sistema completamente operacional!\n');
    process.exit(0);
  } else {
    console.log('\n🔴 O sistema apresenta problemas que precisam ser resolvidos.\n');
    process.exit(1);
  }
}

// Executa a verificação
main();
