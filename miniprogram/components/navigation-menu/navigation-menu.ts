import { store } from '@/miniprogram/stores';

Component({
  data: {
    ios: false,
    safeAreaRight: 0,
    safeAreaTop: 0,
    menuHeight: 0,
  },
  lifetimes: {
    attached() {
      const { platform } = wx.getDeviceInfo();
      const { statusBarHeight, windowWidth } = wx.getWindowInfo();

      const isAndroid = platform === 'android';
      const isIOS = !isAndroid;

      const rect = wx.getMenuButtonBoundingClientRect();

      this.setData({
        ios: isIOS,
        safeAreaRight: store.isPC ? 0 : windowWidth - rect.left,
        safeAreaTop: statusBarHeight,
        menuHeight: rect.height,
      });
    },
  },
});
