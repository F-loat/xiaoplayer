import { store } from '@/miniprogram/stores';

Component({
  data: {
    safeAreaRight: 0,
    safeAreaTop: 0,
    menuHeight: 0,
  },
  lifetimes: {
    attached() {
      const { windowWidth } = wx.getWindowInfo();
      const rect = wx.getMenuButtonBoundingClientRect();

      this.setData({
        safeAreaRight: store.isPC ? 0 : windowWidth - rect.left,
        safeAreaTop: rect.top,
        menuHeight: rect.height,
      });
    },
  },
});
