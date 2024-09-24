import { store } from '@/miniprogram/stores';
import { Device, ServerConfig } from '@/miniprogram/types';
import { isPrivateDomain, request } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    status: {} as Record<string, boolean>,
    devices: [] as Device[],
    serverConfig: {} as ServerConfig,
  },
  storeBindings: {
    store,
    fields: ['did', 'version'] as const,
    actions: [] as const,
  },
  lifetimes: {
    attached() {
      store.setData({ menubar: false });
      this.setData({
        devices: Object.values(store.devices),
        serverConfig: { ...store.serverConfig },
      });
      this.syncDeviceStatus();
    },
    detached() {
      store.setData({ menubar: true });
    },
  },
  methods: {
    syncDeviceStatus() {
      this.data.devices.forEach(async (device) => {
        const res = await request<{
          cur_music: string;
          is_playing: boolean;
        }>({
          url: `/playingmusic?did=${device.did}`,
        });
        this.setData({
          status: {
            ...this.data.status,
            [device.did]: res.data.is_playing,
          },
        });
      });
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
      store.initSettings();
      wx.reLaunch({ url: '/pages/index/index' });
    },
    handleSwitchDevice(e: {
      currentTarget: {
        dataset: {
          did: string;
        };
      };
    }) {
      const { did } = e.currentTarget.dataset;
      if (did) store.setData({ did });
      store.syncMusic();
      store.syncVolume();
    },
    async handleStopMusic() {
      const queue = Object.entries(this.data.status).map(([did, playing]) => {
        if (!playing) return Promise.resolve();
        return store.sendCommand('关机', did);
      });
      await Promise.all(queue);
      this.syncDeviceStatus();
    },
  },
});
