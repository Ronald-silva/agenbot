// Gerencia o estado do chat por número de telefone
const fs = require('fs');
const path = require('path');

const STATES_FILE = path.join(__dirname, '..', 'data', 'states.json');

// Cria o diretório data se não existir
if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'data'));
}

// Carrega estados do arquivo ou inicia um novo Map
let clientStates;
try {
    const data = fs.readFileSync(STATES_FILE, 'utf8');
    const parsed = JSON.parse(data);
    clientStates = new Map(Object.entries(parsed));
} catch (err) {
    console.log('📝 Iniciando novo arquivo de estados');
    clientStates = new Map();
}

// Salva estados no arquivo
function saveStates() {
    try {
        const obj = {};
        for (let [key, value] of clientStates.entries()) {
            obj[key] = value;
        }
        fs.writeFileSync(STATES_FILE, JSON.stringify(obj, null, 2), 'utf8');
        console.log('💾 Estados salvos:', obj);
    } catch (err) {
        console.error('❌ Erro ao salvar estados:', err);
    }
}

function getClientState(phone) {
    const state = clientStates.get(phone);
    console.log('🔍 Recuperando estado para', phone, ':', state);
    return state || { 
        type: null,  // null = não identificado ainda
        lastQuestion: null, // rastreia a última pergunta feita
        name: null  // nome do cliente quando fornecido
    }; 
}

function setClientState(phone, state) {
    console.log('💾 Salvando estado para', phone, ':', state);
    clientStates.set(phone, state);
    saveStates(); // Salva após cada mudança
}

function clearClientState(phone) {
    clientStates.delete(phone);
    saveStates(); // Salva após cada mudança
}

module.exports = {
    getClientState,
    setClientState,
    clearClientState
};
