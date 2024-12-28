import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: {
    store,
    fields: [
      'isPC',
      'musicLyric',
      'musicLyricCurrent',
      'musicLyricLoading',
      'primaryColor',
    ] as const,
    actions: [] as const,
  },
});
