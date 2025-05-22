const fs = require('fs');
const path = require('path');

const STATES_FILE = path.join(__dirname, '..', 'data', 'states.json');

// Carrega estados do arquivo ou inicializa vazio
let clientStates = {};
if (fs.existsSync(STATES_FILE)) {
  try {
    const data = fs.readFileSync(STATES_FILE, 'utf8');
    clientStates = JSON.parse(data);
  } catch (error) {
    console.error('❌ Erro ao carregar states.json:', error.message);
    clientStates = {};
  }
}

// Função para salvar estados no arquivo
function saveStates() {
  try {
    fs.writeFileSync(STATES_FILE, JSON.stringify(clientStates, null, 2), 'utf8');
    console.log('💾 Estados salvos em states.json');
  } catch (error) {
    console.error('❌ Erro ao salvar states.json:', error.message);
  }
}

// Função para obter o estado de um cliente
function getClientState(phone) {
  if (!clientStates[phone]) {
    clientStates[phone] = {
      lastQuestion: null,
      name: null,
      type: null,
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        interactions: 0
      }
    };
    saveStates();
  }
  return clientStates[phone];
}

// Função para atualizar o estado de um cliente
function setClientState(phone, state) {
  clientStates[phone] = state;
  saveStates();
}

module.exports = {
  getClientState,
  setClientState
};