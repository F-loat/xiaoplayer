import { store } from '@/miniprogram/stores';
import { request } from '@/miniprogram/utils';
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
        const res = await request<{
          cur_music: string;
          is_playing: boolean;
        }>({
          url: `/playingmusic?did=${item.did}`,
        });
        if (res.data.is_playing) {
          await store.sendCommand('关机', item.did);
        }
        return res.data.is_playing;
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
