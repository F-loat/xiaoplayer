import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: [
    {
      store,
      fields: [
        'isPC',
        'musicLyric',
        'musicLyricCurrent',
        'musicLyricLoading',
      ] as const,
      actions: [] as const,
    },
    {
      store: store.lyric,
      fields: ['linePercent'] as const,
      actions: [] as const,
    },
    {
      store: store.feature,
      fields: ['advanceLyric'] as const,
      actions: [] as const,
    },
  ],
});
