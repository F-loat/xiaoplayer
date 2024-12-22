import { store } from '@/miniprogram/stores';
import { getGlobalData, request } from '@/miniprogram/utils';

const pageSize = 25;

Component({
  properties: {
    name: String,
    title: String,
    type: String,
  },
  data: {
    list: [] as string[],
    infos: {} as Record<
      string,
      {
        album?: string;
        cover?: string;
      }
    >,
    filterValue: '',
  },
  lifetimes: {
    attached() {
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      this.setData({ list: curlist.slice(0, pageSize) });
      this.handleFetchInfos();
    },
  },
  methods: {
    async handleViewTap(e: {
      target: {
        dataset: {
          name: string;
        };
      };
    }) {
      const { name } = e.target.dataset;
      const { name: album } = this.data;
      await store.player.playMusic(name, album);
    },
    handleLoadMore() {
      const { filterValue } = this.data;
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const filteredList = filterValue
        ? curlist.filter((item: string) => item.includes(filterValue))
        : curlist;
      const loadedCount = this.data.list.length;
      if (loadedCount >= filteredList.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: filteredList.slice(0, count) });
      this.handleFetchInfos(loadedCount);
    },
    handleFilter(e: {
      detail: {
        value: string;
      };
    }) {
      const { value } = e.detail;
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const filteredList = value
        ? curlist.filter((item: string) => item.includes(value))
        : curlist;
      this.setData({
        filterValue: value,
        list: filteredList.slice(0, pageSize),
      });
    },
    async handleFetchInfos(offset: number = 0) {
      if (!store.feature.musicInfos || this.data.filterValue) {
        return;
      }
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset);
      const names = indexes.reduce((result, index) => {
        if (!curlist[index]) return result;
        return result + `name=${curlist[index]}&`;
      }, '');
      if (!names) return;
      const { data: infos } = await request<
        {
          name: string;
          tags: {
            album: string;
            picture: string;
          };
        }[]
      >({
        url: `/musicinfos?${names}musictag=true`,
      });
      const newInfos = infos.reduce((result, current) => {
        return {
          ...result,
          [current.name]: {
            album: current.tags.album,
            cover: store.getResourceUrl(current.tags.picture),
          },
        };
      }, this.data.infos);
      this.setData({ infos: newInfos });
    },
    handleAddToList(name: string) {
      const customLists = store.playlist.customPlaylists;

      if (!customLists.length) {
        wx.showToast({
          title: '暂无自定义列表',
          icon: 'none',
        });
        return;
      }

      wx.showActionSheet({
        itemList: customLists.map((item) => item.name),
        success: async (res) => {
          const { name: playlist } = customLists[res.tapIndex];
          await request({
            url: '/playlistaddmusic',
            method: 'POST',
            data: {
              name: playlist,
              music_list: [name],
            },
          });

          store.playlist.updatePlaylistCount(playlist, 1);

          const musiclist = getGlobalData('musiclist');
          musiclist[playlist]?.push(name);

          wx.showToast({
            title: '添加成功',
            icon: 'none',
          });
        },
      });
    },
    handleDeleteMusic(name: string, index: number) {
      wx.showModal({
        title: '确认删除',
        content: '注意：该操作会永久删除该歌曲且不可撤销！',
        success: async (res) => {
          if (!res.confirm) return;
          await request({
            url: '/delmusic',
            method: 'POST',
            data: {
              name,
            },
          });
          const newList = [...this.data.list];
          newList.splice(index, 1);
          this.setData({ list: newList });
        },
      });
    },
    async handleRemoveMusic(name: string, index: number) {
      const playlist = this.data.name;

      await request({
        url: '/playlistdelmusic',
        method: 'POST',
        data: {
          name: playlist,
          music_list: [name],
        },
      });

      store.playlist.updatePlaylistCount(playlist, -1);

      const newList = [...this.data.list];
      newList.splice(index, 1);
      this.setData({ list: newList });

      const musiclist = getGlobalData('musiclist');
      musiclist[playlist]?.splice(index, 1);
    },
    handleItemOperation(e: {
      detail: {
        value: string;
        index: number;
      };
    }) {
      const name = e.detail.value;
      const index = e.detail.index;
      const items =
        this.data.type === 'playlist'
          ? [
              { label: '移除歌曲', value: 'remove' },
              { label: '删除歌曲', value: 'delete' },
            ]
          : [
              { label: '添加到', value: 'addTo' },
              { label: '删除歌曲', value: 'delete' },
            ];
      wx.showActionSheet({
        alertText: '歌曲操作',
        itemList: items.map((i) => i.label),
        success: (res) => {
          const { value } = items[res.tapIndex];
          switch (value) {
            case 'addTo':
              this.handleAddToList(name);
              break;
            case 'remove':
              this.handleRemoveMusic(name, index);
              break;
            case 'delete':
              this.handleDeleteMusic(name, index);
              break;
            default:
              break;
          }
        },
      });
    },
  },
});
