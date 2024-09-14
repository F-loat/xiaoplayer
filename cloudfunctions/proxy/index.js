'use strict';

const axios = require('axios');

exports.main = async (
  { url, method, headers, body, ...params },
  context,
  callback,
) => {
  const response = await axios({
    url,
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    data: JSON.stringify(body),
    ...params,
  });

  callback(null, response.data);
};
