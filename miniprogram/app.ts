import { store } from './stores';
import { ServerConfig } from './types';
import { safeJSONParse } from './utils';

App<IAppOption>({
  globalData: {
    musiclist: {},
  },
  async onLaunch(e) {
    if (e.query.serverConfig) {
      const config = safeJSONParse<ServerConfig>(e.query.serverConfig);
      if (config) store.setServerConfig(config);
    }
    await store.autoDetecteDomain();
    await store.initSettings();
  },
});
