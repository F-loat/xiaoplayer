import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { store } from '../../stores';

ComponentWithStore({
  storeBindings: [
    {
      store,
      fields: ['status', 'musicM3U8Url'] as const,
      actions: [] as const,
    },
  ],
});
