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
        safeAreaRight: windowWidth - rect.left,
        safeAreaTop: statusBarHeight,
        menuHeight: rect.height,
      });
    },
  },
});
