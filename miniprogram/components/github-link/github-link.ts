import { store } from '@/miniprogram/stores';

Component({
  data: {
    _clickTimes: 0,
  },
  properties: {
    title: String,
    link: String,
  },
  methods: {
    handleLink() {
      wx.setClipboardData({
        data: this.data.link,
        success: () => {
          wx.showToast({
            title: '链接已复制，请在浏览器中打开～',
            icon: 'none',
          });
          this.countUp();
        },
      });
    },
    countUp() {
      this.data._clickTimes += 1;
      if (this.data._clickTimes >= 5) {
        store.feature.setAd(false);
        wx.showToast({
          title: '小程序内部广告已禁用～',
          icon: 'none',
        });
      }
    },
  },
});
