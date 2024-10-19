import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { request, sleep } from '../utils';
import { store } from '../stores';
import { PlayOrderType } from '../types';

const { shared, timing, Easing } = wx.worklet;

const GestureState = {
  POSSIBLE: 0,
  BEGIN: 1,
  ACTIVE: 2,
  END: 3,
  CANCELLED: 4,
};

const clamp = function (cur: number, lowerBound: number, upperBound: number) {
  'worklet';
  if (cur > upperBound) return upperBound;
  if (cur < lowerBound) return lowerBound;
  return cur;
};

let progress = shared(0);

ComponentWithStore({
  properties: {},

  data: {
    lrc: '',
    maxCoverSize: 0,
    statusBarHeight: 0,
    screenHeight: 0,
    orderIconMap: {
      [PlayOrderType.One]: 'danquxunhuan',
      [PlayOrderType.Rnd]: 'suijibofang',
      [PlayOrderType.All]: 'liebiaoxunhuan',
    },
  },

  storeBindings: [
    {
      store,
      fields: [
        'did',
        'volume',
        'status',
        'currentDevice',
        'musicName',
        'musicCover',
        'musicLyric',
        'musicLyricLoading',
        'playOrder',
        'menubar',
      ] as const,
      actions: [] as const,
    },
    {
      store: store.player,
      fields: [] as const,
      actions: ['playPrevMusic', 'playNextMusic'] as const,
    },
  ],

  lifetimes: {
    attached() {
      const { platform } = wx.getDeviceInfo();
      const { statusBarHeight, screenHeight, screenWidth, safeArea } =
        wx.getWindowInfo();

      const isAndroid = platform === 'android';
      const initCoverSize = 60; // 初始图片大小
      const pagePadding = 24;
      const maxCoverSize = screenWidth - 2 * pagePadding;
      const safeAreaInsetBottom = screenHeight - safeArea.bottom;
      const isIOS = !isAndroid;

      this.setData({
        statusBarHeight,
        screenHeight,
        maxCoverSize,
      });

      wx.onDeviceMotionChange((res) => {
        wx.showToast({
          title: JSON.stringify(res),
          icon: 'none',
        });
      });

      this.applyAnimatedStyle('#cover', () => {
        'worklet';
        const height =
          initCoverSize + (maxCoverSize - initCoverSize) * progress.value;
        return {
          width: `${height}px`,
          height: `${height}px`,
        };
      });

      this.applyAnimatedStyle('#expand-container', () => {
        'worklet';
        const t = progress.value;
        const initBarHeight = initCoverSize + 8 * 2 + safeAreaInsetBottom;
        return {
          top: `${(screenHeight - initBarHeight) * (1 - t)}px`,
        };
      });

      this.applyAnimatedStyle('#title-wrap', () => {
        'worklet';
        return {
          opacity: String(1 - progress.value),
        };
      });

      const navBarHeight = statusBarHeight + (isIOS ? 40 : 44);
      this.applyAnimatedStyle('#nav-bar', () => {
        'worklet';
        const t = progress.value;
        const threshold = 0.8;
        const opacity = t < threshold ? 0 : (t - threshold) / (1 - threshold);

        return {
          opacity: String(opacity),
          height: `${navBarHeight * progress.value}px`,
        };
      });
    },
  },

  methods: {
    close() {
      progress.value = timing(0, {
        duration: 250,
        easing: Easing.ease,
      });
    },

    expand() {
      progress.value = timing(1, {
        duration: 250,
        easing: Easing.ease,
      });
    },

    handleDragUpdate(delta: number) {
      'worklet';
      const curValue = progress.value;
      const newVal = curValue - delta;
      progress.value = clamp(newVal, 0.0, 1.0);
    },

    handleDragEnd(velocity: number) {
      'worklet';
      const t = progress.value;
      let animateForward = false;
      if (Math.abs(velocity) >= 1) {
        animateForward = velocity <= 0;
      } else {
        animateForward = t > 0.7;
      }
      const animationCurve = Easing.out(Easing.ease);
      if (animateForward) {
        progress.value = timing(1.0, {
          duration: 200,
          easing: animationCurve,
        });
      } else {
        progress.value = timing(0.0, {
          duration: 250,
          easing: animationCurve,
        });
      }
    },

    handleVerticalDrag(evt: {
      state: number;
      deltaY: number;
      velocityY: number;
    }) {
      'worklet';
      if (evt.state === GestureState.ACTIVE) {
        if (Math.abs(evt.deltaY) < 2) return;
        const delta = evt.deltaY / this.data.screenHeight;
        this.handleDragUpdate(delta);
      } else if (evt.state === GestureState.END) {
        const velocity = evt.velocityY / this.data.screenHeight;
        this.handleDragEnd(velocity);
      } else if (evt.state === GestureState.CANCELLED) {
        this.handleDragEnd(0.0);
      }
    },

    async handlePlayToggle() {
      if (store.status === 'paused') {
        await store.player.playMusic();
      } else {
        await store.player.pauseMusic();
      }
    },

    handleVolumeChanging(e: {
      detail: {
        value: number;
      };
    }) {
      const volume = e.detail.value;
      wx.showToast({
        title: `音量 ${volume}`,
        icon: 'none',
      });
    },

    async handleVolumeChange(e: {
      detail: {
        value: number;
      };
    }) {
      const volume = e.detail.value;
      await request({
        url: '/setvolume',
        method: 'POST',
        data: {
          volume,
          did: store.did,
        },
      });
      wx.showToast({
        title: `音量已调整为 ${volume}`,
        icon: 'none',
      });
    },

    async handleSwitchOrder() {
      let cmd = '',
        playOrder = store.playOrder;
      switch (playOrder) {
        case PlayOrderType.One:
          cmd = '随机播放';
          playOrder = PlayOrderType.Rnd;
          break;
        case PlayOrderType.Rnd:
          cmd = '全部循环';
          playOrder = PlayOrderType.All;
          break;
        default:
          cmd = '单曲循环';
          playOrder = PlayOrderType.One;
      }
      store.setData({ playOrder });
      await store.sendCommand(cmd);
    },

    async handleSwitchSound() {
      const items = (
        Object.values(store.devices || {}) as {
          name: string | number;
          did: string;
        }[]
      )
        .slice(0, 5)
        .concat([{ name: '本机', did: 'host' }]);
      wx.showActionSheet({
        alertText: '设备投放',
        itemList: items.map((i) => String(i.name || i.did)),
        success: async (res) => {
          const device = items[res.tapIndex];
          if (device.did === store.did) {
            return;
          }
          const status = store.status;
          const album = store.musicAlbum;
          await store.player.pauseMusic();
          await sleep(300);
          store.setData({
            did: device.did,
          });
          if (status === 'playing') {
            await store.player.playMusic(store.musicName, album);
          }
        },
      });
    },

    async handleSchedule() {
      const items = [
        { label: '10 分钟', value: 10 },
        { label: '30 分钟', value: 30 },
        { label: '60 分钟', value: 60 },
      ];
      wx.showActionSheet({
        alertText: '定时关闭',
        itemList: items.map((i) => i.label),
        success: (res) => {
          const { value } = items[res.tapIndex];
          store.sendCommand(`${value}分钟后关机`);
        },
      });
    },

    handlePlayingList() {
      if (progress.value) this.close();
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      if (currentPage.route !== 'pages/list/playing') {
        wx.navigateTo({
          url: '/pages/list/playing',
        });
      }
    },

    handleLrcChange(e: {
      detail: {
        value?: string;
      };
    }) {
      this.setData({
        lrc: e.detail.value,
      });
    },

    handleSetting() {
      if (progress.value) this.close();
    },
  },
});
