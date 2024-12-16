import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { MusicPlayer, Store } from '..';
import { getGlobalData, removeProtocol, request } from '@/miniprogram/utils';
import { PlayOrderType } from '@/miniprogram/types';

let innerAudioContext: WechatMiniprogram.InnerAudioContext;

export class HostPlayerModule implements MusicPlayer {
  store: Store;
  stopAt: number = 0;
  speed = 1;
  volume = wx.getStorageSync('hostVolume') || 80;
  list: string[] = wx.getStorageSync('musicList') || [];

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => this.volume,
      (val) => wx.setStorageSync('hostVolume', val),
    );
  }

  setList(value: string[] = []) {
    const list =
      this.store.playOrder === PlayOrderType.Rnd
        ? value.sort(() => Math.random() - 0.5)
        : value;
    this.list = list;
    wx.setStorageSync('musicList', list);
  }

  getMusic() {
    return {
      url: innerAudioContext?.src,
    };
  }

  playMusic = async (name?: string, album?: string) => {
    const musicName = name || this.store.musicName;
    const musicAlbum = album || this.store.musicAlbum;

    this.store.setData({
      musicName,
      musicAlbum,
      status: 'playing',
      currentTime: 0,
      musicM3U8Url: undefined,
    });

    if (!name && innerAudioContext?.src) {
      this.store.setData({
        currentTime: innerAudioContext.currentTime,
      });
      innerAudioContext.play();
      this.store.updateCurrentTime();
      return;
    }

    const musiclist = getGlobalData('musiclist');
    this.setList(musiclist[musicAlbum] || []);

    const res = await request<{
      url: string;
    }>({
      url: `/musicinfo?name=${musicName}`,
    });

    const url = res.data.url || '';
    innerAudioContext?.destroy();
    const isM3U8 = url.split('?')[0].endsWith('m3u8');
    if (isM3U8) {
      this.store.setData({ musicM3U8Url: url });
      return;
    }
    wx.showLoading({
      title: '加载中',
    });
    innerAudioContext = wx.createInnerAudioContext();
    innerAudioContext.volume = this.volume / 100;
    innerAudioContext.playbackRate = this.speed;
    const {
      domain,
      publicDomain = '',
      privateDomain: _privateDomain,
    } = this.store.serverConfig;
    const protocol = publicDomain.match(/(.*):\/\//)?.[1] || 'http';
    const privateDomain =
      _privateDomain || url.match(/^https?:\/\/(.*?)\//)?.[1] || '';
    innerAudioContext.src =
      domain === publicDomain && url.includes(removeProtocol(privateDomain))
        ? `${protocol}://${removeProtocol(url).replace(
            removeProtocol(privateDomain),
            removeProtocol(publicDomain),
          )}`
        : url;
    innerAudioContext.play();
    innerAudioContext.onCanplay(() => {
      wx.hideLoading();
    });
    innerAudioContext.onTimeUpdate(() => {
      const duration = innerAudioContext.duration;
      if (duration !== this.store.duration) {
        this.store.setData({
          duration,
          currentTime: innerAudioContext.currentTime,
        });
        this.store.updateCurrentTime();
      }
    });
    innerAudioContext.onPause(() => {
      this.store.setData({ status: 'paused' });
      if (this.store.playTimer) {
        clearTimeout(this.store.playTimer);
      }
    });
    innerAudioContext.onEnded(() => this.handleMusicEnd());
    innerAudioContext.onError((err) => {
      this.store.setData({ status: 'paused' });
      wx.showToast({
        title: err.errMsg || '加载失败',
        icon: 'none',
      });
    });
  };

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
      const musiclist = getGlobalData('musiclist');
      this.setList(musiclist[this.store.musicAlbum || '所有歌曲'] || []);
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
      const musiclist = getGlobalData('musiclist');
      this.setList(musiclist[this.store.musicAlbum || '所有歌曲'] || []);
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
    innerAudioContext?.pause();
    this.store.setData({ status: 'paused' });
  };

  seekMusic = async (time: number) => {
    innerAudioContext.seek(time);
    this.store.setData({
      currentTime: time,
    });
    this.store.lyric.syncLyric(time);
  };

  setVolume = (volume: number) => {
    this.volume = volume;
    if (innerAudioContext) {
      innerAudioContext.volume = volume / 100;
    }
  };

  setSpeed = (speed: number) => {
    this.speed = speed;
    if (innerAudioContext) {
      innerAudioContext.playbackRate = speed;
    }
  };

  setStopAt = (minute: number) => {
    this.stopAt = Date.now() + minute * 60 * 1000;
  };
}
