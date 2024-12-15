import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { compareVersions } from 'compare-versions';
import { DEFAULT_COVER, Store } from '..';
import { getCloudInstance, request } from '@/miniprogram/utils';

interface Lyric {
  time: number;
  lrc: string;
}

const parseLrc = (lrcContent: string): Lyric[] => {
  try {
    return lrcContent
      .split('\n')
      .map((line) => {
        const trimmedLine = line.trim();
        const timeMatch = trimmedLine.match(/\[\d{2}:\d{2}(\.\d{2})?\](.*)/);
        if (!timeMatch) return null;
        const timeStr = timeMatch[0].match(/\[(\d{2}):(\d{2})(\.\d{2})?\]/);
        if (!timeStr) return null;
        let timeMs =
          parseInt(timeStr[1], 10) * 60000 + parseInt(timeStr[2], 10) * 1000;
        if (timeStr[3]) {
          timeMs += parseFloat(timeStr[3]) * 1000;
        }
        const lrcText = timeMatch[2].trim();
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

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => this.store.musicLyric,
      (val) => {
        this.setOffset(0);
        setTimeout(() => {
          const index = this.findCurrentIndex(this.store.currentTime);
          const preIndex = Math.max(0, index - 1);
          this.store.setData({
            musicLyricCurrent: {
              index: preIndex,
              lrc: val[preIndex]?.lrc,
            },
          });
          this.ready = true;
        }, 1000);
      },
    );
    reaction(
      () => this.store.currentTime,
      (val) => {
        if (!this.ready) return;
        const { index: currentIndex } = this.store.musicLyricCurrent;
        const currentTime = val * 1000 + this.offset;
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

  setOffset(val: number) {
    this.offset = val;
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
    name: string,
    album: string = '',
    artist = '',
    force?: boolean,
  ) => {
    this.store.setData({ musicLyricLoading: true });

    let musicName = name.trim();
    let musicAlbum = album.trim();
    let musicArtist = artist.trim();

    const originMusicName = this.store.musicName;
    const cackeKey = `musicInfo:${originMusicName}`;
    const cachedInfo = wx.getStorageSync(cackeKey);

    if (!force && cachedInfo && cachedInfo.lyric) {
      this.store.setData({
        musicLyric: cachedInfo.lyric,
        musicCover: cachedInfo.cover,
        musicLyricLoading: false,
      });
      return;
    }

    if (!force && compareVersions(this.store.version!, '0.3.37') >= 0) {
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
      if (originMusicName !== this.store.musicName) {
        return;
      }
      const { tags } = res.data;
      if (tags.title) musicName = tags.title;
      if (tags.album) musicAlbum = tags.album;
      if (tags.artist) musicArtist = tags.artist;
      if (tags.picture && tags.lyrics) {
        this.store.setData({
          musicLyric: parseLrc(tags.lyrics),
          musicCover: tags.picture,
          musicLyricLoading: false,
        });
        return;
      }
    }

    const cloud = await getCloudInstance();

    if (force) wx.showLoading({ title: '请求中' });

    cloud.callFunction({
      name: 'musictag',
      data: {
        title: musicName,
        album: musicAlbum,
        artist: musicArtist,
      },
      success: (res) => {
        if (originMusicName !== this.store.musicName) {
          return;
        }
        const result = res.result as {
          lyric: string;
          name?: string;
          artist?: string;
          album?: string;
          album_img?: string;
          year?: string;
        };
        if (!result) return;
        const musicLyric = this.store.musicM3U8Url
          ? []
          : parseLrc(result.lyric);
        const musicCover = result.album_img || DEFAULT_COVER;
        this.store.setData({
          musicLyric,
          musicCover,
        });
        wx.setStorage({
          key: cackeKey,
          data: {
            name: musicName,
            lyric: musicLyric,
            cover: musicCover,
            album: musicAlbum,
          },
        });

        if (compareVersions(this.store.version!, '0.3.56') < 0) {
          return;
        }

        wx.request({
          url: musicCover.replace('http:', 'https:'),
          responseType: 'arraybuffer',
          success: (res) => {
            request({
              url: '/setmusictag',
              method: 'POST',
              data: {
                musicname: originMusicName,
                title: result.name || musicName,
                artist: result.artist || musicArtist,
                album: result.album || musicAlbum,
                year: result.year,
                lyrics: result.lyric,
                picture: wx.arrayBufferToBase64(res.data as ArrayBuffer),
              },
            });
          },
        });
      },
      complete: () => {
        this.store.setData({
          musicLyricLoading: false,
        });
        wx.hideLoading();
      },
    });
  };
}
