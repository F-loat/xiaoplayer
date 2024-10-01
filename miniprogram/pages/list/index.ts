import { store } from '@/miniprogram/stores';
import { getGlobalData } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

const pageSize = 40;

ComponentWithStore({
  properties: {
    name: String,
  },
  data: {
    list: [] as string[],
  },
  lifetimes: {
    attached() {
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      this.setData({ list: curlist.slice(0, pageSize) });
    },
  },
  methods: {
    async handleViewTap(e: {
      target: {
        dataset: {
          name: string;
        };
      };
    }) {
      const { name } = e.target.dataset;
      await store.playMusic(name, this.data.name);
      store.syncMusic();
    },
    handleLoadMore() {
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const loadedCount = this.data.list.length;
      if (loadedCount >= curlist.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: curlist.slice(0, count) });
    },
  },
});
