import { observable, action } from 'mobx-miniprogram';
import { isPrivateDomain, request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';

const { platform } = wx.getDeviceInfo();
let innerAudioContext: WechatMiniprogram.InnerAudioContext;

export const store = observable({
  did: null as null | string,
  volume: 20,
  status: 'paused',
  musicName: wx.getStorageSync('musicName') || '',
  devices: {} as Record<string, Device>,
  playOrder: PlayOrderType.All,
  serverConfig: (wx.getStorageSync('serverConfig') || {}) as ServerConfig,

  menubar: true,
  connected: false,
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
        store.setData({ connected: false });
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
        connected: true,
        playOrder: devices[did]?.play_type ?? PlayOrderType.All,
      });

      store.syncMusic();
      store.syncVolume();
      setInterval(() => store.syncMusic(), 10 * 1000);
    } catch (err) {
      store.setData({ connected: false });
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

  playMusic: async (name: string = '', album: string = '') => {
    if (store.did !== 'host') {
      if (name) {
        await store.sendCommand(`播放列表${album}|${name}`);
      } else {
        await store.sendCommand('播放歌曲');
      }
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

    innerAudioContext?.destroy();
    innerAudioContext = wx.createInnerAudioContext();
    const { domain } = store.serverConfig;
    innerAudioContext.src = isPrivateDomain(domain)
      ? res.data.url
      : res.data.url?.replace(/:\/\/.*?\//, `://${domain}/`);
    innerAudioContext.play();

    store.setData({ musicName, status: 'playing' });
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
    }>({
      url: `/playingmusic?did=${store.did}`,
    });
    const { cur_music, is_playing } = res.data;
    store.setData({
      musicName: cur_music,
      status: is_playing ? 'playing' : 'paused',
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
