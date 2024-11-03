import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { store } from '../../stores';
import { GestureState, PlayOrderType } from '../../types';
import { sleep } from '@/miniprogram/utils';

const progress = wx.worklet.shared(0);

ComponentWithStore({
  properties: {},

  data: {
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
        'status',
        'currentDevice',
        'musicName',
        'musicCover',
        'playOrder',
        'speed',
        'volume',
        'isFavorite',
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
      const { statusBarHeight, screenHeight } = wx.getWindowInfo();

      this.setData({
        statusBarHeight,
        screenHeight,
      });

      store.setData({ showAppBar: false });
    },
    detached() {
      store.setData({ showAppBar: true });
    },
  },

  methods: {
    handleClose() {
      wx.navigateBack();
    },

    handleGesture(evt: {
      deltaY: number;
      velocityY: number;
      state: GestureState;
    }) {
      'worklet';
      if (evt.state === GestureState.ACTIVE) {
        progress.value = progress.value + evt.deltaY;
      } else if (evt.state === GestureState.END && progress.value > 50) {
        progress.value = 0;
        wx.worklet.runOnJS(this.handleClose)('Skyline');
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
      await store.player.setVolume(volume);
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

    handleSpeed() {
      const items = [
        { label: '0.5', value: 0.5 },
        { label: '1.0', value: 1.0 },
        { label: '1.5', value: 1.5 },
        { label: '2.0', value: 2.0 },
      ];
      wx.showActionSheet({
        alertText: '倍速播放',
        itemList: items.map((i) => i.label),
        success: (res) => {
          const { value } = items[res.tapIndex];
          store.player.setSpeed(value);
        },
      });
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
          store.player.setStopAt(value);
        },
      });
    },

    handleToggleFavorite() {
      store.favorite.toggleFavorite(store.musicName);
    },

    handlePlayingList() {
      wx.navigateTo({
        url: '/pages/list/playing',
        routeType: 'wx://bottom-sheet',
      });
    },
  },
});
