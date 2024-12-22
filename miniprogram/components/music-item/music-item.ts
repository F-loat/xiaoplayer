Component({
  properties: {
    title: {
      type: String,
      value: '',
    },
    subTitle: {
      type: String,
      value: '',
    },
    description: {
      type: String,
      value: '',
    },
    icon: {
      type: String,
      value: '',
    },
    cover: {
      type: String,
      value: '',
    },
    index: {
      type: Number,
    },
    operation: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    handleOperation() {
      this.triggerEvent('operation', {
        value: this.data.title,
        index: this.data.index,
      });
    },
  },
});
