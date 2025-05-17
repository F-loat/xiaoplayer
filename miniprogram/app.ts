import { store } from './stores';

globalThis.global = globalThis;

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  onShow() {
    store.player.syncMusic();
  },
  onLaunch() {
    store.initServer();
  },
  onError(err) {
    console.log('error', err);
  },
  onUnhandledRejection(err) {
    console.log('rejection', err);
  },
});
