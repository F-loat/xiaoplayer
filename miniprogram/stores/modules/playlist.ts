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
    if (!this.store.feature.playlist) {
      wx.showToast({
        title: 'xiaomusic 版本较低，请更新后使用',
        icon: 'none',
      });
      return;
    }
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

  addMusic(playlist: string, music: string) {
    return request({
      url: '/playlistaddmusic',
      method: 'POST',
      data: {
        name: playlist,
        music_list: [music],
      },
    });
  }

  removeMusic(playlist: string, music: string) {
    return request({
      url: '/playlistdelmusic',
      method: 'POST',
      data: {
        name: playlist,
        music_list: [music],
      },
    });
  }

  addToList(name: string) {
    const customLists = this.store.playlist.customPlaylists;

    if (!customLists.length) {
      wx.showToast({
        title: '暂无自定义歌单',
        icon: 'none',
      });
      return;
    }

    if (customLists.length > 6) {
      wx.showToast({
        title: '暂只支持至多 6 个自定义歌单',
        icon: 'none',
      });
      return;
    }

    wx.showActionSheet({
      itemList: customLists.map((item) => item.name),
      success: async (res) => {
        const { name: playlist } = customLists[res.tapIndex];

        await this.addMusic(playlist, name);
        this.updatePlaylistCount(playlist, 1);

        const musiclist = getGlobalData('musiclist');
        musiclist[playlist]?.push(name);

        wx.showToast({
          title: '添加成功',
          icon: 'none',
        });
      },
    });
  }
}
