const askOpenAI = require('../services/openai');
const sendMessage = require('../services/zapi');

module.exports = async (req, res) => {
  // Payload padrão da Z-API ao receber mensagem
  const { from, body } = req.body;

  // Se vier no formato antigo, usa phone/message
  const phone = from || req.body.phone;
  const message = body || req.body.message;

  if (!phone || !message) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    const resposta = await askOpenAI(message);
    await sendMessage(phone, resposta);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erro:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
};