import { store } from '@/miniprogram/stores';
import { ServerConfig } from '@/miniprogram/types';
import { isPrivateDomain } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    serverConfig: {} as ServerConfig,
  },
  lifetimes: {
    attached() {
      store.setData({ menubar: false });
      this.setData({
        serverConfig: { ...store.serverConfig },
      });
    },
    detached() {
      store.setData({ menubar: true });
    },
  },
  methods: {
    handleFormChange(e: {
      currentTarget: {
        dataset: {
          name: string;
        };
      };
      detail: {
        value: string;
      };
    }) {
      const { name } = e.currentTarget.dataset;
      if (!name) return;
      this.setData({
        serverConfig: {
          ...this.data.serverConfig,
          [name]: e.detail.value,
        },
      });
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
          ? serverConfig.privateDomain!
          : serverConfig.publicDomain!,
      };
      store.setServerConfig(config);
      wx.reLaunch({ url: '/pages/index/index' });
    },
  },
});
