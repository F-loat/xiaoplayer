import { generateCron, CronType } from '../../utils/index';

// 定义定时任务接口
interface Schedule {
  id: string;
  type: CronType;
  time: string;
  date?: string;
  weekdays?: number[];
  cron: string;
}

Page({
  data: {
    types: ['单次', '每天', '每周'],
    typeIndex: 1, // 默认选择"每天"
    time: '08:00',
    date: '',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    selectedWeekdays: [false, true, true, true, true, true, false], // 默认选择周一到周五
    schedules: [] as Schedule[],
    nextExecution: '暂无定时任务', // 最近执行时间
  },

  onLoad() {
    // 设置默认日期为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.setData({
      date: `${year}-${month}-${day}`,
    });

    // 加载已保存的定时任务
    this.loadSchedules();
    this.calculateNextExecution();
  },

  // 计算最近一次执行时间
  calculateNextExecution() {
    const { schedules } = this.data;
    if (!schedules || schedules.length === 0) {
      this.setData({ nextExecution: '暂无定时任务' });
      return;
    }

    const now = new Date();
    let nextExecTime = '';
    let closestTime = Infinity;

    schedules.forEach((schedule) => {
      const [hours, minutes] = schedule.time.split(':').map(Number);
      let nextExecDate = new Date();

      switch (schedule.type) {
        case CronType.ONCE:
          if (schedule.date) {
            const [year, month, day] = schedule.date.split('-').map(Number);
            nextExecDate = new Date(year, month - 1, day, hours, minutes);
            if (nextExecDate > now && nextExecDate.getTime() < closestTime) {
              closestTime = nextExecDate.getTime();
              nextExecTime = `${schedule.date} ${schedule.time}`;
            }
          }
          break;

        case CronType.DAILY:
          nextExecDate.setHours(hours, minutes, 0, 0);
          if (nextExecDate <= now) {
            nextExecDate.setDate(nextExecDate.getDate() + 1);
          }
          if (nextExecDate.getTime() < closestTime) {
            closestTime = nextExecDate.getTime();
            const month = String(nextExecDate.getMonth() + 1).padStart(2, '0');
            const day = String(nextExecDate.getDate()).padStart(2, '0');
            nextExecTime = `${nextExecDate.getFullYear()}-${month}-${day} ${schedule.time}`;
          }
          break;

        case CronType.WEEKLY:
          if (schedule.weekdays) {
            const today = now.getDay(); // 0是周日
            let daysToAdd = 0;
            let found = false;

            // 查找下一个符合条件的星期几
            for (let i = 0; i < 7; i++) {
              const checkDay = (today + i) % 7;
              if (schedule.weekdays.includes(checkDay)) {
                daysToAdd = i;
                found = true;
                break;
              }
            }

            if (found) {
              nextExecDate.setDate(nextExecDate.getDate() + daysToAdd);
              nextExecDate.setHours(hours, minutes, 0, 0);
              if (nextExecDate.getTime() < closestTime) {
                closestTime = nextExecDate.getTime();
                const month = String(nextExecDate.getMonth() + 1).padStart(
                  2,
                  '0',
                );
                const day = String(nextExecDate.getDate()).padStart(2, '0');
                nextExecTime = `${nextExecDate.getFullYear()}-${month}-${day} ${schedule.time}`;
              }
            }
          }
          break;
      }
    });

    this.setData({
      nextExecution: nextExecTime || '暂无即将执行的任务',
    });
  },

  // 加载已保存的定时任务
  loadSchedules() {
    try {
      const schedules = wx.getStorageSync('schedules') || [];
      this.setData({ schedules });
    } catch (e) {
      console.error('加载定时任务失败', e);
      wx.showToast({
        title: '加载定时任务失败',
        icon: 'none',
      });
    }
  },

  // 保存定时任务到本地存储
  saveSchedulesToStorage(schedules: Schedule[]) {
    try {
      wx.setStorageSync('schedules', schedules);
    } catch (e) {
      console.error('保存定时任务失败', e);
      wx.showToast({
        title: '保存定时任务失败',
        icon: 'none',
      });
    }
  },

  // 定时类型选择器变化事件
  bindTypeChange(e: any) {
    this.setData({
      typeIndex: Number(e.detail.value),
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

  // 保存定时播放设置
  saveSchedule() {
    const { typeIndex, time, date, selectedWeekdays } = this.data;

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

        const year = execDate.getFullYear();
        const month = String(execDate.getMonth() + 1).padStart(2, '0');
        const day = String(execDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        cronType = CronType.ONCE;
        cronOptions.type = cronType;
        cronOptions.date = execDate;
        this.setData({ date: dateStr }); // 更新日期
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
      // 生成cron表达式
      const cron = generateCron(cronOptions);

      // 创建新的定时任务
      const newSchedule: Schedule = {
        id: Date.now().toString(),
        type: cronType,
        time,
        cron,
      };

      if (cronType === CronType.ONCE) {
        // 使用我们在case 0中计算的dateStr
        const dateStr = this.data.date;
        newSchedule.date = dateStr;
      } else if (cronType === CronType.DAILY) {
        // 计算下次执行时间
        const nextDate = new Date();
        nextDate.setHours(hours, minutes, 0, 0);
        if (nextDate <= new Date()) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      } else if (cronType === CronType.WEEKLY) {
        newSchedule.weekdays = cronOptions.daysOfWeek;

        // 计算下次执行时间
        const now = new Date();
        const today = now.getDay(); // 0是周日
        let daysToAdd = 0;
        let found = false;

        // 查找下一个符合条件的星期几
        for (let i = 0; i < 7; i++) {
          const checkDay = (today + i) % 7;
          if (cronOptions.daysOfWeek.includes(checkDay)) {
            daysToAdd = i;
            found = true;
            break;
          }
        }

        if (found) {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + daysToAdd);
          nextDate.setHours(hours, minutes, 0, 0);

          // 如果计算出的时间已经过去，则加7天
          if (nextDate <= now) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
      }

      // 添加到定时任务列表
      const schedules = [...this.data.schedules, newSchedule];
      this.setData({ schedules });

      // 保存到本地存储
      this.saveSchedulesToStorage(schedules);

      wx.showToast({
        title: '定时播放已设置',
        icon: 'success',
      });
      this.calculateNextExecution();
    } catch (error) {
      wx.showToast({
        title: `设置失败: ${error.message}`,
        icon: 'none',
      });
    }
  },

  // 删除定时任务
  deleteSchedule(e: any) {
    const id = e.currentTarget.dataset.id;
    const schedules = this.data.schedules.filter((item) => item.id !== id);

    this.setData({ schedules });
    this.saveSchedulesToStorage(schedules);

    wx.showToast({
      title: '已删除',
      icon: 'success',
    });
  },
});
