import { observable, action, reaction } from 'mobx-miniprogram';
import { getCloudInstance, isPrivateDomain, request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';

const { platform } = wx.getDeviceInfo();
let innerAudioContext: WechatMiniprogram.InnerAudioContext;

const DEFAULT_COVER =
  'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fb-ssl.duitang.com%2Fuploads%2Fitem%2F201812%2F12%2F20181212223741_etgxt.jpg&refer=http%3A%2F%2Fb-ssl.duitang.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1705583419&t=8b8402f169f865f34c2f16649b0ba6d8';

export const store = observable({
  did: null as null | string,
  volume: 20,
  status: 'paused',
  album: '',
  musicLyric: wx.getStorageSync('musicLyric') || '',
  musicName: wx.getStorageSync('musicName') || '',
  musicCover: wx.getStorageSync('musicCover') || DEFAULT_COVER,
  duration: 0,
  currentTime: 0,

  devices: {} as Record<string, Device>,
  playOrder: PlayOrderType.All,
  serverConfig: (wx.getStorageSync('serverConfig') || {}) as ServerConfig,

  menubar: true,
  version: null as null | string,
  isPC: platform === 'windows' || platform === 'mac',

  get currentDevice() {
    if (!this.did || this.did === 'host') {
      return { name: '本机' };
    }
    return this.devices?.[this.did] || { name: '本机' };
  },

  setData: action((values: any) => Object.assign(store, values)),

  setServerConfig: action((config: ServerConfig) => {
    store.serverConfig = config;
    wx.setStorageSync('serverConfig', config);
  }),

  autoDetecteDomain: async () => {
    const config = store.serverConfig;
    if (!config.privateDomain || !config.publicDomain) {
      return;
    }
    const { networkType } = await wx.getNetworkType();
    if (networkType !== 'wifi') return;
    try {
      store.setServerConfig({
        ...config,
        domain: config.privateDomain,
      });
      const res = await request<{ version: string }>({ url: '/getversion' });
      store.setData({ version: res.data.version });
    } catch (err) {
      console.log(err);
      store.setServerConfig({
        ...config,
        domain: config.publicDomain,
      });
      const res = await request<{ version: string }>({ url: '/getversion' });
      store.setData({ version: res.data.version });
    }
  },

  initSettings: async () => {
    try {
      const res = await request<{
        detail?: string;
        devices: Record<string, any>;
      }>({
        url: '/getsetting',
      });
      console.info('@@@ settings', res.data);

      if (res.statusCode !== 200) {
        if (res.statusCode === 401) {
          wx.showModal({
            title: '鉴权失败',
            content: '请确认账号密码是否配置正确',
          });
        }
        return;
      }

      let did = wx.getStorageSync('did');
      const devices = res.data.devices || {};

      if (!did) {
        did = Object.keys(devices)[0];
        wx.setStorageSync('did', did);
      }

      store.setData({
        did,
        devices,
        playOrder: devices[did]?.play_type ?? PlayOrderType.All,
      });

      store.syncMusic().then(() => {
        store.fetchMusicTag(store.musicName);
      });
      store.syncVolume();
      setInterval(() => store.syncMusic(), 1000);
    } catch (err) {
      console.error(err);
    }
  },

  sendCommand(cmd: String, did?: string) {
    return request({
      url: '/cmd',
      method: 'POST',
      data: {
        cmd,
        did: did || store.did,
      },
    });
  },

  updateCurrentTime() {
    setTimeout(() => {
      store.setData({
        duration: innerAudioContext.duration,
        currentTime: innerAudioContext.currentTime,
      });
      store.updateCurrentTime();
    }, 100);
  },

  async fetchMusicTag(name: string, album: string = '') {
    const cloud = await getCloudInstance();
    cloud.callFunction({
      name: 'musictag',
      data: {
        title: name.replace(/^\d+\.\s?/g, '').trim(),
        album,
      },
      success(res) {
        if (!res.result) return;
        const musicLyric = res.result.lyric;
        const musicCover = res.result.album_img || DEFAULT_COVER;
        store.setData({
          musicLyric,
          musicCover,
        });
        wx.setStorageSync('musicLyric', musicLyric);
        wx.setStorageSync('musicCover', musicCover);
      },
    });
  },

  playMusic: async (name: string = '', album: string = '') => {
    if (name) store.fetchMusicTag(name, album);

    if (store.did !== 'host') {
      if (name) {
        await store.sendCommand(`播放列表${album}|${name}`);
      } else {
        await store.sendCommand('播放歌曲');
      }
      store.syncMusic();
      return;
    }

    if (!name && innerAudioContext?.src) {
      innerAudioContext.play();
      store.setData({ status: 'playing' });
      return;
    }

    let musicName = name || store.musicName;

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
    const { domain } = store.serverConfig;
    innerAudioContext.src = isPrivateDomain(domain)
      ? res.data.url
      : res.data.url?.replace(/:\/\/.*?\//, `://${domain}/`);
    innerAudioContext.play();
    innerAudioContext.onCanplay(() => {
      wx.hideLoading();
    });
    innerAudioContext.onPlay(() => {
      store.updateCurrentTime();
      store.setData({
        duration: innerAudioContext.duration,
        currentTime: innerAudioContext.currentTime,
      });
    });
    innerAudioContext.onError((err) => {
      wx.showToast({
        title: err.errMsg || '加载失败',
        icon: 'none',
      });
    });

    store.setData({ musicName, album, status: 'playing' });
    wx.setStorageSync('musicName', musicName);
  },

  pauseMusic: async () => {
    if (store.did === 'host') {
      innerAudioContext?.pause();
      store.setData({ status: 'paused' });
    } else {
      await store.sendCommand('关机');
    }
  },

  syncMusic: async () => {
    if (store.did === 'host') {
      return;
    }
    const res = await request<{
      cur_music: string;
      is_playing: boolean;
      offset: number;
      duration: number;
    }>({
      url: `/playingmusic?did=${store.did}`,
    });
    const { cur_music, is_playing, offset, duration } = res.data;
    store.setData({
      musicName: cur_music,
      status: is_playing ? 'playing' : 'paused',
      currentTime: offset,
      duration,
    });
  },

  syncVolume: async () => {
    if (store.did === 'host') {
      return;
    }
    const res = await request<{
      volume: number;
    }>({
      url: `/getvolume?did=${store.did}`,
    });
    store.setData({
      volume: res.data.volume,
    });
  },
});

reaction(
  () => store.musicName,
  (name) => {
    store.fetchMusicTag(name);
  },
);
