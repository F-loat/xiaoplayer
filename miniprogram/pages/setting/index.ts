import {
  getGlobalData,
  isPrivateDomain,
  setGlobalData,
} from '@/miniprogram/utils/util';

Component({
  data: {
    serverConfig: {} as IAppOption['globalData']['serverConfig'],
  },
  lifetimes: {
    attached() {
      const instance = this.getInstance();
      instance?.setData({ menubar: false });
      this.setData({
        serverConfig: getGlobalData('serverConfig') || {},
      });
    },
    detached() {
      const instance = this.getInstance();
      instance?.setData({ menubar: true });
    },
  },
  methods: {
    getInstance() {
      if (typeof this.getAppBar === 'function') {
        return this.getAppBar();
      }
    },
    setServerConfig(
      key: keyof IAppOption['globalData']['serverConfig'],
      value: any,
    ) {
      const newServerConfig = {
        ...this.data.serverConfig,
        [key]: value,
      };
      this.setData({
        serverConfig: newServerConfig,
      });
    },
    handleFormChange(e) {
      const { name } = e.currentTarget.dataset;
      if (name) this.setServerConfig(name, e.detail.value);
    },
    handleSaveConfig() {
      wx.showToast({
        title: '保存成功',
        icon: 'none',
      });
      const { serverConfig } = this.data;
      const config = {
        ...serverConfig,
        domain: isPrivateDomain(serverConfig.domain)
          ? serverConfig.privateDomain
          : serverConfig.publicDomain,
      };
      setGlobalData('serverConfig', config);
      wx.setStorageSync('serverConfig', config);
      wx.reLaunch({ url: '/pages/index/index' });
    },
  },
});
