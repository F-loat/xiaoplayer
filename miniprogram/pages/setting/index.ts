import { store } from '@/miniprogram/stores';
import { Device, ServerConfig } from '@/miniprogram/types';
import { isPrivateDomain, request } from '@/miniprogram/utils';
import { reaction } from 'mobx-miniprogram';
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
      this._disposer = reaction(
        () => store.status,
        (status) => {
          this.setData({
            status: {
              ...this.data.status,
              [store.did!]: status === 'playing',
            },
          });
        },
      );
    },
    detached() {
      store.setData({ menubar: true });
      this._disposer();
    },
  },
  methods: {
    _disposer() {},
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
    async handleSaveConfig() {
      wx.showToast({
        title: '保存成功',
        icon: 'none',
      });
      const { serverConfig } = this.data;
      const config = {
        ...serverConfig,
        domain: isPrivateDomain(serverConfig.domain)
          ? serverConfig.privateDomain || serverConfig.publicDomain!
          : serverConfig.publicDomain!,
      };
      store.setServerConfig(config);
      await store.autoDetecteDomain();
      await store.initSettings();
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
    },
    async handleStopMusic() {
      const queue = Object.entries(this.data.status).map(([did, playing]) => {
        if (!playing) return Promise.resolve();
        return store.sendCommand('关机', did);
      });
      const res = await Promise.all(queue);
      if (res.every((r) => !r)) {
        wx.showToast({
          title: '暂无设备播放中',
          icon: 'none',
        });
      } else {
        wx.showToast({
          title: '设备已全部关闭',
          icon: 'none',
        });
      }
      this.syncDeviceStatus();
    },
  },
});
