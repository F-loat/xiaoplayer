Component({
  properties: {
    placeholder: {
      type: String,
      value: '',
    },
    btnText: {
      type: String,
      value: '搜索',
    },
  },
  data: {
    focus: false,
    value: '',
  },
  methods: {
    handleFocus() {
      this.setData({ focus: true });
    },
    handleBlur() {
      setTimeout(() => this.setData({ focus: false }), 300);
    },
    handleConfirm(e: {
      detail: {
        value: string;
      };
    }) {
      this.setData({
        value: e.detail.value,
      });
      this.handleSearch();
    },
    handleInput(e: {
      detail: {
        value: string;
      };
    }) {
      const { value } = e.detail;
      this.setData({ value });
      this.triggerEvent('change', {
        value,
      });
    },
    handleSearch() {
      this.triggerEvent('search', {
        value: this.data.value,
      });
      this.setData({ value: '' });
      this.triggerEvent('change', {
        value: '',
      });
    },
    handlePlayText() {
      this.triggerEvent('playtext', {
        value: this.data.value,
      });
      this.setData({ value: '' });
      this.triggerEvent('change', {
        value: '',
      });
    },
  },
});
