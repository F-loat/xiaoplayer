import { reaction, makeAutoObservable } from 'mobx-miniprogram';
import { getCloudInstance, request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';
import { HostPlayerModule } from './modules/host';
import { XiaomusicPlayerModule } from './modules/xiaomusic';

const { platform } = wx.getDeviceInfo();

const DEFAULT_COVER =
  'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fb-ssl.duitang.com%2Fuploads%2Fitem%2F201812%2F12%2F20181212223741_etgxt.jpg&refer=http%3A%2F%2Fb-ssl.duitang.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1705583419&t=8b8402f169f865f34c2f16649b0ba6d8';

export interface MusicPlayer {
  playMusic(name?: string, album?: string, list?: string[]): Promise<void>;
  pauseMusic(): Promise<void>;
  playPrevMusic(): Promise<void>;
  playNextMusic(): Promise<void>;
}

export class Store {
  did: null | string = wx.getStorageSync('did');
  volume = 20;
  status: 'paused' | 'playing' = 'paused';
  musicAlbum = wx.getStorageSync('musicAlbum') || '';
  musicLyric = wx.getStorageSync('musicLyric') || '';
  musicName = wx.getStorageSync('musicName') || '';
  musicCover = wx.getStorageSync('musicCover') || DEFAULT_COVER;
  duration = 0;
  currentTime = 0;

  devices: Record<string, Device> = {};
  playOrder: PlayOrderType = PlayOrderType.All;

  serverConfig: ServerConfig = wx.getStorageSync('serverConfig') || {};

  menubar = true;
  version: null | string = null;
  isPC = platform === 'windows' || platform === 'mac';

  hostPlayer: MusicPlayer;
  xiaomusicPlayer: MusicPlayer;

  constructor() {
    makeAutoObservable(this);

    this.hostPlayer = new HostPlayerModule(this);
    this.xiaomusicPlayer = new XiaomusicPlayerModule(this);

    reaction(
      () => this.musicName,
      (name) => {
        this.setData({ musicLyric: '' });
        if (name) {
          this.fetchMusicTag(name, this.musicAlbum);
        } else {
          this.setData({ musicCover: DEFAULT_COVER });
        }
        wx.setStorageSync('musicName', name);
      },
    );

    reaction(
      () => this.did,
      (val) => wx.setStorageSync('did', val),
    );
    reaction(
      () => this.musicAlbum,
      (val) => wx.setStorageSync('musicAlbum', val),
    );
    reaction(
      () => this.musicLyric,
      (val) => wx.setStorageSync('musicLyric', val),
    );
    reaction(
      () => this.musicCover,
      (val) => wx.setStorageSync('musicCover', val),
    );
  }

  get currentPlayer() {
    if (this.did === 'host') return this.hostPlayer;
    return this.xiaomusicPlayer;
  }

  get currentDevice() {
    if (!this.did || this.did === 'host') {
      return { name: '本机' };
    }
    return this.devices?.[this.did] || { name: '本机' };
  }

  setData = (values: any) => {
    Object.assign(this, values);
  };

  setServerConfig = (config: ServerConfig) => {
    this.serverConfig = config;
    wx.setStorageSync('serverConfig', config);
  };

  autoDetecteDomain = async () => {
    const config = this.serverConfig;
    if (!config.privateDomain || !config.publicDomain) {
      return;
    }
    const { networkType } = await wx.getNetworkType();
    if (networkType !== 'wifi') return;
    try {
      this.setServerConfig({
        ...config,
        domain: config.privateDomain,
      });
      const res = await request<{ version: string }>({ url: '/getversion' });
      this.setData({ version: res.data.version });
    } catch (err) {
      console.log(err);
      this.setServerConfig({
        ...config,
        domain: config.publicDomain,
      });
      const res = await request<{ version: string }>({ url: '/getversion' });
      this.setData({ version: res.data.version });
    }
  };

  initSettings = async () => {
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
      }

      this.setData({
        did,
        devices,
        playOrder: devices[did]?.play_type ?? PlayOrderType.All,
      });
    } catch (err) {
      console.error(err);
    }
  };

  sendCommand = (cmd: String, did?: string) => {
    return request({
      url: '/cmd',
      method: 'POST',
      data: {
        cmd,
        did: did || this.did,
      },
    });
  };

  private fetchMusicTag = async (name: string, album: string = '') => {
    const cloud = await getCloudInstance();
    cloud.callFunction({
      name: 'musictag',
      data: {
        title: name.replace(/^\d+\.\s?/g, '').trim(),
        album,
      },
      success: (res) => {
        const result = res.result as {
          lyric: string;
          album_img?: string;
        };
        if (!result) return;
        const musicLyric = result.lyric;
        const musicCover = result.album_img || DEFAULT_COVER;
        this.setData({
          musicLyric,
          musicCover,
        });
      },
    });
  };

  get playMusic() {
    return this.currentPlayer.playMusic;
  }

  get pauseMusic() {
    return this.currentPlayer.pauseMusic;
  }

  get playPrevMusic() {
    return this.currentPlayer.playPrevMusic;
  }

  get playNextMusic() {
    return this.currentPlayer.playNextMusic;
  }
}

export const store = new Store();
