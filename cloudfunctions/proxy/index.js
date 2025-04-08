'use strict';

const axios = require('axios');
const https = require('https');

exports.main = async (
  { url, method, headers, body, ...params },
  context,
  callback,
) => {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });
    const response = await axios({
      url,
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      data: JSON.stringify(body),
      httpsAgent: agent,
      ...params,
    });

    callback(null, response.data);
  } catch (error) {
    callback(error);
  }
};
