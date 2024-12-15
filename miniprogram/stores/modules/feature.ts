import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { Store } from '..';
import { compareVersions } from 'compare-versions';

export class FeatureModule {
  store: Store;

  musicTags: boolean = false; // 歌曲标签获取
  musicScrape: boolean = false; // 歌曲标签刮削

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => store.version,
      (version) => {
        if (!version) return;
        this.musicTags = compareVersions(version, '0.3.37') >= 0;
        this.musicScrape = compareVersions(version, '0.3.56') >= 0;
      },
      {
        fireImmediately: true,
      },
    );
  }
}
