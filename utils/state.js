// Gerencia o estado do chat por número de telefone
const clientStates = new Map();

function getClientState(phone) {
    return clientStates.get(phone) || { type: null }; // null = não identificado ainda
}

function setClientState(phone, state) {
    clientStates.set(phone, state);
}

function clearClientState(phone) {
    clientStates.delete(phone);
}

module.exports = {
    getClientState,
    setClientState,
    clearClientState
};
