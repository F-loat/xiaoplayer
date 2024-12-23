import { SHARE_COVER, SLOGAN, store } from '@/miniprogram/stores';
import {
  isPrivateDomain,
  parseAuthUrl,
  request,
  setGlobalData,
} from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

interface Item {
  name: string;
  count: number;
  icon?: string;
  music?: string;
}

let list: Item[] = [];
const pageSize = 25;

const playlistIconMap: Record<string, string> = {
  所有歌曲: 'suoyougequ',
  最近新增: 'zuijinxinzeng',
  收藏: 'shoucanggedan',
};

ComponentWithStore({
  data: {
    connected: true,
    list: [] as Item[],
    infos: {} as Record<string, string>,
    error: null as null | string,
    filterValue: '',
  },
  storeBindings: [
    {
      store,
      fields: ['serverConfig', 'isPC', 'status', 'musicM3U8Url'] as const,
      actions: [] as const,
    },
    {
      store: store.playlist,
      fields: ['playlists'] as const,
      actions: [] as const,
    },
  ],
  lifetimes: {
    attached() {
      this.fetchMusicList();
    },
  },
  methods: {
    onShareAppMessage() {
      return {
        title: SLOGAN,
        imageUrl: SHARE_COVER,
      };
    },
    onShareTimeline() {
      return {
        title: SLOGAN,
        imageUrl: SHARE_COVER,
      };
    },
    async fetchMusicList() {
      try {
        wx.showLoading({
          title: '加载中',
        });
        const res = await request<Record<string, string[]>>({
          url: '/musiclist',
          timeout: 2500,
        });
        if (res.statusCode !== 200) {
          return;
        }
        const playlists: Item[] = [];
        const listNames = await store.playlist.fetchPlaylists();
        list = Object.entries(res.data)
          .map(([name, items]) => ({
            name,
            count: items.length,
            music: items[0],
          }))
          .filter(({ name, count }) => {
            if (listNames.includes(name)) {
              const icon = playlistIconMap[name] || 'zhuanji';
              playlists.push({ name, count, icon });
              return false;
            }
            return (
              count && !['全部', '临时搜索列表', '所有电台'].includes(name)
            );
          });
        const { filterValue } = this.data;
        const filteredList = filterValue
          ? list.filter((item) => item.name.includes(filterValue))
          : list;
        this.setData({
          connected: true,
          list: filteredList.slice(0, pageSize),
        });
        store.playlist.setPlaylists(playlists);
        store.favorite.setMusics(res.data['收藏']);
        setGlobalData('musiclist', res.data);
        this.handleFetchInfos();
      } catch (err) {
        const message = (err as { errMsg: string }).errMsg || '';
        if (!this.data.list.length) {
          this.setData({
            connected: false,
            error: message,
          });
        }
        if (message === 'request:fail url not in domain list') {
          wx.showModal({
            title: '网络异常',
            content: '局域网访问请确保小程序与 xiaomusic 服务在同一网段下',
          });
        }
        if (message.includes('-109')) {
          wx.showModal({
            title: '请求异常',
            content: '局域网访问请确认【系统设置-隐私-本地网络】权限已授予微信',
          });
        }
        console.error(err);
      } finally {
        wx.hideLoading();
      }
    },
    handleLoadMore() {
      const { filterValue } = this.data;
      const loadedCount = this.data.list.length;
      const filteredList = filterValue
        ? list.filter((item) => item.name.includes(filterValue))
        : list;
      if (loadedCount >= filteredList.length) return;
      const count = (loadedCount / pageSize + 1) * pageSize;
      this.setData({ list: filteredList.slice(0, count) });
      this.handleFetchInfos(loadedCount);
    },
    async handleFetchInfos(offset: number = 0) {
      if (!store.feature.musicInfos || this.data.filterValue) {
        return;
      }
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset);
      const names = indexes.reduce((result, index) => {
        if (!list[index]) return result;
        return result + `name=${list[index].music}&`;
      }, '');
      if (!names) return;
      const { data: infos } = await request<
        {
          tags: {
            album: string;
            picture: string;
          };
        }[]
      >({
        url: `/musicinfos?${names}musictag=true`,
      });
      const newInfos = infos.reduce((result, current, index) => {
        const cover = store.getResourceUrl(current.tags.picture);
        return {
          ...result,
          [list[indexes[index]].name]: cover,
        };
      }, this.data.infos);
      this.setData({
        infos: newInfos,
      });
    },
    handleRefresh() {
      wx.createSelectorQuery()
        .select('#scrollview')
        .node()
        .exec(async (res) => {
          const scrollView = res[0].node;
          await store.sendCommand(
            '刷新列表',
            Object.values(store.devices)[0]?.did,
          );
          await this.fetchMusicList();
          scrollView.closeRefresh();
          wx.showToast({
            title: '列表刷新成功',
            icon: 'none',
          });
        });
    },
    handleViewTap(e: {
      currentTarget: {
        dataset: {
          name: string;
          type?: string;
        };
      };
    }) {
      const { name, type } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/list/index?name=${name}&type=${type}`,
      });
    },
    handleSetting() {
      const { domain, username, password } = store.serverConfig;
      const account = username ? `${username}:${password || ''}@` : '';
      wx.showModal({
        title: '请输入 xiaomusic 的服务地址',
        placeholderText: '192.168.1.6:8090',
        content: `${account}${domain || ''}`,
        editable: true,
        success: (res) => {
          if (!res.confirm || !res.content) return;
          const config = {
            ...store.serverConfig,
            ...parseAuthUrl(res.content),
          };
          store.setServerConfig(config);
          store.initSettings();
          this.fetchMusicList();
          const isPrivate = isPrivateDomain(config.domain);
          if (isPrivate && this.data.isPC) {
            wx.setClipboardData({
              data: 'https://github.com/F-loat/xiaoplayer/issues/3',
            });
            wx.showToast({
              title:
                'PC 端可能不支持内网访问，请尝试配置公网服务地址或参考剪贴板中教程配置',
              icon: 'none',
            });
          }
        },
      });
    },
    async handleSwitchDomain() {
      const { serverConfig } = store;
      if (!serverConfig.privateDomain || !serverConfig.publicDomain) {
        return;
      }
      const isPrivate = serverConfig.domain === serverConfig.privateDomain;
      const config = {
        ...serverConfig,
        domain: isPrivate
          ? serverConfig.publicDomain!
          : serverConfig.privateDomain!,
      };
      wx.showLoading({
        title: '网络切换中',
      });
      store.setServerConfig(config);
      await store.initSettings();
      this.fetchMusicList();
      wx.hideLoading();
      wx.showToast({
        title: isPrivate ? '已切换为公网连接' : '已切换为内网连接',
        icon: 'none',
      });
    },
    handleRepoLink() {
      wx.setClipboardData({
        data: 'https://github.com/hanxi/xiaomusic',
        success: () => {
          wx.showToast({
            title: '链接已复制，请在浏览器中访问～',
            icon: 'none',
          });
        },
      });
    },
    handleError() {
      wx.setClipboardData({
        data: this.data.error || '未知异常',
        success: () => {
          wx.showToast({
            title: '错误日志已复制～',
            icon: 'none',
          });
        },
      });
    },
    handleFilter(e: {
      detail: {
        value: string;
      };
    }) {
      const { value } = e.detail;
      const filteredList = value
        ? list.filter((item) => item.name.includes(value))
        : list;
      this.setData({
        filterValue: value,
        list: filteredList.slice(0, pageSize),
      });
    },
    handleSearch(e: {
      detail: {
        value: string;
      };
    }) {
      store.player.playMusic(e.detail.value, '');
      this.handleFilter({ detail: { value: '' } });
    },
    handleCreateList() {
      if (!store.feature.playlist) {
        wx.showToast({
          title: 'xiaomusic 版本较低，请更新后使用',
          icon: 'none',
        });
        return;
      }
      store.playlist.createPlaylist();
    },
    handleListOperation(e: {
      detail: {
        value: string;
        index: number;
      };
    }) {
      const name = e.detail.value;
      const index = e.detail.index;
      const items = [{ label: '删除歌单', value: 'delete' }];
      if (store.feature.renamePlaylist) {
        items.unshift({ label: '编辑名称', value: 'edit' });
      }
      wx.showActionSheet({
        alertText: '歌单操作',
        itemList: items.map((i) => i.label),
        success: (res) => {
          const { value } = items[res.tapIndex];
          switch (value) {
            case 'edit':
              store.playlist.editPlaylist(name, index);
              break;
            case 'delete':
              store.playlist.deletePlaylist(name, index);
              break;
            default:
              break;
          }
        },
      });
    },
  },
});
