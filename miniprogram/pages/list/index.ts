import { store } from '@/miniprogram/stores';
import { getGlobalData } from '@/miniprogram/utils';

const pageSize = 40;

Component({
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
      const { name: album, list } = this.data;
      await store.playMusic(name, album, list);
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
