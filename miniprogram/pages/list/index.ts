import { store } from '@/miniprogram/stores';
import { getGlobalData, request } from '@/miniprogram/utils';

const pageSize = 25;

Component({
  properties: {
    name: String,
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
    filterValue: '',
  },
  lifetimes: {
    attached() {
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      this.setData({ list: curlist.slice(0, pageSize) });
      this.handleFetchInfos();
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
      this.handleFetchInfos(loadedCount);
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
    async handleFetchInfos(offset: number = 0) {
      if (!store.feature.musicInfos || this.data.filterValue) {
        return;
      }
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
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
