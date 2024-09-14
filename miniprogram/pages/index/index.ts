import {
  getGlobalData,
  parseAuthUrl,
  request,
  setGlobalData,
} from '@/miniprogram/utils/util';

Component({
  data: {
    list: [] as { name: string; count: number }[],
    connected: true,
    configured: true,
  },
  lifetimes: {
    async attached() {
      const { domain } = getGlobalData('serverConfig');
      if (!domain) {
        this.setData({ configured: false });
        return;
      }
      try {
        const res = await request<Record<string, string[]>>({
          url: '/musiclist',
          timeout: 1500,
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
        this.setData({ connected: false });
        console.error(err);
      }
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
      const instance = this.getInstance();
      instance?.handleSetting();
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
  },
});
