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
export const DEFAULT_COVER = '/assets/icon/changpian.svg';
export const DEFAULT_PRIMARY_COLOR = '#7e7a91';

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
  did: string = wx.getStorageSync('did') || 'host';
  status: 'paused' | 'loading' | 'playing' = 'paused';

  primaryColor: string = DEFAULT_PRIMARY_COLOR;

  musicName?: string;
  musicCover?: string;
  musicAlbum?: string;
  musicLyric: { time: number; lrc: string }[] = [];
  musicLyricCurrent: { index: number; lrc: string } = { index: 0, lrc: '' };
  musicLyricLoading = false;

  musicUrl?: string;

  duration = 0;
  currentTime = 0;
  playOrder: PlayOrderType = PlayOrderType.All;
  playTimer: number | null = null;

  showAppBar = true;
  version: null | string = wx.getStorageSync('serverVersion') || null;

  devices: Device[] = [];

  isPC =
    platform !== 'ohos' &&
    (platform === 'windows' ||
      platform === 'mac' ||
      !wx.getSkylineInfoSync?.().isSupported);
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

    reaction(
      () => this.did,
      (val) => wx.setStorageSync('did', val),
    );
    reaction(
      () => this.musicCover,
      () => this.updateColor(),
    );
    reaction(
      () => this.musicName,
      () => {
        if (this.deviceIndex === -1) return;
        const newDevices = [...this.devices];
        newDevices[this.deviceIndex].cur_music = this.musicName;
        this.devices = newDevices;
      },
    );
  }

  get isM3U8() {
    return this.musicUrl?.split('?')[0].endsWith('m3u8');
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
    return this.musicName && this.favorite.isFavorite(this.musicName);
  }

  get deviceIndex() {
    return this.devices.findIndex((item) => item.did === this.did);
  }

  get currentDevice() {
    return this.devices[this.deviceIndex] || { name: '本机', cur_music: '' };
  }

  setData = (values: any) => {
    Object.assign(this, values);
  };

  updateServerConfig = async (config: ServerConfig) => {
    this.serverConfig = config;
    wx.setStorageSync('serverConfig', config);
    await store.initServer();
  };

  async updateColor() {
    const image = this.musicCover;
    const cachedColor = image && this.colorsMap.get(image);
    if (cachedColor || !image) {
      this.primaryColor = cachedColor || DEFAULT_PRIMARY_COLOR;
      return;
    }
    const color = await getImageColor(image);
    this.colorsMap.set(image, color);
    this.primaryColor = color;
  }

  initServer = async () => {
    try {
      const res = await request<{
        detail?: string;
        devices: Record<string, Device>;
      }>({
        url: '/getsetting',
      });
      console.info('@@@ settings', res.data);

      if (res.statusCode !== 200) {
        if (res.statusCode === 401) {
          throw new Error('Request failed with status code 401');
        }
        return;
      }

      const cachedHost = wx.getStorageSync('hostMusicInfo') || {};
      const host: Device = {
        name: '本机',
        did: 'host',
        hardware: '本机',
        cur_music: this.did === 'host' ? store.musicName : cachedHost.name,
        cur_playlist: this.did === 'host' ? store.musicAlbum : cachedHost.album,
      };
      const devices = [host].concat(Object.values(res.data.devices || {}));

      if (this.did !== 'host') {
        const playOrder = res.data.devices?.[this.did]?.play_type;
        this.setData({ playOrder: playOrder ?? PlayOrderType.All });
      }

      this.setData({ devices });

      if (devices.length <= 1 && !wx.getStorageSync('disableDeviceTip')) {
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
    } catch (err: any) {
      if (err.message.includes(401)) {
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
      console.error(err);
    }
  };

  getResourceUrl(url?: string) {
    if (!url) return '';
    const { domain, publicDomain = '', privateDomain } = this.serverConfig;
    const protocol = publicDomain.match(/(.*):\/\//)?.[1] || 'http';
    return domain === publicDomain && privateDomain
      ? `${protocol}://${removeProtocol(url).replace(
          removeProtocol(privateDomain),
          removeProtocol(publicDomain),
        )}`
      : url;
  }

  sendCommand = (cmd: String, did: string | null = this.did) => {
    if (did === 'host') return;
    return request({
      url: '/cmd',
      method: 'POST',
      data: {
        cmd,
        did,
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
