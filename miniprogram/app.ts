import { store } from './stores';
import { ServerConfig } from './types';
import { parseAuthUrl, safeJSONParse } from './utils';

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  onShow() {
    store.player.syncMusic();
  },
  async onLaunch({ query }) {
    if (query.serverConfig) {
      const config = safeJSONParse<ServerConfig>(query.serverConfig);
      if (config) store.setServerConfig(config);
    } else if (query.scene) {
      const scene = decodeURIComponent(query.scene)
        .split('&')
        .reduce(
          (result, current: string) => {
            const [key, val] = current.split('=');
            return { ...result, [key]: val };
          },
          {} as Record<string, string>,
        );
      if (scene?.domain) {
        store.setServerConfig({
          ...store.serverConfig,
          ...parseAuthUrl(scene?.domain),
        });
      }
    }
    await store.initSettings();
  },
  onError(err) {
    console.log('error', err);
  },
  onUnhandledRejection(err) {
    console.log('rejection', err);
  },
});
