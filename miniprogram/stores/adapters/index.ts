export type { BackendAdapter, MusicInfo, PlayingStatus, ServerInfo } from './interface';
export { XiaomusicAdapter } from './xiaomusic';
export { SongloftAdapter } from './songloft';

import { BackendType } from '@/miniprogram/types';
import { BackendAdapter } from './interface';
import { XiaomusicAdapter } from './xiaomusic';
import { SongloftAdapter } from './songloft';

export function createAdapter(type?: BackendType): BackendAdapter {
  if (type === 'songloft') {
    return new SongloftAdapter();
  }
  return new XiaomusicAdapter();
}
