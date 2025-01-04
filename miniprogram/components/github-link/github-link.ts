Component({
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
        },
      });
    },
  },
});
