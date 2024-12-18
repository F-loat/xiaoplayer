import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { Store } from '..';
import { compareVersions } from 'compare-versions';

export class FeatureModule {
  store: Store;

  musicTags: boolean = false; // 歌曲标签获取
  musicScrape: boolean = false; // 歌曲标签刮削
  musicCover: boolean = false; // 歌曲封面获取
  musicInfos: boolean = false; // 歌曲封面批量获取

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => store.version,
      (version) => {
        if (!version) return;
        this.musicTags = compareVersions(version, '0.3.37') >= 0;
        this.musicScrape = compareVersions(version, '0.3.56') >= 0;
        this.musicCover = compareVersions(version, '0.3.56') >= 0;
        this.musicInfos = compareVersions(version, '0.3.38') >= 0;
      },
      {
        fireImmediately: true,
      },
    );
  }
}
