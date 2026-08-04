import { PlayOrderType } from '@/miniprogram/types';
import { request } from '@/miniprogram/utils';
import { BackendAdapter, MusicInfo, PlayingStatus, ServerInfo } from './interface';

/**
 * Songloft backend adapter.
 *
 * Songloft is a self-hosted music library server with a REST API under /api/v1.
 * It uses JWT ****** authentication and numeric IDs for songs and playlists.
 *
 * Authentication flow: username/password → POST /api/v1/auth/login → access_token
 * The token is stored in serverConfig.accessToken and sent as "Authorization: ******".
 *
 * Since Songloft has no remote device control (unlike xiaomusic), playback is
 * handled entirely by the host (HostPlayerModule). getServerInfo returns a single
 * virtual device with did='host', so the app always uses local playback mode.
 *
 * Song name → ID mapping is cached in-memory to allow getMusicInfo/getMusicInfos
 * lookups by name (as required by the BackendAdapter interface).
 *
 * API mapping:
 *   getServerInfo        → GET  /api/v1/version  (returns virtual host device)
 *   getMusicList         → GET  /api/v1/playlists + GET /api/v1/playlists/{id}/songs
 *   getPlayingStatus     → no-op (returns default; host player tracks state locally)
 *   getVolume            → no-op (host player manages volume)
 *   setVolume            → no-op
 *   playMusic            → no-op (host player fetches URL via getMusicInfo)
 *   playUrl              → no-op
 *   getMusicInfo         → GET  /api/v1/songs?keyword={name} → /api/v1/songs/{id}/play URL
 *   getMusicInfos        → GET  /api/v1/songs?keyword={name} (per-name)
 *   getPlaylistNames     → GET  /api/v1/playlists
 *   createPlaylist       → POST /api/v1/playlists
 *   renamePlaylist       → PUT  /api/v1/playlists/{id}
 *   deletePlaylist       → DELETE /api/v1/playlists/{id}
 *   addMusicToPlaylist   → POST /api/v1/playlists/{id}/songs
 *   removeMusicFromPlaylist → DELETE /api/v1/playlists/{id}/songs/{songId}
 *   deleteMusic          → DELETE /api/v1/songs/{id}
 *   setMusicTag          → PUT  /api/v1/songs/{id}/tags
 *   sendCommand          → no-op (Songloft has no voice commands)
 *   playTts              → no-op (Songloft has no TTS endpoint)
 *   getCurrentPlaylist   → no-op (returns empty string)
 *   getPlayOrder         → no-op (returns undefined)
 */

interface SongloftSong {
  id: number;
  title: string;
  artist?: string;
  album?: string;
  cover_url?: string;
  duration?: number;
}

interface SongloftPlaylist {
  id: number;
  name: string;
  type?: string;
}

/** Persistent cache mapping song title → numeric ID across adapter instances */
const songIdCache = new Map<string, number>();
/** Persistent cache mapping playlist name → numeric ID */
const playlistIdCache = new Map<string, number>();

export class SongloftAdapter implements BackendAdapter {
  async getServerInfo(): Promise<ServerInfo> {
    await this.ensureAuthenticated();
    try {
      const res = await request<{ version?: string }>({
        url: '/api/v1/version',
      });
      return {
        devices: [],
        version: res.data.version,
      };
    } catch {
      return { devices: [] };
    }
  }

  /** Login with username/password and persist the access token to serverConfig */
  private async ensureAuthenticated(): Promise<void> {
    const serverConfig = wx.getStorageSync('serverConfig') || {};
    if (serverConfig.accessToken) return;
    if (!serverConfig.auth || !serverConfig.username || !serverConfig.password) return;

    const prefix = serverConfig.domain?.startsWith('http') ? '' : 'http://';
    const baseUrl = `${prefix}${serverConfig.domain}`;
    await new Promise<void>((resolve, reject) => {
      wx.request({
        url: `${baseUrl}/api/v1/auth/login`,
        method: 'POST',
        data: {
          username: serverConfig.username,
          password: serverConfig.password,
        },
        success: (res: any) => {
          const token = res.data?.access_token;
          if (!token) {
            reject(new Error('登录失败：未获取到 Token'));
            return;
          }
          const newConfig = { ...serverConfig, accessToken: token };
          wx.setStorageSync('serverConfig', newConfig);
          resolve();
        },
        fail: reject,
      });
    });
  }

