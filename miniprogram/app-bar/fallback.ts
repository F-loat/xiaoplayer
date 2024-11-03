import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { store } from '../stores';

ComponentWithStore({
  storeBindings: {
    store,
    fields: ['isPC'] as const,
    actions: [] as const,
  },
});
