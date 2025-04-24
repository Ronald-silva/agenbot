const askOpenAI = require('../services/openai');
const sendMessage = require('../services/zapi');

module.exports = async (req, res) => {
  const { phone, message } = req.body;

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
