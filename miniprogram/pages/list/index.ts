import { getGlobalData } from '@/miniprogram/utils/util';

Component({
  properties: {
    name: String,
  },
  data: {
    list: [] as string[],
  },
  lifetimes: {
    async attached() {
      const list = getGlobalData('musiclist');
      this.setData({ list: list[this.data.name] });
    },
  },
  methods: {
    getInstance() {
      if (typeof this.getAppBar === 'function') {
        return this.getAppBar();
      }
    },
    async handleViewTap(e) {
      const { name } = e.target.dataset;
      const instance = this.getInstance();
      if (!instance) return;
      if (instance.data.did === 'host') {
        instance.hostPlay(name);
      } else {
        await instance.sendCommand(`播放列表${this.data.name}|${name}`);
        instance.syncMusic();
      }
    },
  },
});
