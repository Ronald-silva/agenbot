if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');

module.exports = async (phone, message) => {
  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/send-messages`;

  return await axios.post(
    url,
    { phone, message },
    { headers: { 'Client-Token': process.env.ZAPI_TOKEN } }
  );
};
