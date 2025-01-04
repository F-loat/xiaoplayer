import { makeAutoObservable, observable, reaction } from 'mobx-miniprogram';
import { MusicPlayer, Store } from '..';
import { getGlobalData, request } from '@/miniprogram/utils';
import { PlayOrderType } from '@/miniprogram/types';

export class HostPlayerModule implements MusicPlayer {
  store: Store;
  stopAt: number = 0;
  speed = 1;
  volume = wx.getStorageSync('hostVolume') || 80;
  list: string[] = [];

  bgAudioContext?: WechatMiniprogram.BackgroundAudioManager;
  innerAudioContext?: WechatMiniprogram.InnerAudioContext;

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this, {
      bgAudioContext: observable.ref,
      innerAudioContext: observable.ref,
    });
    reaction(
      () => this.volume,
      (val) => wx.setStorageSync('hostVolume', val),
    );
  }

  get audioContext() {
    return this.store.feature.bgAudio
      ? this.bgAudioContext
      : this.innerAudioContext;
  }

  async syncMusic() {
    if (this.store.did !== 'host' || !this.store.feature.bgAudio) {
      return;
    }
    const bgAudioContext = wx.getBackgroundAudioManager();
    if (bgAudioContext.paused || !bgAudioContext.title) {
      return;
    }
    this.store.setData({
      musicName: bgAudioContext.title,
      musicCover: bgAudioContext.coverImgUrl,
      duration: bgAudioContext.duration,
      currentTime: bgAudioContext.currentTime,
    });
    this.store.updateCurrentTime();
  }

  setList(name: string) {
    const musiclist = getGlobalData('musiclist');
    const list = musiclist[name] || [];
    this.list =
      this.store.playOrder === PlayOrderType.Rnd
        ? list.sort(() => Math.random() - 0.5)
        : list;
    wx.setStorageSync('musicList', name);
  }

  getMusic() {
    return {
      url: this.audioContext?.src,
    };
  }

  playMusic = async (name?: string, album?: string, src?: string) => {
    const musicName = name || this.store.musicName;
    const musicAlbum = album || this.store.musicAlbum;

    this.store.setData({
      musicName,
      musicAlbum,
      status: 'loading',
      currentTime: 0,
      musicUrl: undefined,
    });

    if (!name && this.audioContext?.src) {
      this.store.setData({
        status: 'playing',
        currentTime: this.audioContext.currentTime,
      });
      this.audioContext.play();
      this.store.updateCurrentTime();
      return;
    }

    this.setList(musicAlbum);
    this.innerAudioContext?.destroy();

    const getMusicUrl = async () => {
      if (src) return src;
      const res = await request<{
        url: string;
      }>({
        url: `/musicinfo?name=${musicName}`,
      });
      return this.store.getResourceUrl(res.data.url || '');
    };

    const musicUrl = await getMusicUrl();

    this.store.setData({ musicUrl });

    if (this.store.isM3U8) {
      return;
    }

    wx.showLoading({
      title: '加载中',
    });

    if (this.store.feature.bgAudio) {
      this.store.setData({ status: 'loading' });
      await this.store.lyric.fetchMusicTag();
      const bgAudioContext = wx.getBackgroundAudioManager();
      bgAudioContext.audioType = 'music';
      bgAudioContext.title = this.store.musicName;
      bgAudioContext.singer = this.store.musicAlbum;
      bgAudioContext.coverImgUrl = this.store.musicCover;
      bgAudioContext.playbackRate = this.speed;
      bgAudioContext.src = musicUrl;
      bgAudioContext.play();
      bgAudioContext.onPrev(() => {
        this.playPrevMusic();
      });
      bgAudioContext.onNext(() => {
        this.playNextMusic();
      });
      this.addCommonListener(bgAudioContext);
      this.bgAudioContext = bgAudioContext;
      return;
    }

    this.store.lyric.fetchMusicTag();
    const innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.volume = this.volume / 100;
    innerAudioContext.playbackRate = this.speed;
    innerAudioContext.src = musicUrl;
    innerAudioContext.play();
    this.addCommonListener(innerAudioContext);
    this.innerAudioContext = innerAudioContext;
  };

  addCommonListener(
    context:
      | WechatMiniprogram.BackgroundAudioManager
      | WechatMiniprogram.InnerAudioContext,
  ) {
    context.onCanplay(() => {
      wx.hideLoading();
    });
    context.onPlay(() => {
      wx.hideLoading();
      this.store.setData({
        status: 'playing',
        duration: context.duration,
        currentTime: context.currentTime,
      });
      this.store.updateCurrentTime();
    });
    context.onPause(() => {
      this.store.setData({ status: 'paused' });
      if (this.store.playTimer) {
        clearTimeout(this.store.playTimer);
      }
    });
    context.onStop(() => {
      this.store.setData({ status: 'paused' });
      if (this.store.playTimer) {
        clearTimeout(this.store.playTimer);
      }
    });
    context.onTimeUpdate(() => {
      const duration = context.duration;
      if (duration !== this.store.duration) {
        this.store.setData({
          duration,
          currentTime: context.currentTime,
        });
        this.store.updateCurrentTime();
      }
    });
    context.onEnded(() => this.handleMusicEnd());
    context.onError((err) => {
      this.store.setData({ status: 'paused' });
      wx.showToast({
        title: err.errMsg || '加载失败',
        icon: 'none',
      });
    });
  }

  handleMusicEnd = async () => {
    if (this.stopAt && this.stopAt < Date.now()) {
      this.stopAt = 0;
      return;
    }
    if (this.store.playOrder === PlayOrderType.One) {
      this.playMusic();
    } else {
      this.playNextMusic();
    }
  };

  playPrevMusic = async () => {
    if (!this.list.length) {
      wx.showToast({
        title: '暂无播放中的列表',
        icon: 'none',
      });
      return;
    }
    if (this.list.length === 1) {
      this.setList(this.store.musicAlbum || '所有歌曲');
    }
    const index = this.list.indexOf(this.store.musicName);
    if (index === -1) {
      this.playMusic(this.list[0]);
      return;
    }
    const preIndex = index ? index - 1 : this.list.length - 1;
    this.playMusic(this.list[preIndex]);
  };

  playNextMusic = async () => {
    if (!this.list.length) {
      wx.showToast({
        title: '暂无播放中的列表',
        icon: 'none',
      });
      return;
    }
    if (this.list.length === 1) {
      this.setList(this.store.musicAlbum || '所有歌曲');
    }
    const index = this.list.indexOf(this.store.musicName);
    if (index === -1) {
      this.playMusic(this.list[0]);
      return;
    }
    const nextIndex = index === this.list.length - 1 ? 0 : index + 1;
    this.playMusic(this.list[nextIndex]);
  };

  pauseMusic = async () => {
    this.audioContext?.pause();
    this.store.setData({ status: 'paused' });
  };

  seekMusic = async (time: number) => {
    this.audioContext?.seek(time);
    this.store.setData({
      currentTime: time,
    });
    this.store.lyric.syncLyric(time);
  };

  setVolume = (volume: number) => {
    this.volume = volume;
    if (this.innerAudioContext) {
      this.innerAudioContext.volume = volume / 100;
    }
  };

  setSpeed = (speed: number) => {
    this.speed = speed;
    if (this.audioContext) {
      this.audioContext.playbackRate = speed;
    }
  };

  setStopAt = (minute: number) => {
    this.stopAt = Date.now() + minute * 60 * 1000;
  };
}
