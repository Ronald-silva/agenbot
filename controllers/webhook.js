// controllers/webhook.js
const { chat } = require('../services/openai');
const { getClientState, setClientState } = require('../utils/state');

// Mensagens padrão
const MESSAGES = {
    greetings: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'],
    askName: 'Por favor, me diga seu nome completo para que eu possa te atender melhor.',
    shortName: 'Por favor, me diga seu nome completo.',
    askType: (name) => `Olá ${name}! Você é cliente final ou lojista/revendedor?`,
    confirmType: (type) => `Perfeito! Vou te atender como ${type}. Como posso ajudar?`
};

async function webhook(req, res) {
    try {
        console.log('🔥 Payload recebido:', JSON.stringify(req.body));

        // Validação básica
        const { chatId, chatLid, text, fromMe, fromApi } = req.body;
        if (fromMe || fromApi) {
            return res.sendStatus(200);
        }

        const id = chatId || chatLid;
        if (!id || !text?.message) {
            return res.status(400).json({ error: 'Payload inválido' });
        }

        // Extrai telefone e mensagem
        const phone = id.split('@')[0];
        const message = text.message.trim().toLowerCase();

        // Obtém estado atual
        let state = await getClientState(phone);
        const oldState = { ...state };

        let response;

        // Lógica principal baseada no estado atual
        if (state.lastQuestion === 'askName' || !state.name) {
            // Se for uma saudação, mantém pedindo o nome
            if (MESSAGES.greetings.includes(message)) {
                response = MESSAGES.askName;
            } else if (message.length < 2) {
                response = MESSAGES.shortName;
            } else {
                state.name = text.message.trim(); // Usa o texto original para preservar capitalização
                state.lastQuestion = 'askType';
                response = MESSAGES.askType(state.name);
            }
        } else if (state.lastQuestion === 'askType' || !state.type) {
            const isLojista = /lojista|revenda|atacado/i.test(message);
            state.type = isLojista ? 'lojista' : 'cliente';
            state.lastQuestion = 'chat';
            response = MESSAGES.confirmType(state.type);
        } else {
            response = await chat(message);
        }

        // Atualiza mensagens
        state.messages = state.messages || [];
        state.messages.push(
            { role: 'user', content: text.message.trim() },
            { role: 'assistant', content: response }
        );

        // Limita histórico de mensagens
        if (state.messages.length > 10) {
            state.messages = state.messages.slice(-10);
        }

        // Atualiza metadata
        if (state.lastQuestion !== oldState.lastQuestion || 
            state.name !== oldState.name || 
            state.type !== oldState.type) {
            state.metadata = {
                ...state.metadata,
                createdAt: oldState.metadata?.createdAt || Date.now(),
                lastUpdated: Date.now(),
                interactions: (oldState.metadata?.interactions || 0) + 1
            };
        }

        // Atualiza estado
        state = await setClientState(phone, state);
        console.log('📊 Estado atualizado:', state);

        // Em ambiente de teste, apenas simula o envio
        if (process.env.NODE_ENV === 'test') {
            console.log('✅ Mensagem enviada');
            return res.json({ success: true });
        }

        // Em produção envia a mensagem real
        try {
            await require('./zapi').sendMessage(phone, response);
            return res.json({ success: true });
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            return res.json({ success: true, warning: 'Erro ao enviar mensagem' });
        }
    } catch (err) {
        console.error('❌ Erro:', err);
        return res.status(500).json({ error: 'Erro interno' });
    }
}

module.exports = webhook;