import { makeAutoObservable } from 'mobx-miniprogram';
import { Store } from '..';

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
      this.store.sendCommand('取消收藏');
    } else {
      this.musics.set(name, true);
      this.store.sendCommand('加入收藏');
    }
  }
}
