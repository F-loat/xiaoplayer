import { store } from '@/miniprogram/stores';
import { parseLrc } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  properties: {
    value: {
      type: String,
      value: '',
    },
  },
  data: {
    lrcArr: [] as { time: number; lrc: string }[],
    currentIndex: 0,
  },
  storeBindings: {
    store,
    fields: ['currentTime'] as const,
    actions: [] as const,
  },
  observers: {
    value(val = '') {
      this.setData({
        lrcArr: parseLrc(val),
        currentIndex: 0,
      });
    },
    currentTime(val = 0) {
      const { lrcArr, currentIndex } = this.data;
      const currentTime = val * 1000;
      const nextTime = lrcArr[currentIndex + 1]?.time;
      if (nextTime && nextTime < currentTime) {
        this.setData({
          currentIndex: currentIndex + 1,
        });
      }
    },
  },
});
