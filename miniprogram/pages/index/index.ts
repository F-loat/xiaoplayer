import { store } from '@/miniprogram/stores';
import {
  isPrivateDomain,
  parseAuthUrl,
  request,
  setGlobalData,
} from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    list: [] as { name: string; count: number }[],
    error: null as null | string,
  },
  storeBindings: {
    store,
    fields: ['serverConfig', 'connected', 'isPC'] as const,
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
        this.setData({
          list: Object.entries(res.data)
            .map(([name, items]) => ({
              name,
              count: items.length,
            }))
            .filter(({ name }) => name !== '全部')
            .sort(({ name }) => (name === '所有歌曲' ? -1 : 1)),
        });
        setGlobalData('musiclist', res.data);
      } catch (err) {
        this.setData({
          error: (err as { errMsg: string }).errMsg,
        });
        console.error(err);
      } finally {
        wx.hideLoading();
      }
    },
    handleRefresh() {
      wx.createSelectorQuery()
        .select('#scrollview')
        .node()
        .exec(async (res) => {
          const scrollView = res[0].node;
          await store.sendCommand('刷新列表');
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
        placeholderText: 'user:pass@192.168.1.6:8090',
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
              title: 'PC 端可能不支持局域网访问，可尝试配置公网服务地址',
              icon: 'none',
            });
          }
        },
      });
    },
    async handleSwitchDomain() {
      const { serverConfig } = this.data;
      const config = {
        ...serverConfig,
        domain: isPrivateDomain(serverConfig.domain)
          ? serverConfig.publicDomain
          : serverConfig.privateDomain,
      };
      store.setServerConfig(config);
      await store.initSettings();
      this.fetchMusicList();
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
  },
});
