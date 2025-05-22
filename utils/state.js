let clients = {};

// Função para recuperar o estado do cliente
function getClientState(phone) {
  if (!clients[phone]) {
    clients[phone] = {
      lastQuestion: null,
      name: null,
      type: null,
      metadata: { interactions: 0, createdAt: Date.now(), lastUpdated: Date.now() }
    };
  }
  return clients[phone];
}

// Função para salvar o estado do cliente
function setClientState(phone, state) {
  // Se state for null ou undefined, remove o estado do cliente (limpa)
  if (state === null || state === undefined) {
    delete clients[phone];
    return;
  }
  // Garante que os metadados existam
  state.metadata = state.metadata || { interactions: 0, createdAt: Date.now(), lastUpdated: Date.now() };
  clients[phone] = state;
}

module.exports = { getClientState, setClientState };