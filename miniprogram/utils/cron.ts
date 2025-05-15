/**
 * Cron表达式生成器
 * 支持生成以下类型的cron表达式：
 * 1. 单次执行：指定具体的时间点执行一次
 * 2. 每天执行：在每天的特定时间执行
 * 3. 每周几执行：在每周的特定几天的特定时间执行
 */

/**
 * Cron表达式类型
 */
export enum CronType {
  /** 单次执行 */
  ONCE = 'once',
  /** 每天执行 */
  DAILY = 'daily',
  /** 每周执行 */
  WEEKLY = 'weekly',
}

/**
 * Cron表达式生成器参数
 */
export interface CronOptions {
  /** 类型：单次/每天/每周 */
  type: CronType;
  /** 小时(0-23) */
  hours: number;
  /** 分钟(0-59) */
  minutes: number;
  /** 单次执行时的日期 (仅当type为ONCE时需要) */
  date?: Date;
  /** 每周执行的星期几 (仅当type为WEEKLY时需要)，0-6表示周日到周六，可以是单个数字或数字数组 */
  daysOfWeek?: number | number[];
}

/**
 * 检查时间是否有效
 * @param hours 小时(0-23)
 * @param minutes 分钟(0-59)
 */
const isValidTime = (hours: number, minutes: number): boolean => {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
};

/**
 * 检查日期是否有效
 * @param date 日期对象
 */
const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * 检查星期几是否有效
 * @param dayOfWeek 星期几(0-6，0表示周日)
 */
const isValidDayOfWeek = (dayOfWeek: number): boolean => {
  return Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6;
};

/**
 * 生成Cron表达式
 * @param options Cron表达式生成器参数
 * @returns cron表达式
 *
 * @example
 * // 单次执行：2024年1月1日 10:30 执行一次
 * generateCron({
 *   type: CronType.ONCE,
 *   hours: 10,
 *   minutes: 30,
 *   date: new Date(2024, 0, 1)
 * });
 *
 * // 每天执行：每天 8:15 执行
 * generateCron({
 *   type: CronType.DAILY,
 *   hours: 8,
 *   minutes: 15
 * });
 *
 * // 每周一执行：每周一 9:00 执行
 * generateCron({
 *   type: CronType.WEEKLY,
 *   hours: 9,
 *   minutes: 0,
 *   daysOfWeek: 1
 * });
 *
 * // 每周一三五执行：每周一、三、五 14:30 执行
 * generateCron({
 *   type: CronType.WEEKLY,
 *   hours: 14,
 *   minutes: 30,
 *   daysOfWeek: [1, 3, 5]
 * });
 */
export const generateCron = (options: CronOptions): string => {
  const { type, hours, minutes } = options;

  // 验证时间
  if (!isValidTime(hours, minutes)) {
    throw new Error('Invalid time: hours must be 0-23, minutes must be 0-59');
  }

  switch (type) {
    case CronType.ONCE: {
      // 单次执行需要日期
      if (!options.date || !isValidDate(options.date)) {
        throw new Error('Date is required and must be valid for ONCE type');
      }

      const year = options.date.getFullYear();
      const month = options.date.getMonth() + 1;
      const day = options.date.getDate();

      return `${minutes} ${hours} ${day} ${month} * ${year}`;
    }

    case CronType.DAILY: {
      // 每天执行只需要时间
      return `${minutes} ${hours} * * *`;
    }

    case CronType.WEEKLY: {
      // 每周执行需要星期几
      if (options.daysOfWeek === undefined) {
        throw new Error('daysOfWeek is required for WEEKLY type');
      }

      // 处理单个星期几或星期几数组
      let daysOfWeekStr: string;

      if (Array.isArray(options.daysOfWeek)) {
        // 验证数组中的每个值
        if (
          options.daysOfWeek.length === 0 ||
          !options.daysOfWeek.every(isValidDayOfWeek)
        ) {
          throw new Error('Invalid days of week: each day must be 0-6');
        }

        // 对星期几进行排序并去重
        const uniqueSortedDays = [...new Set(options.daysOfWeek)].sort(
          (a, b) => a - b,
        );
        daysOfWeekStr = uniqueSortedDays.join(',');
      } else {
        // 验证单个值
        if (!isValidDayOfWeek(options.daysOfWeek)) {
          throw new Error('Invalid day of week: must be 0-6');
        }

        daysOfWeekStr = options.daysOfWeek.toString();
      }

      return `${minutes} ${hours} * * ${daysOfWeekStr}`;
    }

    default:
      throw new Error(`Unsupported cron type: ${type}`);
  }
};
