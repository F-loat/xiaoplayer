import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { DEFAULT_COVER, store } from '../../stores';
import { GestureState } from '../../types';

const progressX = wx.worklet.shared(0);
const progressY = wx.worklet.shared(0);

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
        'musicAlbum',
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
    {
      store: store.feature,
      fields: ['homeDevices', 'advanceLyric'] as const,
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
      deltaX: number;
      deltaY: number;
      state: GestureState;
    }) {
      'worklet';
      if (evt.state === GestureState.ACTIVE) {
        progressX.value = progressX.value + evt.deltaX;
        progressY.value = progressY.value + evt.deltaY;
      } else if (evt.state === GestureState.END && progressY.value < -5) {
        progressY.value = 0;
        wx.worklet.runOnJS(this.handleExpand)('Skyline');
      } else if (evt.state === GestureState.END && progressX.value > 20) {
        progressX.value = 0;
        wx.worklet.runOnJS(this.handlePlayPrevMusic)('Skyline');
      } else if (evt.state === GestureState.END && progressX.value < -20) {
        progressX.value = 0;
        wx.worklet.runOnJS(this.handlePlayNextMusic)('Skyline');
      }
    },

    async handlePlayToggle() {
      if (store.status === 'paused') {
        await store.player.playMusic();
      } else {
        await store.player.pauseMusic();
      }
    },

    handlePlayPrevMusic() {
      console.log(999);
      store.player.playPrevMusic();
    },

    handlePlayNextMusic() {
      store.player.playNextMusic();
    },
  },
});
