import { makeAutoObservable } from 'mobx-miniprogram';
import { Store } from '..';
import { request } from '@/miniprogram/utils';

export class InfoModule {
  store: Store;

  private coverMap = new Map<string, string>();
  private albumMap = new Map<string, string>();

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);
  }

  setInfo = (
    name?: string,
    info?: {
      cover?: string;
      album?: string;
    },
  ) => {
    if (!name || !info) return;
    if (info.cover) this.coverMap.set(name, info.cover);
    if (info.album) this.albumMap.set(name, info.album);

    const pages = getCurrentPages();
    const { musicAlbum } = this.store;

    const listPage = pages.find((page) => page.route === 'pages/list/index');
    if (listPage && listPage.data.name === musicAlbum) {
      const itemIndex = listPage.data.list.findIndex(
        (item: { name: string }) => item.name === name,
      );
      if (itemIndex === -1) return;
      listPage.setData({
        [`list[${itemIndex}].cover`]: info.cover,
        [`list[${itemIndex}].album`]: info.album,
      });
    }

    const homePage = pages.find((page) => page.route === 'pages/index/index');
    if (homePage) {
      const itemIndex = homePage.data.list.findIndex(
        (item: { name: string; music?: string; cover?: string }) => {
          return item.name === musicAlbum && item.music === name;
        },
      );
      if (itemIndex === -1) return;
      homePage.setData({
        [`list[${itemIndex}].cover`]: info.cover,
      });
    }
  };

  getCover = (name?: string) => name && this.coverMap.get(name);
  getAlbum = (name?: string) => name && this.albumMap.get(name);

  fetchInfos = async (names: string[]) => {
    if (!this.store.feature.musicInfos) {
      return;
    }

    const params = names
      .filter((name) => !this.coverMap.has(name))
      .reduce((result, name) => `${result}name=${name}&`, '');

    if (!params) return;

    const { data: infos } = await request<
      {
        name: string;
        tags: {
          album: string;
          picture: string;
        };
      }[]
    >({
      url: `/musicinfos?${params}musictag=true`,
    });

    if (!Array.isArray(infos)) return;

    infos.forEach((info) => {
      const cover = this.store.getResourceUrl(info.tags?.picture);
      this.coverMap.set(info.name, cover);
      this.albumMap.set(info.name, info.tags?.album);
    });
  };
}
