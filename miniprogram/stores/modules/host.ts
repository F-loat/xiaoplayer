import { makeAutoObservable } from 'mobx-miniprogram';
import { MusicPlayer, Store } from '..';
import { isPrivateDomain, request } from '@/miniprogram/utils';
import { PlayOrderType } from '@/miniprogram/types';

let innerAudioContext: WechatMiniprogram.InnerAudioContext;

export class HostPlayerModule implements MusicPlayer {
  store: Store;
  list: string[] = wx.getStorageSync('musicList') || [];

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);
  }

  setList(value: string[]) {
    this.list = value;
    wx.setStorageSync('musicList', value);
  }

  playMusic = async (name = '', album = '', list?: string[]) => {
    const musicName = name || this.store.musicName;

    this.store.setData({
      musicName,
      musicAlbum: album || this.store.musicAlbum,
      status: 'playing',
    });
    if (list) this.setList(list);

    if (!name && innerAudioContext?.src) {
      innerAudioContext.play();
      return;
    }

    const res = await request<{
      url: string;
    }>({
      url: `/musicinfo?name=${musicName}`,
    });

    wx.showLoading({
      title: '加载中',
    });
    innerAudioContext?.destroy();
    innerAudioContext = wx.createInnerAudioContext();
    const { domain } = this.store.serverConfig;
    innerAudioContext.src = isPrivateDomain(domain)
      ? res.data.url
      : res.data.url?.replace(/:\/\/.*?\//, `://${domain}/`);
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
    innerAudioContext.onEnded(() => {
      if (this.store.playOrder === PlayOrderType.One) {
        this.playMusic();
      } else {
        this.playNextMusic();
      }
    });
    innerAudioContext.onError((err) => {
      this.store.setData({ status: 'paused' });
      wx.showToast({
        title: err.errMsg || '加载失败',
        icon: 'none',
      });
    });
  };

  playPrevMusic = async () => {
    if (!this.list.length) {
      wx.showToast({
        title: '暂无播放中的列表',
        icon: 'none',
      });
      return;
    }
    const index = this.list.indexOf(this.store.musicName);
    if (index === -1) {
      this.playMusic(this.list[0], this.store.musicAlbum);
      return;
    }
    const preIndex = index ? index - 1 : this.list.length - 1;
    this.playMusic(this.list[preIndex], this.store.musicAlbum);
  };

  playNextMusic = async () => {
    if (!this.list.length) {
      wx.showToast({
        title: '暂无播放中的列表',
        icon: 'none',
      });
      return;
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
}
