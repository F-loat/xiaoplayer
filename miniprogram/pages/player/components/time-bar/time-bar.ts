import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    newTime: 0,
    windowWidth: wx.getWindowInfo().windowWidth,
  },
  storeBindings: {
    store,
    fields: ['status', 'currentTime', 'duration'] as const,
    actions: [] as const,
  },
  methods: {
    handleChange(e: { touches: { clientX: number }[] }) {
      if (!store.duration || !e.touches.length) {
        return;
      }
      if (store.did !== 'host') {
        wx.showToast({
          title: '仅本机播放支持调整进度',
          icon: 'none',
        });
        return;
      }
      const [touch] = e.touches;
      const clientX =
        touch.clientX > this.data.windowWidth
          ? this.data.windowWidth
          : touch.clientX > 0
            ? touch.clientX
            : 0;
      const persent = clientX / this.data.windowWidth;
      const time = store.duration * persent;
      if (Math.abs(time - this.data.newTime) > 10) {
        this.setData({ newTime: time });
      }
    },
    handleSeek() {
      if (!this.data.newTime) return;
      store.player.seekMusic(this.data.newTime);
      this.setData({ newTime: 0 });
    },
    handleTap(e: { touches: { clientX: number }[] }) {
      this.handleChange(e);
      this.handleSeek();
    },
  },
});
