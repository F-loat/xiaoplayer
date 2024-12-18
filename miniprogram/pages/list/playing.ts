import { store } from '@/miniprogram/stores';
import { getGlobalData, request } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

const pageSize = 25;

ComponentWithStore({
  properties: {
    title: String,
  },
  data: {
    list: [] as string[],
    infos: {} as Record<
      string,
      {
        album?: string;
        cover?: string;
      }
    >,
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
      const curlist = musiclist[store.musicAlbum] || [];
      const loadedCount = this.data.list.length;
      if (loadedCount >= curlist.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: curlist.slice(0, count) });
      this.handleFetchInfos(loadedCount);
    },
    async handleFetchInfos(offset: number = 0) {
      if (!store.feature.musicInfos) {
        return;
      }
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[store.musicAlbum] || [];
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset);
      const names = indexes.reduce((result, index) => {
        if (!curlist[index]) return result;
        return result + `name=${curlist[index]}&`;
      }, '');
      if (!names) return;
      const { data: infos } = await request<
        {
          name: string;
          tags: {
            album: string;
            picture: string;
          };
        }[]
      >({
        url: `/musicinfos?${names}musictag=true`,
      });
      const newInfos = infos.reduce((result, current) => {
        return {
          ...result,
          [current.name]: {
            album: current.tags.album,
            cover: store.getResourceUrl(current.tags.picture),
          },
        };
      }, this.data.infos);
      this.setData({ infos: newInfos });
    },
  },
});
