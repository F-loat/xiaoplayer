import { Device, PlayOrderType } from '@/miniprogram/types';
import { request } from '@/miniprogram/utils';
import { BackendAdapter, MusicInfo, PlayingStatus, ServerInfo } from './interface';

export class XiaomusicAdapter implements BackendAdapter {
  async getServerInfo(): Promise<ServerInfo> {
    const res = await request<{
      detail?: string;
      version?: string;
      devices: Record<string, Device>;
    }>({
      url: '/getsetting',
    });

    const devices = Object.values(res.data.devices || {});

    let version: string | undefined;
    try {
      const versionRes = await request<{ version: string }>({
        url: '/getversion',
      });
      version = versionRes.data.version || undefined;
    } catch {
      // version endpoint may not exist on older builds
    }

    return { devices, version };
  }

  async getMusicList(): Promise<Record<string, string[]>> {
    const res = await request<Record<string, string[]>>({
      url: '/musiclist',
    });
    return res.data;
  }

  async getPlayingStatus(did: string): Promise<PlayingStatus> {
    const res = await request<{
      cur_music: string;
      cur_playlist?: string;
      is_playing: boolean;
      offset: number;
      duration: number;
    }>({
      url: `/playingmusic?did=${did}`,
    });
    return {
      musicName: res.data.cur_music,
      playlist: res.data.cur_playlist,
      isPlaying: res.data.is_playing,
      offset: res.data.offset,
      duration: res.data.duration,
    };
  }

  async getVolume(did: string): Promise<number> {
    const res = await request<{ volume: number }>({
      url: `/getvolume?did=${did}`,
    });
    return res.data.volume;
  }

  async setVolume(did: string, volume: number): Promise<void> {
    await request({
      url: '/setvolume',
      method: 'POST',
      data: { volume, did },
    });
  }

  async playMusic(did: string, name?: string, playlist?: string): Promise<void> {
    if (playlist) {
      await request({
        url: '/playmusiclist',
        method: 'POST',
        data: { did, listname: playlist, musicname: name },
      });
    } else {
      await request({
        url: '/playmusic',
        method: 'POST',
        data: { did, musicname: name, searchkey: name },
      });
    }
  }

  async playUrl(did: string, url: string): Promise<void> {
    await request({
      url: `/playurl?url=${encodeURIComponent(url)}&did=${did}`,
    });
  }

  async getMusicInfo(name: string): Promise<MusicInfo> {
    const res = await request<{
      url?: string;
      tags?: {
        picture?: string;
        album?: string;
        lyric?: string;
      };
    }>({
      url: `/musicinfo?name=${name}&musictag=true`,
    });
    return {
      url: res.data.url,
      cover: res.data.tags?.picture,
      album: res.data.tags?.album,
      lyric: res.data.tags?.lyric,
    };
  }

  async getMusicInfos(
    names: string[],
  ): Promise<{ name: string; cover?: string; album?: string }[]> {
    const params = names.reduce((result, name) => `${result}name=${name}&`, '');
    const res = await request<
      {
        name: string;
        tags: {
          album: string;
          picture: string;
        };
      }[]
    >({
      url: `/musicinfos?${params}musictag=true`,
    });
    if (!Array.isArray(res.data)) return [];
    return res.data.map((item) => ({
      name: item.name,
      cover: item.tags?.picture,
      album: item.tags?.album,
    }));
  }

  async getPlaylistNames(): Promise<string[]> {
    const res = await request<{ names: string[] }>({
      url: '/playlistnames',
    });
    if (res.statusCode !== 200 || !res.data.names) return [];
    return res.data.names;
  }

  async createPlaylist(name: string): Promise<void> {
    await request({
      url: '/playlistadd',
      method: 'POST',
      data: { name },
    });
  }

  async renamePlaylist(oldName: string, newName: string): Promise<void> {
    await request({
      url: '/playlistupdatename',
      method: 'POST',
      data: { oldname: oldName, newname: newName },
    });
  }

  async deletePlaylist(name: string): Promise<void> {
    await request({
      url: '/playlistdel',
      method: 'POST',
      data: { name },
    });
  }

  async addMusicToPlaylist(playlist: string, musicList: string[]): Promise<void> {
    await request({
      url: '/playlistaddmusic',
      method: 'POST',
      data: { name: playlist, music_list: musicList },
    });
  }

  async removeMusicFromPlaylist(
    playlist: string,
    musicList: string[],
  ): Promise<void> {
    await request({
      url: '/playlistdelmusic',
      method: 'POST',
      data: { name: playlist, music_list: musicList },
    });
  }

  async deleteMusic(name: string, did: string): Promise<void> {
    await request({
      url: '/delmusic',
      method: 'POST',
      data: { name, did },
    });
  }

  async setMusicTag(
    name: string,
    tag: {
      title?: string;
      artist?: string;
      album?: string;
      cover?: string;
      lyric?: string;
    },
  ): Promise<void> {
    await request({
      url: '/setmusictag',
      method: 'POST',
      data: { musicname: name, ...tag },
    });
  }

  async sendCommand(cmd: string, did: string): Promise<void> {
    await request({
      url: '/cmd',
      method: 'POST',
      data: { cmd, did },
    });
  }

  async playTts(text: string, did: string): Promise<void> {
    await request({
      url: '/playtts',
      data: { text, did },
    });
  }

  async getCurrentPlaylist(did: string): Promise<string> {
    const res = await request<string>({
      url: '/curplaylist',
      method: 'GET',
      data: { did },
    });
    return res.data;
  }

  async getPlayOrder(_did: string): Promise<PlayOrderType | undefined> {
    // play_type is embedded in the /getsetting devices response; caller handles this
    return undefined;
  }
}
