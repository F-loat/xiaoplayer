import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  properties: {
    duration: {
      type: Number,
      value: 0,
    },
    currentTime: {
      type: Number,
      value: 0,
    },
  },
  storeBindings: {
    store,
    fields: ['currentTime'] as const,
    actions: [] as const,
  },
});
