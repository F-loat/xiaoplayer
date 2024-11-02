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

export interface Device {
  name: string;
  did: string;
  cur_playlist?: string;
  cur_music?: string;
  hardware: string;
  play_type?: PlayOrderType;
}

export enum GestureState {
  POSSIBLE = 0,
  BEGIN = 1,
  ACTIVE = 2,
  END = 3,
  CANCELLED = 4,
}
