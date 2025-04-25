const askOpenAI = require('../services/openai');
const sendMessage = require('../services/zapi');

module.exports = async (req, res) => {
  try {
    console.log('📥 Webhook acionado com payload:', req.body);

    const { from, body } = req.body;
    const phone = from || req.body.phone;
    const message = body || req.body.message;

    if (!phone || !message) {
      console.warn('⚠️ Dados incompletos:', { phone, message });
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    console.log(`📩 Mensagem recebida de ${phone}: "${message}"`);

    const resposta = await askOpenAI(message);
    console.log('🤖 Resposta da OpenAI:', resposta);

    const zapiResult = await sendMessage(phone, resposta);
    console.log('📤 Envio Z-API:', zapiResult);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Erro geral no webhook:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Erro interno' });
  }
};
