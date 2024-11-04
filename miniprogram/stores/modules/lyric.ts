import { makeAutoObservable, reaction } from 'mobx-miniprogram';
import { DEFAULT_COVER, Store } from '..';
import { getCloudInstance, request } from '@/miniprogram/utils';

interface Lyric {
  time: number;
  lrc: string;
}

export class LyricModule {
  store: Store;

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);

    reaction(
      () => this.store.musicLyric,
      (val) => {
        this.store.setData({
          musicLyricCurrent: {
            index: 0,
            lrc: val[0]?.lrc,
          },
        });
      },
    );
    reaction(
      () => this.store.currentTime,
      (val) => {
        const { index: currentIndex } = this.store.musicLyricCurrent;
        const currentTime = val * 1000;
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

  fetchMusicTag = async (name: string, album: string = '') => {
    this.store.setData({ musicLyricLoading: true });

    let musicName = name.replace(/^\d+\.\s?/g, '').trim();
    let musicAlbum = album.replace(/（.*）/g, '').trim();
    let musicArtist;

    if (this.store.version) {
      const [a, b, c] = this.store.version.split('.').map(Number);
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
          this.store.setData({
            musicLyric: parseLrc(tags.lyrics),
            musicCover: tags.picture,
            musicLyricLoading: false,
          });
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
        const musicLyric = this.store.musicM3U8Url
          ? []
          : parseLrc(result.lyric);
        const musicCover = result.album_img || DEFAULT_COVER;
        this.store.setData({
          musicLyric,
          musicCover,
        });
      },
      complete: () => {
        this.store.setData({
          musicLyricLoading: false,
        });
      },
    });
  };
}

const parseLrc = (lrcContent: string): Lyric[] => {
  try {
    return lrcContent
      .split('\n')
      .map((line) => {
        const trimmedLine = line.trim();
        const timeMatch = trimmedLine.match(/\[\d{2}:\d{2}(\.\d{2})?\](.*)/);
        if (timeMatch) {
          const timeStr = timeMatch[0].match(/\[(\d{2}):(\d{2})(\.\d{2})?\]/);
          if (timeStr) {
            let timeMs =
              parseInt(timeStr[1], 10) * 60000 +
              parseInt(timeStr[2], 10) * 1000;
            if (timeStr[3]) {
              timeMs += parseFloat(timeStr[3]) * 1000;
            }
            const lrcText = timeMatch[2].trim();
            return { time: timeMs, lrc: lrcText } as Lyric;
          }
        }
        return null;
      })
      .filter((item): item is Lyric => !!item?.lrc);
  } catch {
    return [];
  }
};