  async getMusicList(): Promise<Record<string, string[]>> {
    const allSongs = await this.fetchAllSongNames();

    const playlistsRes = await request<{
      playlists: SongloftPlaylist[];
      total: number;
    }>({
      url: '/api/v1/playlists',
      data: { limit: 200, offset: 0 },
    });

    const playlists = playlistsRes.data.playlists || [];
    const result: Record<string, string[]> = {
      所有歌曲: allSongs,
    };

    for (const pl of playlists) {
      playlistIdCache.set(pl.name, pl.id);
      try {
        const songsRes = await request<{
          songs: SongloftSong[];
          total: number;
        }>({
          url: `/api/v1/playlists/${pl.id}/songs`,
          data: { limit: 1000, offset: 0 },
        });
        const songs = songsRes.data.songs || [];
        songs.forEach((s) => songIdCache.set(s.title, s.id));
        result[pl.name] = songs.map((s) => s.title);
      } catch {
        result[pl.name] = [];
      }
    }

    return result;
  }

  /** Fetch all song titles from the library (handles pagination) */
  private async fetchAllSongNames(): Promise<string[]> {
    const pageSize = 500;
    let offset = 0;
    const names: string[] = [];

    while (true) {
      const res = await request<{ songs: SongloftSong[]; total: number }>({
        url: '/api/v1/songs',
        data: { limit: pageSize, offset },
      });
      const songs = res.data.songs || [];
      songs.forEach((s) => songIdCache.set(s.title, s.id));
      names.push(...songs.map((s) => s.title));
      offset += songs.length;
      if (offset >= (res.data.total || 0) || !songs.length) break;
    }

    return names;
  }

  /** Look up song ID by title, using cache or API search */
  private async getSongId(title: string): Promise<number | undefined> {
    if (songIdCache.has(title)) return songIdCache.get(title);

    const res = await request<{ songs: SongloftSong[]; total: number }>({
      url: '/api/v1/songs',
      data: { keyword: title, limit: 10, offset: 0 },
    });
    const songs = res.data.songs || [];
    songs.forEach((s) => songIdCache.set(s.title, s.id));
    const exact = songs.find((s) => s.title === title);
    return exact?.id;
  }

  /** Look up playlist ID by name, using cache or API search */
  private async getPlaylistId(name: string): Promise<number | undefined> {
    if (playlistIdCache.has(name)) return playlistIdCache.get(name);

    const res = await request<{ playlists: SongloftPlaylist[]; total: number }>(
      {
        url: '/api/v1/playlists',
        data: { keyword: name, limit: 50, offset: 0 },
      },
    );
    const playlists = res.data.playlists || [];
    playlists.forEach((p) => playlistIdCache.set(p.name, p.id));
    const exact = playlists.find((p) => p.name === name);
    return exact?.id;
  }

  async getPlayingStatus(_did: string): Promise<PlayingStatus> {
    return {
      musicName: '',
      isPlaying: false,
      offset: 0,
      duration: 0,
    };
  }

  async getVolume(_did: string): Promise<number> {
    return 80;
  }

  async setVolume(_did: string, _volume: number): Promise<void> {}

  async playMusic(
    _did: string,
    _name?: string,
    _playlist?: string,
  ): Promise<void> {}

  async playUrl(_did: string, _url: string): Promise<void> {}

  async getMusicInfo(name: string): Promise<MusicInfo> {
    const id = await this.getSongId(name);
    if (!id) return {};

    const res = await request<SongloftSong & { cover_url?: string }>({
      url: `/api/v1/songs/${id}`,
    });
    const song = res.data;

    const serverConfig = wx.getStorageSync('serverConfig') || {};
    const domain = serverConfig.domain || '';
    const prefix = domain.startsWith('http') ? '' : 'http://';
    const tokenParam = serverConfig.accessToken
      ? `?access_token=${encodeURIComponent(serverConfig.accessToken)}`
      : '';
    const playUrl = `${prefix}${domain}/api/v1/songs/${id}/play${tokenParam}`;
    const coverUrl = song.cover_url
      ? `${prefix}${domain}/api/v1/songs/${id}/cover${tokenParam}`
      : undefined;

    return {
      url: playUrl,
      cover: coverUrl,
      album: song.album,
    };
  }

