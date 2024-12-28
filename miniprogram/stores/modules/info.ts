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

    infos.forEach((info) => {
      const cover = this.store.getResourceUrl(info.tags.picture);
      this.coverMap.set(info.name, cover);
      this.albumMap.set(info.name, info.tags.album);
    });
  };
}
