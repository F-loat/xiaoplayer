import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: [
    {
      store,
      fields: ['musicLyric', 'musicLyricCurrent', 'musicLyricLoading'] as const,
      actions: [] as const,
    },
    {
      store: store.lyric,
      fields: ['linePercent', 'mode'] as const,
      actions: [] as const,
    },
  ],
});
