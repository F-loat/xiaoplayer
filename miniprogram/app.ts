import { store } from './stores';

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  async onLaunch() {
    wx.cloud.init({
      env: process.env.WX_CLOUD_ENV,
    });
    await store.autoDetecteDomain();
    await store.initSettings();
  },
});
