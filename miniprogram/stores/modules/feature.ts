import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { Store } from '..';
import { compareVersions } from 'compare-versions';

export class FeatureModule {
  store: Store;

  homeDevices: boolean; // 首页设备
  advanceLyric: boolean; // 逐字歌词
  bgAudio: boolean; // 后台播放

  musicTags: boolean = true; // 歌曲标签获取
  musicInfos: boolean = true; // 歌曲封面批量获取
  musicScrape: boolean = false; // 歌曲标签刮削
  playlist: boolean = false; // 自定义歌单
  renamePlaylist: boolean = false; // 重命名自定义歌单
  playText: boolean = false; // 播放文字
  playApi: boolean = false; // 播放专用接口

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    const featureInfo = wx.getStorageSync('featureInfo') || {};
    this.homeDevices = featureInfo.homeDevices ?? true;
    this.advanceLyric = featureInfo.advanceLyric ?? true;
    this.bgAudio = featureInfo.bgAudio ?? true;

    reaction(
      () => ({
        homeDevices: this.homeDevices,
        advanceLyric: this.advanceLyric,
        bgAudio: this.bgAudio,
      }),
      (val) => wx.setStorageSync('featureInfo', val),
      {
        delay: 1000,
      },
    );
    reaction(
      () => store.version,
      (version) => {
        if (!version) return;
        this.musicTags = compareVersions(version, '0.3.37') >= 0;
        this.musicInfos = compareVersions(version, '0.3.38') >= 0;
        this.musicScrape = compareVersions(version, '0.3.56') >= 0;
        this.playlist = compareVersions(version, '0.3.59') >= 0;
        this.renamePlaylist = compareVersions(version, '0.3.65') >= 0;
        this.playText = compareVersions(version, '0.3.72') >= 0;
        this.playApi = compareVersions(version, '0.3.50') >= 0;
      },
      {
        fireImmediately: true,
      },
    );
  }

  setHomeDevices(value: boolean) {
    this.homeDevices = value;
  }

  setAdvanceLyric(value: boolean) {
    this.advanceLyric = value;
  }

  setBgAudio(value: boolean) {
    this.bgAudio = value;
    this.store.hostPlayer.audioContext?.stop();
  }
}
