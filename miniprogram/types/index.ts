export enum PlayOrderType {
  One = 0, // 单曲循环
  All = 1, // 全部循环
  Rnd = 2, // 随机播放
}

export interface ServerConfig {
  domain: string;
  privateDomain?: string;
  publicDomain?: string;
  auth?: boolean;
  username?: string;
  password?: string;
}
