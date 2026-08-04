import { Device, PlayOrderType } from '@/miniprogram/types';

export interface MusicInfo {
  url?: string;
  cover?: string;
  album?: string;
  lyric?: string;
}

export interface PlayingStatus {
  musicName: string;
  playlist?: string;
  isPlaying: boolean;
  offset: number;
  duration: number;
}

export interface ServerInfo {
  devices: Device[];
  version?: string;
}

/**
 * Backend adapter interface — all backend-specific API calls go through here.
 * Implement this interface to add a new backend (e.g. songloft).
 */
export interface BackendAdapter {
  /** Fetch devices and server version on startup */
  getServerInfo(): Promise<ServerInfo>;

  /** Fetch the flat music library: map of playlist name → song names */
  getMusicList(): Promise<Record<string, string[]>>;

  /** Get current playing status for a device */
  getPlayingStatus(did: string): Promise<PlayingStatus>;

  /** Get volume for a device (0-100) */
  getVolume(did: string): Promise<number>;

  /** Set volume for a device (0-100) */
  setVolume(did: string, volume: number): Promise<void>;

  /** Play a song, optionally from a playlist */
  playMusic(did: string, name?: string, playlist?: string): Promise<void>;

  /** Play a URL on a device */
  playUrl(did: string, url: string): Promise<void>;

  /** Fetch metadata (url, cover, lyric) for a single song */
  getMusicInfo(name: string): Promise<MusicInfo>;

  /** Batch-fetch cover/album metadata for multiple songs */
  getMusicInfos(
    names: string[],
  ): Promise<{ name: string; cover?: string; album?: string }[]>;

  /** Fetch the names of custom playlists */
  getPlaylistNames(): Promise<string[]>;

  /** Create a custom playlist */
  createPlaylist(name: string): Promise<void>;

  /** Rename a custom playlist */
  renamePlaylist(oldName: string, newName: string): Promise<void>;

  /** Delete a custom playlist */
  deletePlaylist(name: string): Promise<void>;

  /** Add songs to a playlist */
  addMusicToPlaylist(playlist: string, musicList: string[]): Promise<void>;

  /** Remove songs from a playlist */
  removeMusicFromPlaylist(playlist: string, musicList: string[]): Promise<void>;

  /** Delete a song file from the library */
  deleteMusic(name: string, did: string): Promise<void>;

  /** Save a music tag to the backend */
  setMusicTag(
    name: string,
    tag: {
      title?: string;
      artist?: string;
      album?: string;
      cover?: string;
      lyric?: string;
    },
  ): Promise<void>;

  /** Send a plain-text command to a device (xiaomusic specific, may be no-op) */
  sendCommand(cmd: string, did: string): Promise<void>;

  /** Text-to-speech on a device */
  playTts(text: string, did: string): Promise<void>;

  /** Get current playlist for a device */
  getCurrentPlaylist(did: string): Promise<string>;

  /** Get play order for a device */
  getPlayOrder(did: string): Promise<PlayOrderType | undefined>;
}
