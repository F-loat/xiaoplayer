import { store } from '@/miniprogram/stores';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  options: {
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  /**
   * 组件的属性列表
   */
  properties: {
    extClass: {
      type: String,
      value: '',
    },
    title: {
      type: String,
      value: '',
    },
    background: {
      type: String,
      value: '',
    },
    color: {
      type: String,
      value: '',
    },
    back: {
      type: Boolean,
      value: true,
    },
    half: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    animated: {
      // 显示隐藏的时候opacity动画效果
      type: Boolean,
      value: true,
    },
    show: {
      // 显示隐藏导航，隐藏的时候navigation-bar的高度占位还在
      type: Boolean,
      value: true,
      observer: '_showChange',
    },
    // back为true的时候，返回的页面深度
    delta: {
      type: Number,
      value: 1,
    },
  },
  data: {
    displayStyle: '',
    wrapperStyle: '',
    titleWidth: '',
    menuHeight: 0,
  },
  storeBindings: {
    store,
    fields: ['isPC', 'serverConfig'] as const,
    actions: [] as const,
  },
  lifetimes: {
    attached() {
      this.initLayout();
      if (store.isPC) {
        wx.setNavigationBarTitle({
          title: this.data.title,
        });
      }
    },
  },
  pageLifetimes: {
    resize() {
      this.initLayout();
    },
  },
  /**
   * 组件的方法列表
   */
  methods: {
    _showChange(show: boolean) {
      const animated = this.data.animated;
      let displayStyle = '';
      if (animated) {
        displayStyle = `opacity: ${show ? '1' : '0'};transition:opacity 0.5s;`;
      } else {
        displayStyle = `display: ${show ? '' : 'none'};`;
      }
      this.setData({
        displayStyle,
      });
    },
    initLayout() {
      const { windowWidth } = wx.getWindowInfo();
      const rect = wx.getMenuButtonBoundingClientRect();
      if (this.data.half) {
        this.setData({
          wrapperStyle: 'padding: 8px 0;',
          menuHeight: rect.height,
        });
        return;
      }
      this.setData({
        wrapperStyle: `
          height: calc(${rect.height} + ${rect.top + 10}px);
          padding-top: ${rect.top}px;
          padding-right: ${windowWidth - rect.left}px;
          padding-bottom: 10px;
        `,
        titleWidth: `width: ${windowWidth - rect.left}px`,
        menuHeight: rect.height,
      });
    },
    handleTitleTap() {
      this.triggerEvent('titletap');
    },
    back() {
      const { delta } = this.data;
      if (delta) {
        wx.navigateBack({
          delta,
        });
      }
      this.triggerEvent('back', { delta }, {});
    },
  },
});
