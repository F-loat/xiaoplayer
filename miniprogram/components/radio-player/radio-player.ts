import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { store } from '../../stores';

ComponentWithStore({
  storeBindings: [
    {
      store,
      fields: ['status', 'isM3U8', 'musicUrl'] as const,
      actions: [] as const,
    },
  ],
});
