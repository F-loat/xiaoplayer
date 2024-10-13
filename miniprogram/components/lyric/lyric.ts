import { store } from '@/miniprogram/stores';
import { parseLrc } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  properties: {
    value: {
      type: String,
      value: '',
    },
    loading: {
      type: Boolean,
      value: false,
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
      const lrcArr = parseLrc(val);
      this.setData({
        lrcArr,
        currentIndex: 0,
      });
      this.triggerEvent('change', { value: lrcArr[0]?.lrc });
    },
    currentTime(val = 0) {
      const { lrcArr, currentIndex } = this.data;
      const currentTime = val * 1000;
      const nextIndex = currentIndex + 1;
      const nextTime = lrcArr[nextIndex]?.time;
      if (nextTime && nextTime < currentTime) {
        this.setData({
          currentIndex: nextIndex,
        });
        this.triggerEvent('change', { value: lrcArr[nextIndex]?.lrc });
      }
    },
  },
});
