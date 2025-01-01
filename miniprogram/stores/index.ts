import { reaction, makeAutoObservable } from 'mobx-miniprogram';
import { getImageColor, removeProtocol, request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';
import { HostPlayerModule } from './modules/host';
import { XiaomusicPlayerModule } from './modules/xiaomusic';
import { FavoriteModule } from './modules/favorite';
import { LyricModule } from './modules/lyric';
import { FeatureModule } from './modules/feature';
import { PlaylistModule } from './modules/playlist';
import { InfoModule } from './modules/info';

const { platform } = wx.getDeviceInfo();

export const SLOGAN = '无限听歌，解放小爱音箱';
export const SHARE_COVER =
  'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/cover.png';
export const DEFAULT_COVER =
  'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/default_cover.webp';

export interface MusicPlayer {
  speed: number;
  volume: number;
  setSpeed: (speed: number) => void;
  setStopAt: (minute: number) => void;
  setVolume: (volume: number) => Promise<any> | void;
  getMusic: () => { url?: string };
  playMusic: (name?: string, album?: string) => Promise<void>;
  pauseMusic(): Promise<void>;
  syncMusic: () => Promise<void>;
  seekMusic: (time: number) => Promise<void>;
  playPrevMusic(): Promise<void>;
  playNextMusic(): Promise<void>;
  handleMusicEnd(): Promise<void>;
}

export class Store {
  did: null | string = wx.getStorageSync('did');
  status: 'paused' | 'loading' | 'playing' = 'paused';
  primaryColor = '#7e7a91';

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
  version: null | string = wx.getStorageSync('serverVersion') || null;
  devices: Record<string, Device> = {};
  isPC =
    platform === 'windows' ||
    platform === 'mac' ||
    !wx.getSkylineInfoSync?.().isSupported;
  serverConfig: ServerConfig = wx.getStorageSync('serverConfig') || {};

  info: InfoModule;
  lyric: LyricModule;
  feature: FeatureModule;
  favorite: FavoriteModule;
  playlist: PlaylistModule;
  hostPlayer: HostPlayerModule;
  xiaomusicPlayer: XiaomusicPlayerModule;

  colorsMap = new Map<string, string>();

  constructor() {
    makeAutoObservable(this);

    this.info = new InfoModule(this);
    this.lyric = new LyricModule(this);
    this.feature = new FeatureModule(this);
    this.favorite = new FavoriteModule(this);
    this.playlist = new PlaylistModule(this);
    this.hostPlayer = new HostPlayerModule(this);
    this.xiaomusicPlayer = new XiaomusicPlayerModule(this);

    const musicInfo = wx.getStorageSync('musicInfo') || {};

    this.musicName = musicInfo.name || '';
    this.musicAlbum = musicInfo.album || '';
    this.musicLyric = musicInfo.lyric || [];
    this.musicCover = musicInfo.cover;

    reaction(
      () => this.did,
      (val) => wx.setStorageSync('did', val),
    );
    reaction(
      () => this.musicCover,
      () => this.updateColor(),
      {
        fireImmediately: true,
      },
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
    return this.did === 'host' ? this.hostPlayer : this.xiaomusicPlayer;
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

  async updateColor() {
    const image = this.musicCover;
    const cachedColor = this.colorsMap.get(image);
    if (cachedColor) {
      this.primaryColor = cachedColor;
      return;
    }
    const color = image ? await getImageColor(image) : '#7e7a91';
    this.colorsMap.set(image, color);
    this.primaryColor = color;
  }

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
        did = Object.keys(devices)[0] || 'host';
      }

      this.setData({
        did,
        devices,
        playOrder: devices[did]?.play_type ?? PlayOrderType.All,
      });

      if (
        !Object.keys(devices).length &&
        !wx.getStorageSync('disableDeviceTip')
      ) {
        wx.showModal({
          title: '无可用设备',
          content: '未发现可用设备，仅可使用本机播放',
          cancelText: '不再提醒',
          confirmText: '前往配置',
          success(res) {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/setting/more',
              });
            } else if (res.cancel) {
              wx.setStorageSync('disableDeviceTip', true);
            }
          },
        });
      }

      const { data } = await request<{
        version: string;
      }>({
        url: '/getversion',
      });

      if (!data.version) {
        return;
      }

      this.setData({
        version: data.version,
      });
      wx.setStorageSync('serverVersion', data.version);
    } catch (err) {
      console.error(err);
    }
  };

  getResourceUrl(url: string = '') {
    const {
      domain,
      publicDomain = '',
      privateDomain: _privateDomain,
    } = this.serverConfig;
    const protocol = publicDomain.match(/(.*):\/\//)?.[1] || 'http';
    const privateDomain =
      _privateDomain || url.match(/^https?:\/\/(.*?)\//)?.[1] || '';
    return domain === publicDomain &&
      url.includes(removeProtocol(privateDomain))
      ? `${protocol}://${removeProtocol(url).replace(
          removeProtocol(privateDomain),
          removeProtocol(publicDomain),
        )}`
      : url;
  }

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
    if (this.duration && this.currentTime >= this.duration) {
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
