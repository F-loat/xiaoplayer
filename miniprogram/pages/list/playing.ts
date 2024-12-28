import { store } from '@/miniprogram/stores';
import { getGlobalData, request } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

const pageSize = 25;

ComponentWithStore({
  properties: {
    title: String,
  },
  data: {
    list: [] as {
      name: string;
      cover?: string;
      album?: string;
    }[],
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
      const curlist: string[] = musiclist[store.musicAlbum] || [];
      const list = curlist.slice(0, pageSize).map((name) => ({ name }));
      this.setData({ list });
      this.handleFetchInfos();
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
      await store.player.playMusic(name, store.musicAlbum);
    },
    handleLoadMore() {
      const musiclist = getGlobalData('musiclist');
      const curlist: string[] = musiclist[store.musicAlbum] || [];

      const loadedCount = this.data.list.length;
      if (loadedCount >= curlist.length) return;

      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + loadedCount);
      const data = indexes.reduce((result, index) => {
        if (!curlist[index]) return result;
        return {
          ...result,
          [`list[${index}]`]: { name: curlist[index] },
        };
      }, {});

      this.setData(data);
      this.handleFetchInfos(loadedCount);
    },
    async handleFetchInfos(offset: number = 0) {
      const curlist = this.data.list;
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset);

      const names = indexes.reduce((result, index) => {
        if (!curlist[index]) return result;
        return result.concat(curlist[index].name);
      }, [] as string[]);

      await store.info.fetchInfos(names);

      const data = indexes.reduce((result, index) => {
        const music = curlist[index]?.name;
        const cover = store.info.getCover(music);
        const album = store.info.getAlbum(music);
        if (!music || (!cover && !album)) return result;
        return {
          ...result,
          [`list[${index}].cover`]: cover,
          [`list[${index}].album`]: album,
        };
      }, {});

      this.setData(data);
    },
  },
});
