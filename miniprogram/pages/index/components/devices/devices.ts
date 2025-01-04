import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  storeBindings: {
    store,
    fields: ['did', 'devices', 'primaryColor'] as const,
    actions: [] as const,
  },
  methods: {
    handleSwitchDevice(e: {
      currentTarget: {
        dataset: {
          did: string;
        };
      };
    }) {
      const { did } = e.currentTarget.dataset;
      if (did) store.setData({ did });
    },
  },
});
