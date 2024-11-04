import { reaction, action, makeAutoObservable } from 'mobx-miniprogram';
import { getCloudInstance, parseLrc, request } from '../utils';
import { Device, PlayOrderType, ServerConfig } from '../types';
import { HostPlayerModule } from './modules/host';
import { XiaomusicPlayerModule } from './modules/xiaomusic';
import { FavoriteModule } from './modules/favorite';

const { platform } = wx.getDeviceInfo();

const DEFAULT_COVER =
  'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fb-ssl.duitang.com%2Fuploads%2Fitem%2F201812%2F12%2F20181212223741_etgxt.jpg&refer=http%3A%2F%2Fb-ssl.duitang.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1705583419&t=8b8402f169f865f34c2f16649b0ba6d8';

export interface MusicPlayer {
  speed: number;
  volume: number;
  setSpeed: (speed: number) => void;
  setStopAt: (minute: number) => void;
  setVolume: (volume: number) => Promise<any> | void;
  playMusic: (name?: string, album?: string) => Promise<void>;
  pauseMusic(): Promise<void>;
  playPrevMusic(): Promise<void>;
  playNextMusic(): Promise<void>;
  handleMusicEnd(): Promise<void>;
}

export class Store {
  did: null | string = wx.getStorageSync('did');
  status: 'paused' | 'playing' = 'paused';

  musicName: string;
  musicCover: string;
  musicAlbum: string;
  musicLyric: { time: number; lrc: string }[] = [];
  musicLyricCurrent: { index: number; lrc: string } = { index: 0, lrc: '' };
  musicLyricLoading = false;

  musicM3U8Url?: string;

  duration = 0;
  currentTime = 0;

  devices: Record<string, Device> = {};
  playOrder: PlayOrderType = PlayOrderType.All;

  serverConfig: ServerConfig = wx.getStorageSync('serverConfig') || {};

  version: null | string = null;
  isPC = platform === 'windows' || platform === 'mac';
  showAppBar = true;

  favorite: FavoriteModule;
  hostPlayer: MusicPlayer;
  xiaomusicPlayer: MusicPlayer;

  playTimer: number | null = null;

  constructor() {
    makeAutoObservable(this);

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
          this.fetchMusicTag(name, this.musicAlbum);
        } else {
          this.setData({ musicCover: DEFAULT_COVER });
        }
      },
    );

    reaction(
      () => this.musicLyric,
      (val) => {
        this.setData({
          musicLyricCurrent: {
            index: 0,
            lrc: val[0]?.lrc,
          },
        });
      },
    );
    reaction(
      () => this.currentTime,
      (val) => {
        const { index: currentIndex } = this.musicLyricCurrent;
        const currentTime = val * 1000;
        const nextIndex = currentIndex + 1;
        const nextLyric = this.musicLyric[nextIndex];
        const { time: nextTime, lrc } = nextLyric || {};
        if (nextTime && nextTime < currentTime) {
          this.setData({
            musicLyricCurrent: {
              lrc,
              index: nextIndex,
            },
          });
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

  private fetchMusicTag = async (name: string, album: string = '') => {
    this.musicLyricLoading = true;

    let musicName = name.replace(/^\d+\.\s?/g, '').trim();
    let musicAlbum = album.replace(/（.*）/g, '').trim();
    let musicArtist;

    if (this.version) {
      const [a, b, c] = this.version.split('.').map(Number);
      if (a > 0 || b > 3 || (b > 2 && c > 37)) {
        const res = await request<{
          tags: {
            album?: string;
            artist?: string;
            genre?: string;
            lyrics?: string;
            picture?: string;
            title?: string;
            year?: string;
          };
        }>({
          url: `/musicinfo?name=${name}&musictag=true`,
        });
        const { tags } = res.data;
        if (tags.title) musicName = tags.title;
        if (tags.album) musicAlbum = tags.album;
        if (tags.artist) musicArtist = tags.artist;
        if (tags.picture && tags.lyrics) {
          this.setData({
            musicLyric: parseLrc(tags.lyrics),
            musicCover: tags.picture,
          });
          this.musicLyricLoading = false;
          return;
        }
      }
    }

    const cloud = await getCloudInstance();
    cloud.callFunction({
      name: 'musictag',
      data: {
        title: musicName,
        album: musicAlbum,
        artist: musicArtist,
      },
      success: (res) => {
        const result = res.result as {
          lyric: string;
          album_img?: string;
        };
        if (!result) return;
        const musicLyric = this.musicM3U8Url ? [] : parseLrc(result.lyric);
        const musicCover = result.album_img || DEFAULT_COVER;
        this.setData({
          musicLyric,
          musicCover,
        });
      },
      complete: action(() => {
        this.musicLyricLoading = false;
      }),
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
