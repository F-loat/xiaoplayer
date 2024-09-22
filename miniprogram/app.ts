import { store } from './stores';

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  onLaunch() {
    wx.cloud.init({
      env: process.env.WX_CLOUD_ENV,
    });
    store.initSettings();
  },
});
