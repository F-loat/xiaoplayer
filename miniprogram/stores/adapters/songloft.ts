import { PlayOrderType } from '@/miniprogram/types';
import { request } from '@/miniprogram/utils';
import { BackendAdapter, MusicInfo, PlayingStatus, ServerInfo } from './interface';

/**
 * Songloft backend adapter.
 *
 * API mapping (songloft endpoints):
 *   getServerInfo     → GET /api/devices
 *   getMusicList      → GET /api/library
 *   getPlayingStatus  → GET /api/player/status?deviceId=
 *   getVolume         → GET /api/player/volume?deviceId=
 *   setVolume         → POST /api/player/volume
 *   playMusic         → POST /api/player/play
 *   playUrl           → POST /api/player/play (with url field)
 *   getMusicInfo      → GET /api/songs/:id
 *   getMusicInfos     → GET /api/songs/batch?ids=
 *   getPlaylistNames  → GET /api/playlists
 *   createPlaylist    → POST /api/playlists
 *   renamePlaylist    → PUT /api/playlists/:name
 *   deletePlaylist    → DELETE /api/playlists/:name
 *   addMusicToPlaylist    → POST /api/playlists/:name/songs
 *   removeMusicFromPlaylist → DELETE /api/playlists/:name/songs
 *   deleteMusic       → DELETE /api/songs/:name
 *   setMusicTag       → PUT /api/songs/:name/tags
 *   sendCommand       → no-op (songloft does not use voice commands)
 *   playTts           → POST /api/tts
 *   getCurrentPlaylist → GET /api/player/playlist?deviceId=
 */
export class SongloftAdapter implements BackendAdapter {
  async getServerInfo(): Promise<ServerInfo> {
    const res = await request<{
      devices: { id: string; name: string; model: string }[];
      version?: string;
    }>({
      url: '/api/devices',
    });
    const devices = (res.data.devices || []).map((d) => ({
      did: d.id,
      name: d.name,
      hardware: d.model || 'songloft',
    }));
    return { devices, version: res.data.version };
  }

  async getMusicList(): Promise<Record<string, string[]>> {
    const res = await request<{
      playlists: { name: string; songs: string[] }[];
    }>({
      url: '/api/library',
    });
    return (res.data.playlists || []).reduce(
      (acc, pl) => {
        acc[pl.name] = pl.songs;
        return acc;
      },
      {} as Record<string, string[]>,
    );
  }

  async getPlayingStatus(did: string): Promise<PlayingStatus> {
    const res = await request<{
      song?: string;
      playlist?: string;
      playing: boolean;
      position: number;
      duration: number;
    }>({
      url: `/api/player/status?deviceId=${did}`,
    });
    return {
      musicName: res.data.song || '',
      playlist: res.data.playlist,
      isPlaying: res.data.playing,
      offset: res.data.position,
      duration: res.data.duration,
    };
  }

  async getVolume(did: string): Promise<number> {
    const res = await request<{ volume: number }>({
      url: `/api/player/volume?deviceId=${did}`,
    });
    return res.data.volume;
  }

  async setVolume(did: string, volume: number): Promise<void> {
    await request({
      url: '/api/player/volume',
      method: 'POST',
      data: { deviceId: did, volume },
    });
  }

  async playMusic(did: string, name?: string, playlist?: string): Promise<void> {
    await request({
      url: '/api/player/play',
      method: 'POST',
      data: { deviceId: did, song: name, playlist },
    });
  }

  async playUrl(did: string, url: string): Promise<void> {
    await request({
      url: '/api/player/play',
      method: 'POST',
      data: { deviceId: did, url },
    });
  }

  async getMusicInfo(name: string): Promise<MusicInfo> {
    const res = await request<{
      url?: string;
      cover?: string;
      album?: string;
      lyric?: string;
    }>({
      url: `/api/songs/${encodeURIComponent(name)}`,
    });
    return {
      url: res.data.url,
      cover: res.data.cover,
      album: res.data.album,
      lyric: res.data.lyric,
    };
  }

  async getMusicInfos(
    names: string[],
  ): Promise<{ name: string; cover?: string; album?: string }[]> {
    const ids = names.map(encodeURIComponent).join('&ids=');
    const res = await request<
      { name: string; cover?: string; album?: string }[]
    >({
      url: `/api/songs/batch?ids=${ids}`,
    });
    return Array.isArray(res.data) ? res.data : [];
  }

  async getPlaylistNames(): Promise<string[]> {
    const res = await request<{ names: string[] }>({
      url: '/api/playlists',
    });
    return res.data.names || [];
  }

  async createPlaylist(name: string): Promise<void> {
    await request({
      url: '/api/playlists',
      method: 'POST',
      data: { name },
    });
  }

  async renamePlaylist(oldName: string, newName: string): Promise<void> {
    await request({
      url: `/api/playlists/${encodeURIComponent(oldName)}`,
      method: 'PUT',
      data: { name: newName },
    });
  }

  async deletePlaylist(name: string): Promise<void> {
    await request({
      url: `/api/playlists/${encodeURIComponent(name)}`,
      method: 'DELETE',
    });
  }

  async addMusicToPlaylist(playlist: string, musicList: string[]): Promise<void> {
    await request({
      url: `/api/playlists/${encodeURIComponent(playlist)}/songs`,
      method: 'POST',
      data: { songs: musicList },
    });
  }

  async removeMusicFromPlaylist(
    playlist: string,
    musicList: string[],
  ): Promise<void> {
    await request({
      url: `/api/playlists/${encodeURIComponent(playlist)}/songs`,
      method: 'DELETE',
      data: { songs: musicList },
    });
  }

  async deleteMusic(name: string, _did: string): Promise<void> {
    await request({
      url: `/api/songs/${encodeURIComponent(name)}`,
      method: 'DELETE',
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
      url: `/api/songs/${encodeURIComponent(name)}/tags`,
      method: 'PUT',
      data: tag,
    });
  }

  // Songloft does not support plain-text voice commands
  async sendCommand(_cmd: string, _did: string): Promise<void> {}

  async playTts(text: string, did: string): Promise<void> {
    await request({
      url: '/api/tts',
      method: 'POST',
      data: { text, deviceId: did },
    });
  }

  async getCurrentPlaylist(did: string): Promise<string> {
    const res = await request<{ playlist: string }>({
      url: `/api/player/playlist?deviceId=${did}`,
    });
    return res.data.playlist || '';
  }

  async getPlayOrder(_did: string): Promise<PlayOrderType | undefined> {
    return undefined;
  }
}
