import { makeAutoObservable, reaction, runInAction } from 'mobx-miniprogram';
import { DEFAULT_PRIMARY_COLOR, MusicPlayer, Store } from '..';
import { sleep } from '@/miniprogram/utils';

export class XiaomusicPlayerModule implements MusicPlayer {
  store: Store;
  speed = 1;
  volume = 20;
  syncTimer: number | null = null;
  deboTimer: number | null = null;

  constructor(store: Store) {
    makeAutoObservable(this);

    this.store = store;

    reaction(
      () => store.musicName,
      (name) => {
        if (store.did === 'host') return;
        if (store.playTimer) clearTimeout(store.playTimer);
        if (name) {
          store.lyric.fetchMusicTag();
        } else {
          store.setData({ musicCover: null });
        }
      },
    );
    reaction(
      () => ({
        did: this.store.did,
        version: this.store.version,
      }),
      ({ did }) => {
        if (this.syncTimer) clearInterval(this.syncTimer);
        if (did === 'host') return;
        this.syncMusic();
        this.syncVolume();
        this.syncTimer = setInterval(() => this.syncMusic(), 10 * 1000);
      },
      {
        fireImmediately: true,
      },
    );
    reaction(
      () => ({
        name: this.store.musicName,
        album: this.store.musicAlbum,
        cover: this.store.musicCover,
        color: this.store.primaryColor,
        lyric: this.store.musicLyric,
      }),
      (val) => {
        if (this.store.did === 'host') return;
        wx.setStorageSync('xiaoMusicInfo', val);
      },
      {
        delay: 300,
      },
    );
  }

  getMusic() {
    return {};
  }

  playMusic = async (name?: string, album?: string, src?: string) => {
    const { did, backend, feature } = this.store;
    if (src) {
      await backend.playUrl(did, src);
    } else {
      const list = album ?? this.store.musicAlbum;
      if (list) {
        if (feature.playApi) {
          await backend.playMusic(did, name, list);
        } else {
          await this.store.sendCommand(`播放列表${list}|${name}`);
        }
      } else {
        if (feature.playApi) {
          await backend.playMusic(did, name);
        } else {
          const cmd = `播放歌曲${name ? `|${name}` : ''}`;
          await this.store.sendCommand(cmd);
        }
      }
    }
    if (album) this.store.setData({ musicAlbum: album });
    this.syncMusic();
  };

  handleMusicEnd = async () => {
    await this.syncMusic();
  };

  playPrevMusic = async () => {
    this.store.setData({
      status: 'loading',
      currentTime: 0,
      musicLyric: [],
      musicLyricLoading: true,
    });
    await this.store.sendCommand('上一首');
    await sleep(1000);
    this.syncMusic();
  };

  playNextMusic = async () => {
    this.store.setData({
      status: 'loading',
      currentTime: 0,
      musicLyric: [],
      musicLyricLoading: true,
    });
    await this.store.sendCommand('下一首');
    await sleep(1000);
    this.syncMusic();
  };

  pauseMusic = async () => {
    await this.store.sendCommand('关机');
    this.syncMusic();
  };

  seekMusic = async () => {};

  syncMusic = async () => {
    if (!this.store.musicName) {
      const musicInfo = wx.getStorageSync('xiaoMusicInfo') || {};
      this.store.setData({
        musicName: musicInfo.name || '',
        musicAlbum: musicInfo.album || '',
        musicCover: musicInfo.cover,
        primaryColor: musicInfo.color || DEFAULT_PRIMARY_COLOR,
        musicLyric: musicInfo.lyric || [],
      });
    }
    if (this.deboTimer) clearTimeout(this.deboTimer);
    this.deboTimer = setTimeout(async () => {
      const { musicName, playlist, isPlaying, offset, duration } =
        await this.store.backend.getPlayingStatus(this.store.did);
      if (this.store.did === 'host') {
        return;
      }
      if (duration === this.store.duration) {
        this.store.setData({
          status: isPlaying ? 'playing' : 'paused',
        });
        return;
      }
      this.store.setData(
        isPlaying
          ? {
              musicName,
              musicAlbum: playlist,
              status: 'playing',
              currentTime: offset > 0 && offset < duration ? offset : 0,
              duration: duration > 0 ? duration : 0,
            }
          : {
              musicName,
              musicAlbum: playlist,
              status: 'paused',
            },
      );
      this.store.updateCurrentTime();
    }, 100);
  };

  private syncVolume = async () => {
    const volume = await this.store.backend.getVolume(this.store.did);
    runInAction(() => {
      this.volume = volume;
    });
  };

  setVolume = (volume: number) => {
    this.volume = volume;
    return this.store.backend.setVolume(this.store.did, volume);
  };

  setSpeed() {}

  setStopAt(minute: number) {
    this.store.sendCommand(`${minute}分钟后关机`);
  }
}
