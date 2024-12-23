import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { Store } from '..';
import { compareVersions } from 'compare-versions';

export class FeatureModule {
  store: Store;

  musicTags: boolean = true; // 歌曲标签获取
  musicInfos: boolean = true; // 歌曲封面批量获取
  playlist: boolean = false; // 自定义歌单
  renamePlaylist: boolean = false; // 重命名自定义歌单
  musicScrape: boolean = false; // 歌曲标签刮削

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => store.version,
      (version) => {
        if (!version) return;
        this.musicTags = compareVersions(version, '0.3.37') >= 0;
        this.musicInfos = compareVersions(version, '0.3.38') >= 0;
        this.musicScrape = compareVersions(version, '0.3.56') >= 0;
        this.playlist = compareVersions(version, '0.3.59') >= 0;
        this.renamePlaylist = compareVersions(version, '0.3.65') >= 0;
      },
      {
        fireImmediately: true,
      },
    );
  }
}
