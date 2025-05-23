// utils/state.js
const redis = require('../services/redis');

// Cache em memória como fallback
const clients = new Map();

// TTL padrão para estados (24 horas)
const STATE_TTL = 24 * 60 * 60;

// Estado inicial padrão
function createInitialState() {
    const now = Date.now();
    return {
        lastQuestion: 'askName',
        name: null,
        type: null,
        messages: [],
        metadata: {
            createdAt: now,
            lastUpdated: now,
            interactions: 0
        }
    };
}

// Função helper para garantir que o estado está consistente
function validateState(state) {
    if (!state || typeof state !== 'object') {
        return createInitialState();
    }

    return {
        lastQuestion: state.lastQuestion || 'askName',
        name: state.name || null,
        type: state.type || null,
        messages: Array.isArray(state.messages) ? state.messages : [],
        metadata: {
            createdAt: state.metadata?.createdAt || Date.now(),
            lastUpdated: state.metadata?.lastUpdated || Date.now(),
            interactions: Number(state.metadata?.interactions) || 0
        }
    };
}

async function getClientState(phone) {
    try {
        // Tenta buscar do Redis primeiro
        const redisState = await redis.get(`state:${phone}`);
        if (redisState) {
            try {
                const parsed = validateState(JSON.parse(redisState));
                // Atualiza cache em memória
                clients.set(phone, parsed);
                return parsed;
            } catch (parseError) {
                console.error('❌ Erro ao fazer parse do estado:', parseError);
            }
        }

        // Se não encontrar no Redis ou houver erro no parse, tenta o cache em memória
        let state = clients.get(phone);
        
        // Se não encontrar em nenhum lugar, cria novo estado
        if (!state) {
            state = createInitialState();
        } else {
            state = validateState(state);
        }

        // Tenta sincronizar com Redis
        await redis.set(`state:${phone}`, JSON.stringify(state), { ttl: STATE_TTL });
        clients.set(phone, state);
        
        return state;
    } catch (err) {
        console.error('❌ Erro ao obter estado:', err);
        // Fallback para cache em memória
        const state = clients.get(phone) || createInitialState();
        return validateState(state);
    }
}

async function setClientState(phone, newState) {
    try {
        // Se newState for null, limpa o estado
        if (!newState) {
            await redis.client.del(`state:${phone}`);
            clients.delete(phone);
            return null;
        }

        // Obtém estado anterior para preservar metadata
        const oldState = await getClientState(phone);
        
        // Prepara o novo estado garantindo consistência
        const state = validateState({
            ...newState,
            metadata: {
                ...oldState?.metadata,
                lastUpdated: Date.now(),
                createdAt: oldState?.metadata?.createdAt || Date.now(),
                interactions: ((oldState?.metadata?.interactions || 0) + 1)
            }
        });

        // Tenta salvar no Redis
        await redis.set(`state:${phone}`, JSON.stringify(state), { ttl: STATE_TTL });
        
        // Atualiza cache em memória
        clients.set(phone, state);
        return state;
    } catch (err) {
        console.error('❌ Erro ao salvar estado:', err);
        // Fallback para apenas cache em memória
        const validState = validateState(newState);
        if (validState) {
            clients.set(phone, validState);
        } else {
            clients.delete(phone);
        }
        return validState;
    }
}

async function clearAllStates() {
    try {
        await redis.flushAll();
        clients.clear();
        return true;
    } catch (err) {
        console.error('❌ Erro ao limpar estados:', err);
        clients.clear();
        return false;
    }
}

module.exports = {
    getClientState,
    setClientState,
    clearAllStates,
    createInitialState
};