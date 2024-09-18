import {
  getGlobalData,
  isPrivateDomain,
  parseAuthUrl,
  request,
  setGlobalData,
} from '@/miniprogram/utils/util';

Component({
  data: {
    list: [] as { name: string; count: number }[],
    connected: true,
    configured: true,
    serverConfig: getGlobalData('serverConfig') || {},
    error: null as null | string,
  },
  lifetimes: {
    async attached() {
      const { domain } = getGlobalData('serverConfig');
      if (!domain) {
        this.setData({ configured: false });
        return;
      }
      try {
        wx.showLoading({
          title: '加载中',
        });
        const res = await request<Record<string, string[]>>({
          url: '/musiclist',
          timeout: 2500,
        });
        if (res.statusCode !== 200) {
          this.setData({ connected: false });
          return;
        }
        this.setData({
          list: Object.entries(res.data)
            .map(([name, items]) => ({
              name,
              count: items.length,
            }))
            .sort(({ name }) => (name === '全部' ? -1 : 1)),
        });
        setGlobalData('musiclist', res.data);
        const instance = this.getInstance();
        instance?.setData({ connected: true });
      } catch (err) {
        this.setData({
          connected: false,
          error: (err as { errMsg: string }).errMsg,
        });
        console.error(err);
      } finally {
        wx.hideLoading();
      }
    },
  },
  pageLifetimes: {
    show() {
      this.setData({
        serverConfig: getGlobalData('serverConfig') || {},
      });
    },
  },
  methods: {
    onShareAppMessage() {
      return {
        title: 'xiaomusic 客户端，轻松投放本地音乐至小米音箱',
        imageUrl:
          'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/cover.png',
      };
    },
    onShareTimeline() {
      return {
        title: 'xiaomusic 客户端，轻松投放本地音乐至小米音箱',
        imageUrl:
          'https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/cover.png',
      };
    },
    isPrivateDomain,
    getInstance() {
      if (typeof this.getAppBar === 'function') {
        return this.getAppBar();
      }
    },
    async handleViewTap(e) {
      const { name } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/list/index?name=${name}`,
      });
    },
    handleSetting() {
      const { domain, username, password } = getGlobalData('serverConfig');
      const account = username ? `${username}:${password || ''}@` : '';
      wx.showModal({
        title: '请输入 xiaomusic 的服务地址',
        placeholderText: 'user:pass@192.168.1.6:8090',
        content: `${account}${domain || ''}`,
        editable: true,
        success: (res) => {
          if (!res.confirm) return;
          if (!res.content) return;
          const config = parseAuthUrl(res.content);
          wx.setStorageSync('serverConfig', config);
          setGlobalData('serverConfig', config);
          wx.reLaunch({ url: '/pages/index/index' });
        },
      });
    },
    handleSwitchDomain() {
      const { serverConfig } = this.data;
      const config = {
        ...serverConfig,
        domain: isPrivateDomain(serverConfig.domain)
          ? serverConfig.publicDomain
          : serverConfig.privateDomain,
      };
      setGlobalData('serverConfig', config);
      wx.setStorageSync('serverConfig', config);
      wx.reLaunch({ url: '/pages/index/index' });
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
