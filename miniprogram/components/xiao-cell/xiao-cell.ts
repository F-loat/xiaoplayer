Component({
  options: {
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  properties: {
    merge: {
      type: String,
      value: '',
    },
    extClass: {
      type: String,
      value: '',
    },
  },
});
