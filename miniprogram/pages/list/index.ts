import { store } from '@/miniprogram/stores';
import { getGlobalData } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
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
    async handleViewTap(e: {
      target: {
        dataset: {
          name: string;
        };
      };
    }) {
      const { name } = e.target.dataset;
      store.playMusic(name, this.data.name);
    },
  },
});
