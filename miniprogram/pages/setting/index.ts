Component({
  lifetimes: {
    attached() {
      const instance = this.getInstance();
      instance?.setData({ menubar: false });
    },
    detached() {
      const instance = this.getInstance();
      instance?.setData({ menubar: true });
    },
  },
  methods: {
    getInstance() {
      if (typeof this.getAppBar === 'function') {
        return this.getAppBar();
      }
    },
  },
});
