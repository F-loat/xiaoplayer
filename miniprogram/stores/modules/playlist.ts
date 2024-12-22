import { makeAutoObservable } from 'mobx-miniprogram';
import { Store } from '..';
import { getGlobalData, request } from '@/miniprogram/utils';

interface Item {
  name: string;
  count: number;
  icon?: string;
  music?: string;
}

const defaultLists = ['最近新增', '收藏', '所有歌曲'];

export class PlaylistModule {
  store: Store;

  playlists: Item[] = [];

  constructor(store: Store) {
    this.store = store;
    makeAutoObservable(this);
  }

  get customPlaylists() {
    return this.playlists.filter((item) => !defaultLists.includes(item.name));
  }

  setPlaylists = (lists: Item[]) => {
    this.playlists = lists.sort((a, b) => {
      return defaultLists.indexOf(b.name) - defaultLists.indexOf(a.name);
    });
  };

  async fetchPlaylists() {
    if (!this.store.feature.playlist) return defaultLists;
    try {
      const res = await request<Record<string, string[]>>({
        url: '/playlistnames',
        timeout: 2500,
      });
      if (res.statusCode !== 200 || !res.data.names) {
        return defaultLists;
      }
      return defaultLists.concat(res.data.names);
    } catch {
      return defaultLists;
    }
  }

  createPlaylist() {
    wx.showModal({
      title: '新建歌单',
      content: '',
      editable: true,
      placeholderText: '请输入歌单名称',
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        const oldItem = this.playlists.find(
          (item) => item.name === res.content,
        );
        if (oldItem) {
          wx.showToast({
            title: '歌单名称不可重复',
            icon: 'none',
          });
          return;
        }
        await request({
          url: '/playlistadd',
          method: 'POST',
          data: {
            name: res.content,
          },
        });
        this.playlists = this.playlists.concat({
          name: res.content,
          count: 0,
        });
      },
    });
  }

  editPlaylist(name: string, index: number) {
    wx.showModal({
      title: '编辑歌单',
      content: name,
      editable: true,
      placeholderText: '请输入歌单名称',
      success: async (res) => {
        if (!res.confirm || !res.content) return;
        const oldItem = this.playlists.find(
          (item) => item.name === res.content,
        );
        if (oldItem) {
          wx.showToast({
            title: '歌单名称不可重复',
            icon: 'none',
          });
          return;
        }
        await request({
          url: '/playlistupdatename',
          method: 'POST',
          data: {
            oldname: name,
            newname: res.content,
          },
        });
        const newList = [...this.playlists];
        newList[index].name = res.content;
        this.playlists = newList;
      },
    });
  }

  deletePlaylist(name: string, index: number) {
    wx.showModal({
      title: '确认删除',
      content: '仅删除歌单，歌曲文件不会被删除',
      success: async (res) => {
        if (!res.confirm) return;
        await request({
          url: '/playlistdel',
          method: 'POST',
          data: {
            name,
          },
        });
        const newList = [...this.playlists];
        newList.splice(index, 1);
        this.playlists = newList;
      },
    });
  }

  updatePlaylistCount(name: string, modifer: number) {
    const newList = [...this.playlists];
    const index = newList.findIndex((item) => item.name === name);

    if (index === -1) {
      return;
    }

    newList[index].count += modifer;
    this.playlists = newList;
  }
}
