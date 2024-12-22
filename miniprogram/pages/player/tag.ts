import { store } from '@/miniprogram/stores';
import { Lyric, parseLrc, Tag } from '@/miniprogram/stores/modules/lyric';
import { getCloudInstance } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

let timer: number | null = null;

ComponentWithStore({
  data: {
    list: [] as Tag[],
    _lyrics: [] as Lyric[][],
    currentLyrics: [] as string[],
  },
  storeBindings: {
    store,
    fields: ['musicName'] as const,
    actions: [] as const,
  },
  lifetimes: {
    attached() {
      this.fetchMusicTags();
    },
    detached() {
      wx.hideLoading();
      if (timer) clearTimeout(timer);
    },
  },
  methods: {
    async fetchMusicTags() {
      if (!store.musicName) return;
      wx.showLoading({
        title: '加载中',
      });
      const cloud = await getCloudInstance();
      const [name, artist] = store.musicName.split('-').reverse();
      cloud.callFunction({
        name: 'musictag',
        data: {
          title: name,
          album: store.musicAlbum,
          artist: artist,
          mode: 'list',
        },
        success: (res) => {
          const result = (res.result as Tag[]) || [];
          this.setData({
            list: result.map((item) => ({
              ...item,
              lyrics: parseLrc(item.lyric),
            })),
          });
          this.data._lyrics = result.map((item) => parseLrc(item.lyric));
          this.handleCurrentLyric();
        },
        complete() {
          wx.hideLoading();
        },
      });
    },
    findCurrentIndex(list: Lyric[]) {
      let index = 0;
      const time = store.currentTime;
      while (list[index] && list[index].time < time * 1000) {
        index += 1;
      }
      return Math.min(index, list.length - 1);
    },
    handleCurrentLyric() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const lyrics = this.data._lyrics.map((lyric) => {
          const index = this.findCurrentIndex(lyric);
          return lyric[index]?.lrc;
        });
        this.setData({ currentLyrics: lyrics });
        if (store.status === 'playing') {
          this.handleCurrentLyric();
        }
      }, 1000);
    },
    handleViewTap(e: {
      target: {
        dataset: {
          index: number;
        };
      };
    }) {
      const { index } = e.target.dataset;
      const tag = this.data.list[index];
      if (tag) store.lyric.applyScrapedMusicTag(tag);
      wx.navigateBack();
    },
  },
});
