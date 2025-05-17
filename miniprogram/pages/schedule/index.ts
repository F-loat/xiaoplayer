import 'intl';
import { Device } from '@/miniprogram/types';
import {
  generateCron,
  CronType,
  request,
  safeJSONParse,
} from '../../utils/index';
import { CronExpressionParser } from 'cron-parser';
import { store } from '@/miniprogram/stores';

// 定义定时任务接口
interface Schedule {
  did: string;
  name: string;
  expression: string;
  arg1?: string | number;
}

Page({
  data: {
    devices: [] as {
      did: string;
      name: string;
    }[],
    types: ['单次', '每天', '每周'],
    tasks: [
      { id: 'play', name: '播放歌曲', arg: true },
      { id: 'play_music_list', name: '播放列表', arg: true },
      { id: 'tts', name: '文字转语音', arg: true },
      { id: 'refresh_music_list', name: '刷新播放列表', arg: false },
      { id: 'set_volume', name: '设置音量', arg: true, argType: 'number' },
      { id: 'set_play_type', name: '设置播放类型', arg: true },
      {
        id: 'set_pull_ask',
        name: '设置是否拉取对话记录，每天定时关闭，可缓解风控问题',
        arg: true,
      },
      {
        id: 'reinit',
        name: '重新初始化，每天执行一次可缓解登录失效问题',
        arg: false,
      },
      { id: 'stop', name: '关机', arg: false },
    ],
    playTypes: [
      {
        id: 0,
        name: '单曲循环',
      },
      {
        id: 1,
        name: '全部循环',
      },
      {
        id: 2,
        name: '随机播放',
      },
      {
        id: 3,
        name: '单曲播放',
      },
      {
        id: 4,
        name: '顺序播放',
      },
    ],
    typeIndex: 1, // 默认选择"每天"
    deviceIndex: 0,
    taskIndex: 0,
    taskArg: undefined as string | number | undefined,
    playTypeIndex: 0,
    time: '08:00',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    selectedWeekdays: [false, true, true, true, true, true, false], // 默认选择周一到周五
    schedules: [] as Schedule[],
    nextExecution: {
      date: null as string | null,
      task: '暂无定时任务',
    },
    _settings: {},
  },

  onLoad() {
    this.loadAd();
    this.loadSchedules();
  },

  loadAd() {
    if (!wx.createInterstitialAd) {
      return;
    }
    if (!store.feature.ad) {
      return;
    }
    const interstitialAd = wx.createInterstitialAd({
      adUnitId: 'adunit-8c7b9cad4f6b1d28',
    });
    interstitialAd.onError((err) => {
      console.error('插屏广告加载失败', err);
    });
    interstitialAd.show().catch((err) => {
      console.error('插屏广告显示失败', err);
    });
  },

  // 计算最近一次执行时间
  calculateNextExecution() {
    const { schedules } = this.data;

    if (!schedules || schedules.length === 0) {
      this.setData({
        nextExecution: {
          date: null,
          task: '暂无定时任务',
        },
      });
      return;
    }

    const dates = schedules.map((item) => {
      const cron = CronExpressionParser.parse(item.expression, {
        startDate: new Date(),
      });
      return {
        date: cron.next().toDate(),
        name: item.name,
        arg1: item.arg1,
      };
    });
    const [nextExecution] = dates
      .flat()
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    const find = (id: string) => this.data.tasks.find((item) => item.id === id);
    this.setData({
      nextExecution: nextExecution
        ? {
            date: nextExecution.date.toLocaleString(),
            task: `${find(nextExecution.name)?.name?.split('，')[0] || ''} ${nextExecution.arg1 || ''}`,
          }
        : {
            date: null,
            task: '暂无即将执行的任务',
          },
    });
  },

  // 加载已保存的定时任务
  async loadSchedules() {
    try {
      wx.showLoading({
        title: '加载中',
      });
      const res = await request<{
        devices: Device[];
        crontab_json: string;
      }>({
        url: '/getsetting',
      });
      const schedules = safeJSONParse(res.data.crontab_json, []);
      const devices = Object.values(res.data.devices);
      this.data._settings = res.data;
      this.setData({ schedules, devices });
      this.calculateNextExecution();
    } catch (e) {
      console.error('加载定时任务失败', e);
      wx.showToast({
        title: '加载定时任务失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 保存定时任务到本地存储
  async saveSchedules(schedules: Schedule[]) {
    try {
      wx.showLoading({
        title: '保存中',
      });
      await request({
        url: '/savesetting',
        method: 'POST',
        data: {
          ...this.data._settings,
          crontab_json: JSON.stringify(schedules, null, 2),
        },
      });
    } catch (e) {
      console.error('保存定时任务失败', e);
      wx.showToast({
        title: '保存定时任务失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
    }
  },

  bindDeviceChange(e: any) {
    this.setData({
      deviceIndex: Number(e.detail.value),
    });
  },

  bindTaskChange(e: any) {
    this.setData({
      taskIndex: Number(e.detail.value),
      taskArg: undefined,
    });
  },

  bindTypeChange(e: any) {
    this.setData({
      typeIndex: Number(e.detail.value),
    });
  },

  bindPlayTypeChange(e: any) {
    const val = Number(e.detail.value);
    this.setData({
      playTypeIndex: val,
      taskArg: this.data.playTypes[val].id,
    });
  },

  // 时间选择器变化事件
  bindTimeChange(e: any) {
    this.setData({
      time: e.detail.value,
    });
  },

  // 切换星期几选择
  toggleWeekday(e: any) {
    const index = e.currentTarget.dataset.index;
    const selectedWeekdays = [...this.data.selectedWeekdays];
    selectedWeekdays[index] = !selectedWeekdays[index];

    this.setData({
      selectedWeekdays,
    });
  },

  bindArgChange(e: any) {
    this.setData({ taskArg: e.detail.value });
  },

  // 保存定时播放设置
  async saveSchedule() {
    const { typeIndex, time, selectedWeekdays } = this.data;

    // 解析时间
    const [hours, minutes] = time.split(':').map(Number);

    let cronType: CronType;
    let cronOptions: any = { hours, minutes };

    // 根据类型设置不同的参数
    switch (typeIndex) {
      case 0: // 单次
        // 根据选择的时间自动判断日期
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hours,
          minutes,
        );

        // 如果选择的时间比当前时间早，则设置为明天
        const execDate =
          today <= now
            ? new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1,
                hours,
                minutes,
              )
            : today;

        cronType = CronType.ONCE;
        cronOptions.type = cronType;
        cronOptions.date = execDate;
        break;
      case 1: // 每天
        cronType = CronType.DAILY;
        cronOptions.type = cronType;
        break;
      case 2: // 每周
        cronType = CronType.WEEKLY;
        cronOptions.type = cronType;

        // 获取选中的星期几
        const weekdays = selectedWeekdays
          .map((selected, index) => (selected ? index : -1))
          .filter((index) => index !== -1);

        if (weekdays.length === 0) {
          wx.showToast({
            title: '请至少选择一天',
            icon: 'none',
          });
          return;
        }

        cronOptions.daysOfWeek = weekdays;

        break;
    }

    try {
      const newSchedule: Schedule = {
        did: this.data.devices[this.data.deviceIndex].did,
        name: this.data.tasks[this.data.taskIndex].id,
        arg1: this.data.taskArg,
        expression: generateCron(cronOptions),
      };

      if (newSchedule.name === 'set_pull_ask') {
        newSchedule.arg1 = newSchedule.arg1 ? 'enable' : 'disable';
      }

      const schedules = [...this.data.schedules, newSchedule];

      await this.saveSchedules(schedules);
      this.setData({ schedules });
      this.calculateNextExecution();
    } catch (error) {
      wx.showToast({
        title: `设置失败: ${error.message}`,
        icon: 'none',
      });
    }
  },

  // 删除定时任务
  async deleteSchedule(e: any) {
    const idx = e.currentTarget.dataset.index;
    const schedules = this.data.schedules.filter((_, index) => index !== idx);

    await this.saveSchedules(schedules);
    this.setData({ schedules });
    this.calculateNextExecution();

    wx.showToast({
      title: '已删除',
      icon: 'success',
    });
  },
});
