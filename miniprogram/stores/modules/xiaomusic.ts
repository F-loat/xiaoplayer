import { makeAutoObservable, reaction, runInAction } from 'mobx-miniprogram';
import { MusicPlayer, Store } from '..';
import { request, sleep } from '@/miniprogram/utils';

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
      () => ({
        did: this.store.did,
        version: this.store.version,
      }),
      ({ did }) => {
        if (this.syncTimer) clearInterval(this.syncTimer);
        if (did === 'host') return;
        this.syncMusic();
        this.syncVolume();
        this.syncTimer = setInterval(() => {
          this.syncMusic();
        }, 10 * 1000);
      },
      {
        fireImmediately: true,
      },
    );
  }

  getMusic() {
    return {};
  }

  playMusic = async (name?: string, album?: string) => {
    if (name) {
      const list = album ?? this.store.musicAlbum;
      if (list) {
        await this.store.sendCommand(`播放列表${list}|${name}`);
      } else {
        await this.store.sendCommand(`播放歌曲${name}|`);
      }
    } else {
      await this.store.sendCommand('播放歌曲');
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
    });
    await this.store.sendCommand('上一首');
    await sleep(1000);
    await this.syncMusic();
  };

  playNextMusic = async () => {
    this.store.setData({
      status: 'loading',
      currentTime: 0,
    });
    await this.store.sendCommand('下一首');
    await sleep(1000);
    await this.syncMusic();
  };

  pauseMusic = async () => {
    await this.store.sendCommand('关机');
    this.syncMusic();
  };

  seekMusic = async () => {};

  private syncMusic = async () => {
    if (this.store.did === 'host') return;
    if (this.deboTimer) clearTimeout(this.deboTimer);
    this.deboTimer = setTimeout(async () => {
      const res = await request<{
        cur_music: string;
        cur_playlist?: string;
        is_playing: boolean;
        offset: number;
        duration: number;
      }>({
        url: `/playingmusic?did=${this.store.did}`,
      });
      const { cur_music, cur_playlist, is_playing, offset, duration } =
        res.data;
      if (this.store.did === 'host') return;
      this.store.setData({
        musicName: cur_music,
        musicAlbum: cur_playlist,
        status: is_playing ? 'playing' : 'paused',
        currentTime: offset > 0 && offset < duration ? offset : 0,
        duration: duration > 0 ? duration : 0,
      });
      this.store.updateCurrentTime();
    }, 100);
  };

  private syncVolume = async () => {
    const res = await request<{
      volume: number;
    }>({
      url: `/getvolume?did=${this.store.did}`,
    });
    runInAction(() => {
      this.volume = res.data.volume;
    });
  };

  setVolume = (volume: number) => {
    return request({
      url: '/setvolume',
      method: 'POST',
      data: {
        volume,
        did: this.store.did,
      },
    });
  };

  setSpeed() {}

  setStopAt(minute: number) {
    this.store.sendCommand(`${minute}分钟后关机`);
  }
}
