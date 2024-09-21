const { platform } = wx.getDeviceInfo();

App<IAppOption>({
  globalData: {
    musiclist: {},
    serverConfig: wx.getStorageSync('serverConfig') || {},
    isPC: platform === 'windows' || platform === 'mac',
  },
  onLaunch() {
    wx.cloud.init({
      env: process.env.WX_CLOUD_ENV,
    });
  },
});
