if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');

module.exports = async (phone, message) => {
  const INSTANCE_ID    = process.env.ZAPI_INSTANCE_ID.trim();
  const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN.trim();
  const CLIENT_TOKEN   = process.env.ZAPI_CLIENT_TOKEN.trim();

  const url = `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}/send-text`;

  return axios.post(
    url,
    { phone, message },
    {
      headers: {
        'Content-Type':  'application/json',
        'Client-Token':  CLIENT_TOKEN
      }
    }
  );
};
