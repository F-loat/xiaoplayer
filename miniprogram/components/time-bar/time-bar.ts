import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: {
    store,
    fields: ['currentTime', 'duration'] as const,
    actions: [] as const,
  },
});
