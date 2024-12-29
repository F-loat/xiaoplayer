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
    list: [] as {
      name: string;
      cover?: string;
      album?: string;
    }[],
    filterValue: '',
  },
  lifetimes: {
    attached() {
      const musiclist = getGlobalData('musiclist');
      const curlist: string[] = musiclist[this.data.name] || [];
      const list = curlist.slice(0, pageSize).map((name) => ({ name }));
      this.setData({ list });
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
      const musiclist = getGlobalData('musiclist');
      const curlist = musiclist[this.data.name] || [];

      const { filterValue } = this.data;
      const filteredList: string[] = filterValue
        ? curlist.filter((item: string) => item.includes(filterValue))
        : curlist;

      const loadedCount = this.data.list.length;
      if (loadedCount >= filteredList.length) return;

      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + loadedCount);

      const data = indexes.reduce((result, index) => {
        if (!filteredList[index]) return result;
        return {
          ...result,
          [`list[${index}]`]: { name: filteredList[index] },
        };
      }, {});

      this.setData(data);
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
      const filteredList: string[] = value
        ? curlist.filter((item: string) => item.includes(value))
        : curlist;
      const list = filteredList.slice(0, pageSize).map((name) => ({ name }));
      this.setData({
        list,
        filterValue: value,
      });
      this.handleFetchInfos();
    },
    async handleFetchInfos(offset: number = 0) {
      const curlist = this.data.list;
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset)
        .filter((index) => !curlist[index]?.cover);

      const names = indexes.reduce((result, index) => {
        if (!curlist[index]) return result;
        return result.concat(curlist[index].name);
      }, [] as string[]);

      await store.info.fetchInfos(names);

      const data = indexes.reduce((result, index) => {
        const music = curlist[index]?.name;
        const cover = store.info.getCover(music);
        const album = store.info.getAlbum(music);
        if (!music || (!cover && !album)) return result;
        return {
          ...result,
          [`list[${index}].cover`]: cover,
          [`list[${index}].album`]: album,
        };
      }, {});

      this.setData(data);
    },
    handleAddToList(name: string) {
      const customLists = store.playlist.customPlaylists;

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

          await store.playlist.addMusic(playlist, name);
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

      await store.playlist.removeMusic(playlist, name);
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
              store.playlist.addToList(name);
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
