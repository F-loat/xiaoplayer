import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: {
    store,
    fields: ['did', 'devices'] as const,
    actions: [] as const,
  },
  methods: {
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
      const queue = store.devices.map(async (item) => {
        if (item.did === 'host') {
          if (store.status === 'playing') {
            await store.player.pauseMusic();
            return true;
          }
          return false;
        }
        const status = await store.backend.getPlayingStatus(item.did);
        if (status.isPlaying) {
          await store.sendCommand('关机', item.did);
        }
        return status.isPlaying;
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
    },
  },
});
