import { ComponentWithComputed } from 'miniprogram-computed';
import { getGlobalData, request, sleep } from '../utils/util';

const { shared, timing, Easing } = wx.worklet;

const PLAY_TYPE_ONE = 0; // 单曲循环
const PLAY_TYPE_ALL = 1; // 全部循环
const PLAY_TYPE_RND = 2; // 随机播放

export const GestureState = {
  POSSIBLE: 0,
  BEGIN: 1,
  ACTIVE: 2,
  END: 3,
  CANCELLED: 4,
};

export const lerp = function (begin: number, end: number, t: number) {
  'worklet';
  return begin + (end - begin) * t;
};

export const clamp = function (
  cur: number,
  lowerBound: number,
  upperBound: number,
) {
  'worklet';
  if (cur > upperBound) return upperBound;
  if (cur < lowerBound) return lowerBound;
  return cur;
};

let innerAudioContext: WechatMiniprogram.InnerAudioContext;

ComponentWithComputed({
  properties: {},

  data: {
    did: '',
    volume: 20,
    settings: {},
    maxCoverSize: 0,
    statusBarHeight: 0,
    screenHeight: 0,
    status: 'paused',
    musicName: '',
    musicAlbum: '',
    musicCover:
      'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fb-ssl.duitang.com%2Fuploads%2Fitem%2F201812%2F12%2F20181212223741_etgxt.jpg&refer=http%3A%2F%2Fb-ssl.duitang.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1705583419&t=8b8402f169f865f34c2f16649b0ba6d8',
    playOrder: PLAY_TYPE_ALL,
    connected: false,
    menubar: true,
    isPC: getGlobalData('isPC'),
  },

  computed: {
    playOrderIcon(data) {
      if (data.playOrder === PLAY_TYPE_ONE) return 'danquxunhuan';
      if (data.playOrder === PLAY_TYPE_RND) return 'suijibofang';
      if (data.playOrder === PLAY_TYPE_ALL) return 'liebiaoxunhuan';
      return 'liebiaoxunhuan';
    },
    currentDevice(data) {
      return data.settings.devices?.[data.did] || { name: '本机' };
    },
  },

  lifetimes: {
    attached() {
      this.initMusic();

      const { platform } = wx.getDeviceInfo();
      const { statusBarHeight, screenHeight, screenWidth, safeArea } =
        wx.getWindowInfo();

      const isAndroid = platform === 'android';
      const progress = shared(0);
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

      this.progress = progress;
    },
  },

  methods: {
    close() {
      this.progress.value = timing(0, {
        duration: 250,
        easing: Easing.ease,
      });
    },

    expand() {
      this.progress.value = timing(1, {
        duration: 250,
        easing: Easing.ease,
      });
    },

    handleDragUpdate(delta) {
      'worklet';
      const curValue = this.progress.value;
      const newVal = curValue - delta;
      this.progress.value = clamp(newVal, 0.0, 1.0);
    },

    handleDragEnd(velocity) {
      'worklet';
      const t = this.progress.value;
      let animateForward = false;
      if (Math.abs(velocity) >= 1) {
        animateForward = velocity <= 0;
      } else {
        animateForward = t > 0.7;
      }
      const animationCurve = Easing.out(Easing.ease);
      if (animateForward) {
        this.progress.value = timing(1.0, {
          duration: 200,
          easing: animationCurve,
        });
      } else {
        this.progress.value = timing(0.0, {
          duration: 250,
          easing: animationCurve,
        });
      }
    },

    handleVerticalDrag(evt) {
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

    async initMusic() {
      const res = await request<{
        detail?: string;
        devices: Record<string, any>;
      }>({
        url: '/getsetting',
      });
      console.info('@@@ settings', res.data);

      if (res.data.detail === 'Not authenticated') {
        wx.showModal({
          title: '鉴权失败',
          content: '请确认账号密码是否配置正确',
        });
        return;
      }

      let did = wx.getStorageSync('did');
      const devices = res.data.devices || {};

      if (!did) {
        did = Object.keys(devices)[0];
        wx.setStorageSync('did', did);
      }

      this.setData({
        did,
        settings: res.data,
        playOrder: devices[did]?.play_type ?? PLAY_TYPE_ALL,
      });
      this.syncMusic(did);
      this.syncVolume(did);
      setInterval(() => this.syncMusic(), 10 * 1000);
    },

    async sendCommand(cmd: string, did?: string) {
      return request({
        url: '/cmd',
        method: 'POST',
        data: {
          cmd,
          did: did || this.data.did,
        },
      });
    },

    async handlePlayToggle() {
      if (this.data.status === 'paused') {
        if (this.data.did === 'host') {
          innerAudioContext?.play();
          this.setData({ status: 'playing' });
        } else {
          await this.sendCommand('播放歌曲|');
        }
      } else {
        if (this.data.did === 'host') {
          innerAudioContext?.pause();
          this.setData({ status: 'paused' });
        } else {
          await this.sendCommand('关机');
        }
      }
      this.syncMusic();
    },

    async syncMusic(did?: string) {
      if ((did || this.data.did) === 'host') {
        return;
      }
      const res = await request<{
        cur_music: string;
        is_playing: boolean;
      }>({
        url: `/playingmusic?did=${did || this.data.did}`,
      });
      const { cur_music, is_playing } = res.data;
      this.setData({
        musicName: cur_music,
        status: is_playing ? 'playing' : 'paused',
      });
    },

    async syncVolume(did?: string) {
      if ((did || this.data.did) === 'host') {
        return;
      }
      const res = await request<{
        volume: number;
      }>({
        url: `/getvolume?did=${did || this.data.did}`,
      });
      this.setData({
        volume: res.data.volume,
      });
    },

    async handlePlayNext() {
      await this.sendCommand('下一首');
      this.syncMusic();
    },

    async handlePlayPrev() {
      await this.sendCommand('上一首');
      this.syncMusic();
    },

    handleVolumeChanging(e) {
      const volume = e.detail.value;
      wx.showToast({
        title: `音量 ${volume}`,
        icon: 'none',
      });
    },

    async handleVolumeChange(e) {
      const volume = e.detail.value;
      await request({
        url: '/setvolume',
        method: 'POST',
        data: {
          volume,
          did: this.data.did,
        },
      });
      wx.showToast({
        title: `音量已调整为 ${volume}`,
        icon: 'none',
      });
    },

    async handleSwitchOrder() {
      let cmd = '';
      let { playOrder } = this.data;
      switch (playOrder) {
        case PLAY_TYPE_ONE:
          cmd = '随机播放';
          playOrder = PLAY_TYPE_RND;
          break;
        case PLAY_TYPE_RND:
          cmd = '全部循环';
          playOrder = PLAY_TYPE_ALL;
          break;
        default:
          cmd = '单曲循环';
          playOrder = PLAY_TYPE_ONE;
      }
      this.setData({ playOrder });
      await this.sendCommand(cmd);
    },

    async hostPlay(name: string) {
      const res = await request<{
        url: string;
      }>({
        url: `/musicinfo?name=${name}`,
      });

      innerAudioContext?.destroy();
      innerAudioContext = wx.createInnerAudioContext();
      const { domain } = getGlobalData('serverConfig');
      innerAudioContext.src = res.data.url?.replace(
        /:\/\/.*?\//,
        `://${domain}/`,
      );
      innerAudioContext.play();

      this.setData({ musicName: name, status: 'playing' });
    },

    async handleSwitchSound() {
      const { devices } = this.data.settings;
      const items = Object.values(devices || {})
        .slice(0, 5)
        .concat([{ name: '本机', did: 'host' }]) as {
        name: string | number;
        did: string;
      }[];
      wx.showActionSheet({
        alertText: '设备投放',
        itemList: items.map((i) => String(i.name || i.did)),
        success: async (res) => {
          const device = items[res.tapIndex];
          if (device.did === this.data.did) {
            return;
          }
          await this.sendCommand('关机');
          await sleep(300);
          this.setData({
            did: device.did,
          });
          wx.setStorageSync('did', device.did);
          if (this.data.status === 'playing') {
            if (device.did === 'host') {
              this.hostPlay(this.data.musicName);
            } else {
              await this.sendCommand(
                `播放歌曲|${this.data.musicName}`,
                device.did,
              );
            }
          }
          this.syncMusic();
          this.syncVolume();
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
        success: async (res) => {
          const { value } = items[res.tapIndex];
          this.sendCommand(`${value}分钟后关机`);
        },
      });
    },
  },
});