  async getMusicInfos(
    names: string[],
  ): Promise<{ name: string; cover?: string; album?: string }[]> {
    const serverConfig = wx.getStorageSync('serverConfig') || {};
    const domain = serverConfig.domain || '';
    const prefix = domain.startsWith('http') ? '' : 'http://';
    const tokenParam = serverConfig.accessToken
      ? `?access_token=${encodeURIComponent(serverConfig.accessToken)}`
      : '';

    const results: { name: string; cover?: string; album?: string }[] = [];

    for (const name of names) {
      const id = await this.getSongId(name);
      if (!id) {
        results.push({ name });
        continue;
      }
      try {
        const res = await request<SongloftSong>({
          url: `/api/v1/songs/${id}`,
        });
        const coverUrl = res.data.cover_url
          ? `${prefix}${domain}/api/v1/songs/${id}/cover${tokenParam}`
          : undefined;
        results.push({
          name,
          cover: coverUrl,
          album: res.data.album,
        });
      } catch {
        results.push({ name });
      }
    }

    return results;
  }

  async getPlaylistNames(): Promise<string[]> {
    const res = await request<{
      playlists: SongloftPlaylist[];
      total: number;
    }>({
      url: '/api/v1/playlists',
      data: { limit: 200, offset: 0 },
    });
    const playlists = res.data.playlists || [];
    playlists.forEach((p) => playlistIdCache.set(p.name, p.id));
    return playlists.map((p) => p.name);
  }

  async createPlaylist(name: string): Promise<void> {
    const res = await request<SongloftPlaylist>({
      url: '/api/v1/playlists',
      method: 'POST',
      data: { type: 'normal', name },
    });
    if (res.data.id) playlistIdCache.set(name, res.data.id);
  }

  async renamePlaylist(oldName: string, newName: string): Promise<void> {
    const id = await this.getPlaylistId(oldName);
    if (!id) return;
    await request({
      url: `/api/v1/playlists/${id}`,
      method: 'PUT',
      data: { name: newName },
    });
    playlistIdCache.delete(oldName);
    playlistIdCache.set(newName, id);
  }

  async deletePlaylist(name: string): Promise<void> {
    const id = await this.getPlaylistId(name);
    if (!id) return;
    await request({
      url: `/api/v1/playlists/${id}`,
      method: 'DELETE',
    });
    playlistIdCache.delete(name);
  }

  async addMusicToPlaylist(
    playlist: string,
    musicList: string[],
  ): Promise<void> {
    const playlistId = await this.getPlaylistId(playlist);
    if (!playlistId) return;
    const songIds: number[] = [];
    for (const name of musicList) {
      const id = await this.getSongId(name);
      if (id) songIds.push(id);
    }
    if (!songIds.length) return;
    await request({
      url: `/api/v1/playlists/${playlistId}/songs`,
      method: 'POST',
      data: { song_ids: songIds },
    });
  }

  async removeMusicFromPlaylist(
    playlist: string,
    musicList: string[],
  ): Promise<void> {
    const playlistId = await this.getPlaylistId(playlist);
    if (!playlistId) return;
    for (const name of musicList) {
      const songId = await this.getSongId(name);
      if (!songId) continue;
      await request({
        url: `/api/v1/playlists/${playlistId}/songs/${songId}`,
        method: 'DELETE',
      });
    }
  }

  async deleteMusic(name: string, _did: string): Promise<void> {
    const id = await this.getSongId(name);
    if (!id) return;
    await request({
      url: `/api/v1/songs/${id}`,
      method: 'DELETE',
    });
    songIdCache.delete(name);
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
    const id = await this.getSongId(name);
    if (!id) return;
    const data: Record<string, string | undefined> = {};
    if (tag.title !== undefined) data.title = tag.title;
    if (tag.artist !== undefined) data.artist = tag.artist;
    if (tag.album !== undefined) data.album = tag.album;
    if (tag.cover !== undefined) data.cover_url = tag.cover;
    await request({
      url: `/api/v1/songs/${id}/tags`,
      method: 'PUT',
      data,
    });
    if (tag.title && tag.title !== name) {
      const cachedId = songIdCache.get(name);
      if (cachedId) {
        songIdCache.delete(name);
        songIdCache.set(tag.title, cachedId);
      }
    }
  }

  async sendCommand(_cmd: string, _did: string): Promise<void> {}

  async playTts(_text: string, _did: string): Promise<void> {}

  async getCurrentPlaylist(_did: string): Promise<string> {
    return '';
  }

  async getPlayOrder(_did: string): Promise<PlayOrderType | undefined> {
    return undefined;
  }
}
