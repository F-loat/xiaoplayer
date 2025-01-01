import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { DEFAULT_COVER, store } from '../../stores';
import { GestureState } from '../../types';

const progress = wx.worklet.shared(0);

ComponentWithStore({
  properties: {},

  storeBindings: [
    {
      store,
      fields: [
        'did',
        'status',
        'currentDevice',
        'musicName',
        'musicCover',
        'musicLyricCurrent',
        'primaryColor',
      ] as const,
      actions: [] as const,
    },
    {
      store: store.lyric,
      fields: ['linePercent'] as const,
      actions: [] as const,
    },
  ],

  data: {
    DEFAULT_COVER,
  },

  methods: {
    handleExpand() {
      wx.navigateTo({
        url: '/pages/player/index',
        routeType: 'wx://upwards',
      });
    },

    handleGesture(evt: {
      deltaY: number;
      velocityY: number;
      state: GestureState;
    }) {
      'worklet';
      if (evt.state === GestureState.ACTIVE) {
        progress.value = progress.value + evt.deltaY;
      } else if (evt.state === GestureState.END && progress.value < -5) {
        progress.value = 0;
        wx.worklet.runOnJS(this.handleExpand)('Skyline');
      }
    },

    async handlePlayToggle() {
      if (store.status === 'paused') {
        await store.player.playMusic();
      } else {
        await store.player.pauseMusic();
      }
    },

    handlePlayNextMusic() {
      store.player.playNextMusic();
    },
  },
});
