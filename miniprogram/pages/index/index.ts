import { SHARE_COVER, SLOGAN, store } from '@/miniprogram/stores';
import { ServerConfig } from '@/miniprogram/types';
import {
  getGlobalData,
  parseAuthUrl,
  request,
  safeJSONParse,
  setGlobalData,
} from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

interface Item {
  name: string;
  count: number;
  icon?: string;
  music?: string;
  cover?: string;
}

let list: Item[] = [];
const pageSize = 25;

const playlistIconMap: Record<string, string> = {
  所有歌曲: 'suoyougequ',
  最近新增: 'zuijinxinzeng',
  收藏: 'shoucanggedan',
};

ComponentWithStore({
  properties: {
    scene: String,
    shareConfig: String,
  },
  data: {
    connected: true,
    list: [] as Item[],
    musics: [] as string[],
    infos: {} as Record<string, string>,
    error: null as null | string,
    filterValue: '',
  },
  storeBindings: [
    {
      store,
      fields: ['serverConfig', 'isPC', 'status'] as const,
      actions: [] as const,
    },
    {
      store: store.playlist,
      fields: ['playlists'] as const,
      actions: ['createPlaylist'] as const,
    },
    {
      store: store.feature,
      fields: ['homeDevices'] as const,
      actions: [] as const,
    },
  ],
  lifetimes: {
    attached() {
      this.fetchMusicList();
    },
  },
  pageLifetimes: {
    show() {
      const { shareConfig, scene } = this.properties;
      if (shareConfig) {
        const config = safeJSONParse<ServerConfig>(shareConfig);
        if (config) store.updateServerConfig(config);
        return;
      }
      if (!scene) return;
      const { domain } = decodeURIComponent(scene)
        .split('&')
        .reduce(
          (result, current: string) => {
            const [key, val] = current.split('=');
            return { ...result, [key]: val };
          },
          {} as Record<string, string>,
        );
      if (!domain) return;
      store.updateServerConfig({
        ...store.serverConfig,
        ...parseAuthUrl(domain),
      });
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
        setGlobalData('musiclist', res.data);
        store.playlist.setPlaylists(playlists);
        store.favorite.setMusics(res.data['收藏']);
        store.hostPlayer.setList(store.musicAlbum!);
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
      const filteredList = filterValue
        ? list.filter((item) => item.name.includes(filterValue))
        : list;

      const loadedCount = this.data.list.length;
      if (loadedCount >= filteredList.length) return;

      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + loadedCount);

      const data = indexes.reduce((result, index) => {
        if (!filteredList[index]) return result;
        return {
          ...result,
          [`list[${index}]`]: filteredList[index],
        };
      }, {});

      this.setData(data);
      this.handleFetchInfos(loadedCount);
    },
    async handleFetchInfos(offset: number = 0) {
      const curlist = this.data.list;
      const indexes = new Array(pageSize)
        .fill(null)
        .map((_, index) => index + offset)
        .filter((index) => !curlist[index]?.cover);

      const names = indexes.reduce((result, index) => {
        if (!curlist[index]?.music) return result;
        return result.concat(curlist[index].music);
      }, [] as string[]);

      await store.info.fetchInfos(names);

      const data = indexes.reduce((result, index) => {
        const music = curlist[index]?.music;
        const cover = store.info.getCover(music);
        if (!music || !cover) return result;
        return {
          ...result,
          [`list[${index}].cover`]: cover,
        };
      }, {});

      this.setData(data);
    },
    handleClearCache() {
      const { keys } = wx.getStorageInfoSync();
      if (!Array.isArray(keys)) return;
      keys.forEach((key) => {
        if (key.startsWith('musicInfo:')) {
          wx.removeStorage({ key });
        }
      });
    },
    handleRefresh() {
      wx.createSelectorQuery()
        .select('#scrollview')
        .node()
        .exec(async (res) => {
          const scrollView = res[0].node;
          await store.sendCommand('刷新列表', store.devices[1]?.did);
          await this.fetchMusicList();
          scrollView.closeRefresh();
          this.handleClearCache();
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
    async handlePlayMusic(e: {
      target: {
        dataset: {
          name: string;
        };
      };
    }) {
      const { name } = e.target.dataset;
      await store.player.playMusic(name);
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
      await store.updateServerConfig(config);
      this.fetchMusicList();
      wx.hideLoading();
      wx.showToast({
        title: isPrivate ? '已切换为公网连接' : '已切换为内网连接',
        icon: 'none',
      });
    },
    handleFilter(e: {
      detail: {
        value: string;
      };
    }) {
      const { value } = e.detail;
      if (!value) {
        this.setData({
          filterValue: value,
          list: list.slice(0, pageSize),
          musics: [],
        });
        this.handleFetchInfos();
        return;
      }
      const filteredList = list.filter((item) => item.name.includes(value));
      const musiclist = getGlobalData('musiclist');
      const searchKey = value.toLocaleLowerCase();
      const allmusics = Object.values(musiclist).flat(1) as string[];
      const musics = allmusics.filter((item) => {
        return (item as string).toLocaleLowerCase().includes(searchKey);
      });
      this.setData({
        filterValue: value,
        list: filteredList.slice(0, pageSize),
        musics: Array.from(new Set(musics)),
      });
      this.handleFetchInfos();
    },
    handleSearch(e: {
      detail: {
        value: string;
      };
    }) {
      store.player.playMusic(e.detail.value, '');
      this.handleFilter({ detail: { value: '' } });
    },
    async handlePlayText(e: {
      detail: {
        value: string;
      };
    }) {
      const text = e.detail.value;
      if (!text || store.did === 'host') {
        return;
      }
      if (!store.feature.playText) {
        wx.showToast({
          title: 'xiaomusic 版本较低，暂不支持文本播放',
          icon: 'none',
        });
        return;
      }
      try {
        await request({
          url: '/playtts',
          data: {
            text,
            did: store.did,
          },
        });
        wx.showToast({
          title: '文本内容已播放',
          icon: 'none',
        });
      } catch {
        wx.showToast({
          title: '文本内容播放失败',
          icon: 'none',
        });
      }
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
