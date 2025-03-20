import { makeAutoObservable, observable, reaction } from 'mobx-miniprogram';
import { DEFAULT_PRIMARY_COLOR, MusicPlayer, Store } from '..';
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
    reaction(
      () => this.store.did,
      (did) => {
        if (did === 'host') this.syncMusic();
      },
    );
    reaction(
      () => ({
        url: this.store.musicUrl,
        name: this.store.musicName,
        album: this.store.musicAlbum,
        cover: this.store.musicCover,
        color: this.store.primaryColor,
        lyric: this.store.musicLyric,
        order: this.store.playOrder,
      }),
      (val) => {
        if (this.store.did !== 'host') return;
        wx.setStorageSync('hostMusicInfo', val);
      },
      {
        delay: 300,
      },
    );
  }

  get audioContext() {
    return this.store.feature.bgAudio
      ? this.bgAudioContext
      : this.innerAudioContext;
  }

  async syncMusic() {
    if (this.store.did !== 'host') {
      return;
    }
    const audioContext = this.audioContext;
    const musicInfo = wx.getStorageSync('hostMusicInfo') || {};
    this.store.setData({
      musicUrl: musicInfo.url,
      musicName: musicInfo.name || '',
      musicAlbum: musicInfo.album || '',
      musicCover: musicInfo.cover,
      primaryColor: musicInfo.color || DEFAULT_PRIMARY_COLOR,
      musicLyric: musicInfo.lyric || [],
      playOrder: musicInfo.playOrder || PlayOrderType.All,
      ...(audioContext && {
        status: audioContext.paused ? 'paused' : 'playing',
        duration: audioContext.duration,
        currentTime: audioContext.currentTime,
      }),
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
      status: 'loading',
      currentTime: 0,
      musicUrl: undefined,
    });

    if (!name && this.audioContext?.src) {
      this.store.setData({
        musicName,
        musicAlbum,
        status: 'playing',
        currentTime: this.audioContext.currentTime,
      });
      this.audioContext.play();
      this.store.updateCurrentTime();
      return;
    }

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

    if (!musicUrl.replace(/\?.*$/, '').match(/\/music\/(.*)/)?.[1]) {
      wx.showToast({
        title: '播放地址获取失败',
        icon: 'none',
      });
      this.pauseMusic();
      return;
    }

    this.store.setData({
      musicName,
      musicAlbum,
      musicUrl,
    });
    if (musicAlbum) this.setList(musicAlbum);

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
      bgAudioContext.title = this.store.musicName!;
      bgAudioContext.singer = this.store.musicAlbum!;
      bgAudioContext.coverImgUrl = this.store.musicCover!;
      bgAudioContext.playbackRate = this.speed;
      bgAudioContext.src = musicUrl;
      bgAudioContext.play();
      bgAudioContext.onPrev(() => {
        this.playPrevMusic();
      });
      bgAudioContext.onNext(() => {
        this.playNextMusic();
      });
      bgAudioContext.onError(() => {
        this.store.setData({ status: 'paused' });
        wx.showModal({
          title: '播放失败，是否关闭后台播放后重试',
          success: (res) => {
            if (!res.confirm) return;
            this.store.feature.setBgAudio(false);
            this.playMusic(name, album, src);
          },
        });
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
    innerAudioContext.onError((err) => {
      this.store.setData({ status: 'paused' });
      wx.showToast({
        title: err.errMsg || '加载失败',
        icon: 'none',
      });
    });
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
      if (this.store.did !== 'host') return;
      if (this.store.status === 'playing') return;
      wx.hideLoading();
      this.store.setData({
        status: 'playing',
        duration: context.duration,
        currentTime: context.currentTime,
      });
      this.store.updateCurrentTime();
    });
    context.onPause(() => {
      if (this.store.did !== 'host') return;
      this.store.setData({ status: 'paused' });
      if (this.store.playTimer) {
        clearTimeout(this.store.playTimer);
      }
    });
    context.onStop(() => {
      if (this.store.did !== 'host') return;
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
    if (!this.store.musicName) return;
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
    if (!this.store.musicName) return;
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
