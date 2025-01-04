import { SHARE_COVER, SLOGAN, store } from '@/miniprogram/stores';
import { ServerConfig } from '@/miniprogram/types';
import { isPrivateDomain } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    serverConfig: {} as ServerConfig,
    ADUnitId: import.meta.env.VITE_AD_SETTING_UNITID,
  },
  storeBindings: [
    {
      store,
      fields: ['did', 'version'] as const,
      actions: [] as const,
    },
    {
      store: store.feature,
      fields: ['homeDevices', 'advanceLyric', 'bgAudio'] as const,
      actions: [] as const,
    },
  ],
  lifetimes: {
    attached() {
      store.setData({ showAppBar: false });
      this.setData({
        serverConfig: { ...store.serverConfig },
      });
    },
    detached() {
      store.setData({ showAppBar: true });
    },
  },
  methods: {
    onShareAppMessage() {
      return {
        path: `/pages/index/index?serverConfig=${JSON.stringify(this.data.serverConfig)}`,
        title: SLOGAN,
        imageUrl: SHARE_COVER,
      };
    },
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
    handleHomeDevicesChange(e: {
      detail: {
        value: boolean;
      };
    }) {
      store.feature.setHomeDevices(e.detail.value);
    },
    handleAdvanceLyricChange(e: {
      detail: {
        value: boolean;
      };
    }) {
      store.feature.setAdvanceLyric(e.detail.value);
    },
    handleBgAudioChange(e: {
      detail: {
        value: boolean;
      };
    }) {
      store.feature.setBgAudio(e.detail.value);
    },
    async handleSaveConfig() {
      wx.showToast({
        title: '保存成功',
        icon: 'none',
      });
      const { serverConfig } = this.data;
      const { privateDomain, publicDomain } = serverConfig;
      const config = {
        ...serverConfig,
        publicDomain: publicDomain?.trim().replace(/\/$/, ''),
        privateDomain: privateDomain?.trim().replace(/\/$/, ''),
        domain:
          serverConfig.domain && isPrivateDomain(serverConfig.domain)
            ? privateDomain || publicDomain!
            : publicDomain || privateDomain!,
      };
      store.setServerConfig(config);
      await store.initSettings();
      wx.reLaunch({ url: '/pages/index/index' });
    },
    navigateToMore() {
      wx.navigateTo({
        url: '/pages/setting/more',
      });
    },
  },
});
