const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async ({ host, protocol }, context) => {
  try {
    const result = await cloud
      .openapi({
        appid: 'wxbbabf21880e09bf9',
      })
      .wxacode.getUnlimited({
        page: 'pages/index/index',
        scene: `domain=${protocol}//${host}`,
        checkPath: true,
        // env_version: 'trial'
      });
    return result;
  } catch (err) {
    return err;
  }
};
