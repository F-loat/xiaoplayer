import { ComponentWithStore } from 'mobx-miniprogram-bindings';
import { DEFAULT_COVER, store } from '../../stores';
import { GestureState, PlayOrderType } from '../../types';
import { sleep } from '@/miniprogram/utils';

const progress = wx.worklet.shared(0);

ComponentWithStore({
  properties: {},

  data: {
    mode: 'cover' as 'cover' | 'lyric',
    statusBarHeight: 0,
    screenHeight: 0,
    orderIconMap: {
      [PlayOrderType.One]: 'danquxunhuan',
      [PlayOrderType.Rnd]: 'suijibofang',
      [PlayOrderType.All]: 'liebiaoxunhuan',
    },
    DEFAULT_COVER,
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
      const mode = wx.getStorageSync('player-mode');
      const { statusBarHeight, screenHeight } = wx.getWindowInfo();

      this.setData({
        statusBarHeight,
        screenHeight,
        mode: mode || 'cover',
      });

      store.setData({ showAppBar: false });

      wx.setKeepScreenOn({
        keepScreenOn: true,
      });
    },
    detached() {
      store.setData({ showAppBar: true });
      wx.setKeepScreenOn({
        keepScreenOn: false,
      });
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

    handleModeToggle() {
      const mode = this.data.mode === 'cover' ? 'lyric' : 'cover';
      this.setData({ mode });
      wx.setStorageSync('player-mode', mode);
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

    handleVolumeUp() {
      this.handleVolumeChange({
        detail: {
          value: Math.min(store.volume + 1, 100),
        },
      });
    },

    handleVolumeDown() {
      this.handleVolumeChange({
        detail: {
          value: Math.max(0, store.volume - 1),
        },
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

    async handleSwitchDevice() {
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
          if (status === 'playing') {
            await store.player.pauseMusic();
            await sleep(300);
          }
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

    handleFetchLyric() {
      wx.showModal({
        title: '请输入歌手名称 - 歌曲名称',
        content: store.musicName,
        editable: true,
        confirmText: '搜索歌词',
        success: (res) => {
          if (!res.confirm || !res.content) return;
          const [name, artist] = res.content.split('-');
          store.lyric.fetchMusicTag(name, '', artist, true);
        },
      });
    },

    hanldeLyricOffset() {
      wx.showModal({
        title: '请输入歌词偏移时长',
        content: String(store.lyric.offset || ''),
        placeholderText: '请输入数字',
        editable: true,
        success: (e) => {
          if (!e.confirm) return;
          const offset = parseInt(e.content);
          if (isNaN(offset)) {
            wx.showToast({
              title: '请输入数字',
              icon: 'none',
            });
            return;
          }
          store.lyric.setOffset(offset);
        },
      });
    },

    handlePlayingList() {
      wx.navigateTo({
        url: `/pages/list/playing?title=${store.musicAlbum}`,
        routeType: 'wx://bottom-sheet',
      });
    },

    handleCopyLink() {
      if (store.did !== 'host') {
        wx.showToast({
          title: '本机播放时可长按复制歌曲链接',
          icon: 'none',
        });
        return;
      }
      const { url } = store.hostPlayer.getMusic();
      if (!url) {
        wx.showToast({
          title: '暂无播放中的歌曲',
          icon: 'none',
        });
        return;
      }
      wx.setClipboardData({
        data: url,
        success: () => {
          wx.showToast({
            title: '歌曲链接已复制～',
            icon: 'none',
          });
        },
      });
    },
  },
});
