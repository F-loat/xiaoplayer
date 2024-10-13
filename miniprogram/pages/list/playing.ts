import { store } from '@/miniprogram/stores';
import { getGlobalData, request } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

const pageSize = 40;

ComponentWithStore({
  data: {
    list: [] as string[],
  },
  storeBindings: {
    store,
    fields: ['musicName'] as const,
    actions: [] as const,
  },
  lifetimes: {
    async attached() {
      if (!store.musicAlbum) {
        await this.fetchPlaylist();
      }
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[store.musicAlbum] || [];
      this.setData({ list: curlist.slice(0, pageSize) });
    },
  },
  methods: {
    async fetchPlaylist() {
      const { data: musicAlbum } = await request({
        url: '/curplaylist',
        method: 'GET',
        data: {
          did: store.did,
        },
      });
      store.setData({ musicAlbum });
    },
    async handleViewTap(e: {
      target: {
        dataset: {
          name: string;
        };
      };
    }) {
      const { name } = e.target.dataset;
      const { list } = this.data;
      await store.playMusic(name, store.musicAlbum, list);
    },
    handleLoadMore() {
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[store.musicAlbum] || [];
      const loadedCount = this.data.list.length;
      if (loadedCount >= curlist.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: curlist.slice(0, count) });
    },
  },
});
