import { reaction, makeAutoObservable } from 'mobx-miniprogram';
import { request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';
import { HostPlayerModule } from './modules/host';
import { XiaomusicPlayerModule } from './modules/xiaomusic';
import { FavoriteModule } from './modules/favorite';
import { LyricModule } from './modules/lyric';

const { platform } = wx.getDeviceInfo();

export const DEFAULT_COVER =
  'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fb-ssl.duitang.com%2Fuploads%2Fitem%2F201812%2F12%2F20181212223741_etgxt.jpg&refer=http%3A%2F%2Fb-ssl.duitang.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1705583419&t=8b8402f169f865f34c2f16649b0ba6d8';

export interface MusicPlayer {
  speed: number;
  volume: number;
  setSpeed: (speed: number) => void;
  setStopAt: (minute: number) => void;
  setVolume: (volume: number) => Promise<any> | void;
  getMusic: () => { url?: string };
  playMusic: (name?: string, album?: string) => Promise<void>;
  pauseMusic(): Promise<void>;
  seekMusic: (time: number) => Promise<void>;
  playPrevMusic(): Promise<void>;
  playNextMusic(): Promise<void>;
  handleMusicEnd(): Promise<void>;
}

export class Store {
  did: null | string = wx.getStorageSync('did');
  status: 'paused' | 'loading' | 'playing' = 'paused';

  musicName: string;
  musicCover: string;
  musicAlbum: string;
  musicLyric: { time: number; lrc: string }[] = [];
  musicLyricCurrent: { index: number; lrc: string } = { index: 0, lrc: '' };
  musicLyricLoading = false;

  musicM3U8Url?: string;

  duration = 0;
  currentTime = 0;
  playOrder: PlayOrderType = PlayOrderType.All;
  playTimer: number | null = null;

  showAppBar = true;
  version: null | string = null;
  devices: Record<string, Device> = {};
  isPC =
    platform === 'windows' ||
    platform === 'mac' ||
    !wx.getSkylineInfoSync?.().isSupported;
  serverConfig: ServerConfig = wx.getStorageSync('serverConfig') || {};

  lyric: LyricModule;
  favorite: FavoriteModule;
  hostPlayer: MusicPlayer;
  xiaomusicPlayer: MusicPlayer;

  constructor() {
    makeAutoObservable(this);

    this.lyric = new LyricModule(this);
    this.favorite = new FavoriteModule(this);
    this.hostPlayer = new HostPlayerModule(this);
    this.xiaomusicPlayer = new XiaomusicPlayerModule(this);

    const musicInfo = wx.getStorageSync('musicInfo') || {};

    this.musicName = musicInfo.name || '';
    this.musicAlbum = musicInfo.album || '';
    this.musicLyric = musicInfo.lyric || [];
    this.musicCover = musicInfo.cover || DEFAULT_COVER;

    reaction(
      () => this.musicName,
      (name) => {
        if (this.playTimer) clearTimeout(this.playTimer);
        this.setData({ musicLyric: [], currentTime: 0, duration: 0 });
        if (name) {
          this.lyric.fetchMusicTag(
            name.replace(/^\d+\.\s?/g, ''),
            this.musicAlbum?.replace(/（.*）/g, ''),
          );
        } else {
          this.setData({ musicCover: DEFAULT_COVER });
        }
      },
    );

    reaction(
      () => this.did,
      (val) => wx.setStorageSync('did', val),
    );
    reaction(
      () => ({
        name: this.musicName,
        album: this.musicAlbum,
        lyric: this.musicLyric,
        cover: this.musicCover,
      }),
      (val) => wx.setStorageSync('musicInfo', val),
    );
  }

  get player() {
    if (this.did === 'host') return this.hostPlayer;
    return this.xiaomusicPlayer;
  }

  get speed() {
    return this.player.speed;
  }

  get volume() {
    return this.player.volume;
  }

  get isFavorite() {
    return this.favorite.isFavorite(this.musicName);
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
            success: (res) => {
              if (!res.confirm) return;
              wx.navigateTo({
                url: '/pages/setting/index',
              });
            },
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

      const { data } = await request<{
        version: string;
      }>({
        url: '/getversion',
      });
      this.setData({
        version: data.version,
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

  updateCurrentTime = () => {
    if (this.playTimer) clearTimeout(this.playTimer);
    if (this.status !== 'playing') return;
    if (this.currentTime && this.currentTime >= this.duration) {
      this.player.handleMusicEnd();
      return;
    }
    this.setData({
      currentTime: this.currentTime + 0.1 * this.speed,
    });
    this.playTimer = setTimeout(() => this.updateCurrentTime(), 100);
  };
}

export const store = new Store();
