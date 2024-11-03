import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { store } from '../stores';

ComponentWithStore({
  storeBindings: [
    {
      store,
      fields: ['showAppBar'] as const,
      actions: [] as const,
    },
  ],
});
