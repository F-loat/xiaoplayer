import { store } from '@/miniprogram/stores';
import { getGlobalData } from '@/miniprogram/utils';

const pageSize = 40;

Component({
  properties: {
    name: String,
    title: String,
  },
  data: {
    list: [] as string[],
    filterValue: '',
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
      const { name: album } = this.data;
      await store.player.playMusic(name, album);
    },
    handleLoadMore() {
      const { filterValue } = this.data;
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const filteredList = filterValue
        ? curlist.filter((item: string) => item.includes(filterValue))
        : curlist;
      const loadedCount = this.data.list.length;
      if (loadedCount >= filteredList.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: filteredList.slice(0, count) });
    },
    handleFilter(e: {
      detail: {
        value: string;
      };
    }) {
      const { value } = e.detail;
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const filteredList = value
        ? curlist.filter((item: string) => item.includes(value))
        : curlist;
      this.setData({
        filterValue: value,
        list: filteredList.slice(0, pageSize),
      });
    },
  },
});
