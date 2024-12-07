import { store } from '@/miniprogram/stores';
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
}

let list: Item[] = [];
const pageSize = 40;

ComponentWithStore({
  data: {
    connected: true,
    list: [] as Item[],
    error: null as null | string,
    filterValue: '',
  },
  storeBindings: {
    store,
    fields: ['serverConfig', 'isPC', 'status', 'musicM3U8Url'] as const,
    actions: [] as const,
  },
  lifetimes: {
    attached() {
      this.fetchMusicList();
    },
  },
  methods: {
    onShareAppMessage() {
      return {
        title: 'xiaomusic 客户端，轻松投放本地/NAS音乐至小米音箱',
        imageUrl:
          'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/cover.png',
      };
    },
    onShareTimeline() {
      return {
        title: 'xiaomusic 客户端，轻松投放本地音乐/NAS至小米音箱',
        imageUrl:
          'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/cover.png',
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
        list = Object.entries(res.data)
          .map(([name, items]) => ({
            name,
            count: items.length,
          }))
          .filter(({ name, count }) => {
            return (
              count && !['全部', '临时搜索列表', '所有电台'].includes(name)
            );
          })
          .sort((a, b) => {
            if (a.name === '所有歌曲') return -1;
            return a.name === '收藏' && b.name !== '所有歌曲' ? -1 : 1;
          });
        const { filterValue } = this.data;
        const filteredList = filterValue
          ? list.filter((item) => item.name.includes(filterValue))
          : list;
        this.setData({
          connected: true,
          list: filteredList.slice(0, pageSize),
        });
        store.favorite.setMusics(res.data['收藏']);
        setGlobalData('musiclist', res.data);
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
        };
      };
    }) {
      const { name } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/list/index?name=${name}`,
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
            ...this.data.serverConfig,
            ...parseAuthUrl(res.content),
          };
          store.setServerConfig(config);
          store.initSettings();
          this.fetchMusicList();
          const isPrivate = isPrivateDomain(config.domain);
          if (isPrivate && this.data.isPC) {
            wx.showToast({
              title: 'PC 端可能不支持内网访问，请尝试配置公网服务地址',
              icon: 'none',
            });
          }
        },
      });
    },
    async handleSwitchDomain() {
      const { serverConfig } = this.data;
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
    },
  },
});
