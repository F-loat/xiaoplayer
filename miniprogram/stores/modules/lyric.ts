import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { Store } from '..';
import { getCloudInstance, request } from '@/miniprogram/utils';

export interface Lyric {
  time: number;
  lrc: string;
}

export interface Tag {
  name?: string;
  artist?: string;
  album?: string;
  album_img?: string;
  year?: string;
  lyric: string;
}

export const parseLrc = (lrc: string = ''): Lyric[] => {
  try {
    return lrc
      .split('\n')
      .map((line) => {
        const trimmedLine = line.trim();
        const timeMatch = trimmedLine.match(/\[\d{2}:\d{2}(\.\d+)?\](.*)/);
        if (!timeMatch) return null;
        const timeStr = timeMatch[0].match(/\[(\d{2}):(\d{2})(\.\d+)?\]/);
        if (!timeStr) return null;
        let timeMs =
          parseInt(timeStr[1], 10) * 60000 + parseInt(timeStr[2], 10) * 1000;
        if (timeStr[3]) {
          timeMs += parseFloat(timeStr[3]) * 1000;
        }
        const lrcText = timeMatch[2]?.trim();
        return { time: timeMs, lrc: lrcText } as Lyric;
      })
      .filter((item): item is Lyric => !!item?.lrc);
  } catch {
    return [];
  }
};

export class LyricModule {
  store: Store;

  ready = false;
  offset = 0;

  mode: 'base' | 'advance' = wx.getStorageSync('lyricMode') || 'base';

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => this.store.musicLyric,
      () => {
        this.ready = false;
        this.setOffset(0);
        setTimeout(() => this.syncLyric(), 1000);
      },
    );
    reaction(
      () => this.store.currentTime,
      (val) => {
        if (!this.ready) return;
        if (val < 1) {
          this.syncLyric();
          return;
        }
        const currentTime = (val + this.offset) * 1000;
        const { index: currentIndex } = this.store.musicLyricCurrent;
        const nextIndex = currentIndex + 1;
        const nextLyric = this.store.musicLyric[nextIndex];
        const { time: nextTime, lrc } = nextLyric || {};
        if (nextTime && nextTime < currentTime) {
          this.store.setData({
            musicLyricCurrent: {
              lrc,
              index: nextIndex,
            },
          });
        }
      },
    );
  }

  get linePercent() {
    if (this.store.status !== 'playing' || this.mode === 'base') {
      return 1;
    }
    const { musicLyric, currentTime } = this.store;
    const { index } = this.store.musicLyricCurrent;
    const a = musicLyric[index]?.time;
    const b = musicLyric[index + 1]?.time;
    const time = currentTime + this.offset;
    return b ? (time * 1000 - a) / (b - a) : 0;
  }

  setMode(mode: 'base' | 'advance') {
    this.mode = mode;
    wx.setStorageSync('lyricMode', mode);
  }

  syncLyric(currentTime = this.store.currentTime) {
    const time = currentTime + this.offset;
    const index = this.findCurrentIndex(time);
    const preIndex = Math.max(0, index - 1);
    this.store.setData({
      musicLyricCurrent: {
        index: preIndex,
        lrc: this.store.musicLyric[preIndex]?.lrc,
      },
    });
    this.ready = true;
  }

  setOffset(val: number) {
    this.offset = val;
    this.syncLyric();
  }

  findCurrentIndex = (time: number) => {
    let index = 0;
    const list = this.store.musicLyric;
    while (list[index] && list[index].time < time * 1000) {
      index += 1;
    }
    return Math.min(index, list.length - 1);
  };

  fetchMusicTag = async (
    name: string = this.store.musicName.replace(/^\d+\.\s?/g, ''),
    album: string = this.store.musicAlbum?.replace(/（.*）/g, '') || '',
    artist = '',
    force?: boolean,
  ) => {
    this.store.setData({ musicLyricLoading: true });

    const originMusicName = this.store.musicName;
    const cackeKey = `musicInfo:${originMusicName}`;
    const cachedInfo = wx.getStorageSync(cackeKey) || {};

    let musicName = name.trim();
    let musicAlbum = album.trim();
    let musicArtist = artist.trim();

    if (!force && cachedInfo.lyric?.length) {
      this.store.setData({
        musicLyric: cachedInfo.lyric,
        musicCover: cachedInfo.cover,
        musicLyricLoading: false,
      });
      return;
    }

    let tags: {
      album?: string;
      artist?: string;
      genre?: string;
      lyrics?: string;
      picture?: string;
      title?: string;
      year?: string;
    } = {};

    if (!force && this.store.feature.musicTags) {
      const res = await request<{
        tags: typeof tags;
      }>({
        url: `/musicinfo?name=${name}&musictag=true`,
      });
      if (originMusicName !== this.store.musicName) {
        return;
      }
      tags = {
        ...res.data.tags,
        picture: this.store.getResourceUrl(res.data.tags.picture),
      };
      if (tags.title) musicName = tags.title;
      if (tags.album) musicAlbum = tags.album;
      if (tags.artist) musicArtist = tags.artist;
      if (tags.picture) {
        this.store.setData({
          musicCover: tags.picture,
        });
      }
      if (tags.lyrics) {
        this.store.setData({
          musicLyric: parseLrc(tags.lyrics),
          musicLyricLoading: false,
        });
      }
      if (tags.picture && tags.lyrics) {
        return;
      }
    }

    if (force) wx.showLoading({ title: '请求中' });

    const cloud = await getCloudInstance();

    await new Promise((resolve) =>
      cloud.callFunction({
        name: 'musictag',
        data: {
          title: musicName,
          album: musicAlbum,
          artist: musicArtist,
        },
        success: (res) => {
          const result = res.result as Tag;

          if (!result || originMusicName !== this.store.musicName) {
            return;
          }

          this.applyScrapedMusicTag(
            {
              ...result,
              name: result.name || musicName,
              artist: result.artist || musicArtist,
              album: result.album || musicAlbum,
              album_img:
                tags.picture || result.album_img?.replace('http:', 'https:'),
              lyric: result.lyric,
            },
            !tags.picture,
          );
        },
        complete: () => {
          this.store.setData({
            musicLyricLoading: false,
          });
          wx.hideLoading();
          resolve(null);
        },
      }),
    );
  };

  applyScrapedMusicTag(tag: Tag, remote: boolean = true) {
    const cackeKey = `musicInfo:${this.store.musicName}`;
    const cachedInfo = wx.getStorageSync(cackeKey) || {};
    const musicLyric = this.store.isM3U8 ? [] : parseLrc(tag.lyric);

    this.store.setData({
      musicLyric,
      musicCover: tag.album_img,
    });
    this.store.info.setInfo(this.store.musicName, {
      cover: tag.album_img,
      album: tag.album,
    });
    wx.setStorage({
      key: cackeKey,
      data: {
        ...cachedInfo,
        name: tag.name,
        lyric: musicLyric,
        cover: tag.album_img,
        album: tag.album,
        artist: tag.artist,
      },
    });

    if (!remote || !tag.album_img || !this.store.feature.musicScrape) {
      return;
    }

    wx.request({
      url: tag.album_img,
      responseType: 'arraybuffer',
      success: async (res) => {
        request({
          url: '/setmusictag',
          method: 'POST',
          data: {
            musicname: this.store.musicName,
            title: tag.name,
            artist: tag.artist,
            album: tag.album,
            year: tag.year,
            lyrics: tag.lyric,
            picture: wx.arrayBufferToBase64(res.data as ArrayBuffer),
          },
        });
      },
    });
  }
}
