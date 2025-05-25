const { MiniAPI } = require('wechat-api-next');

const client = new MiniAPI({
  appid: process.env.WEAPP_APPID,
  appsecret: process.env.WEAPP_APPSECRET,
});

exports.main = async ({ host, protocol }, context, callback) => {
  try {
    const result = await client.wxacode.getUnlimited({
      page: 'pages/index/index',
      scene: `domain=${protocol}//${host}`,
      // env_version: 'trial'
    });
    callback(null, result);
  } catch (err) {
    callback(err);
  }
};
