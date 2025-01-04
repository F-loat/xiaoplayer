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

  primaryColor: string;

  musicName: string;
  musicCover: string;
  musicAlbum: string;
  musicLyric: { time: number; lrc: string }[] = [];
  musicLyricCurrent: { index: number; lrc: string } = { index: 0, lrc: '' };
  musicLyricLoading = false;

  musicUrl?: string;

  duration = 0;
  currentTime = 0;
  playOrder: PlayOrderType;
  playTimer: number | null = null;

  showAppBar = true;
  version: null | string = wx.getStorageSync('serverVersion') || null;

  devices: Device[] = [];

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
    this.musicUrl = musicInfo.url;
    this.primaryColor = musicInfo.color || '#7e7a91';
    this.playOrder = musicInfo.playOrder || PlayOrderType.All;

    reaction(
      () => this.did,
      (val) => wx.setStorageSync('did', val),
    );
    reaction(
      () => this.musicCover,
      () => this.updateColor(),
    );
    reaction(
      () => ({
        name: this.musicName,
        album: this.musicAlbum,
        lyric: this.musicLyric,
        cover: this.musicCover,
        url: this.musicUrl,
        color: this.primaryColor,
        order: this.playOrder,
      }),
      (val) => wx.setStorageSync('musicInfo', val),
      {
        delay: 1000,
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
    return this.favorite.isFavorite(this.musicName);
  }

  get currentDevice() {
    const device = this.devices.find((item) => item.did === this.did);
    return device || { name: '本机' };
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
        devices: Record<string, Device>;
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

      const devices = Object.values(res.data.devices || {}).concat({
        name: '本机',
        did: 'host',
        hardware: '本机',
        cur_music: store.did === 'host' ? store.musicName : undefined,
        cur_playlist: store.did === 'host' ? store.musicAlbum : undefined,
      });

      if (!did) {
        did = devices[0]?.did || 'host';
      }

      if (did !== 'host') {
        const playOrder = res.data.devices?.[did]?.play_type;
        this.setData({ playOrder: playOrder ?? PlayOrderType.All });
      }

      this.setData({ did, devices });

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
    } catch (err) {
      console.error(err);
    }
  };

  getResourceUrl(url?: string) {
    if (!url) return '';
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
