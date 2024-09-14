App<IAppOption>({
  globalData: {
    musiclist: {},
    serverConfig: wx.getStorageSync('serverConfig') || {},
  },
  onLaunch() {
    wx.cloud.init({
      env: process.env.WX_CLOUD_ENV,
    });
  },
});
