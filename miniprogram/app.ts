import { store } from './stores';

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  async onLaunch() {
    await store.autoDetecteDomain();
    await store.initSettings();
  },
});
