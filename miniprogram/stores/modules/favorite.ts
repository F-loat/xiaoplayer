import { makeAutoObservable } from 'mobx-miniprogram';
import { Store } from '..';
import { getGlobalData } from '@/miniprogram/utils';

export class FavoriteModule {
  store: Store;
  musics: Map<string, boolean> = new Map();

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);
  }

  setMusics(names: string[] = []) {
    this.musics = new Map(names.map((name) => [name, true]));
  }

  isFavorite(name: string) {
    return this.musics.get(name);
  }

  toggleFavorite(name: string) {
    if (this.isFavorite(name)) {
      this.musics.set(name, false);
      if (this.store.feature.playlist) {
        this.store.playlist.removeMusic('收藏', name);
      } else {
        this.store.sendCommand('取消收藏');
      }
      const musiclist = getGlobalData('musiclist');
      const index = musiclist['收藏']?.indexOf(name);
      musiclist['收藏']?.splice(index, 1);
      this.store.playlist.updatePlaylistCount('收藏', -1);
    } else {
      this.musics.set(name, true);
      if (this.store.feature.playlist) {
        this.store.playlist.addMusic('收藏', name);
      } else {
        this.store.sendCommand('加入收藏');
      }
      const musiclist = getGlobalData('musiclist');
      musiclist['收藏']?.push(name);
      this.store.playlist.updatePlaylistCount('收藏', 1);
    }
  }
}
