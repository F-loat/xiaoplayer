'use strict';

require('dotenv').config();

const axios = require('axios');

let cached_token = '';

const request = (api, token, data) =>
  axios({
    method: 'POST',
    url: `${process.env.MUSIC_TAG_SERVER}/api/${api}/`,
    headers: {
      authorization: `jwt ${token}`,
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'content-type': 'application/json',
    },
    data: JSON.stringify(data),
  });

const updateToken = async () => {
  const { data } = await request('token', '', {
    username: process.env.MUSIC_TAG_USERNAME,
    password: process.env.MUSIC_TAG_PASSWORD,
  });
  cached_token = data.token;
  return data.token;
};

const getSong = (item, resource) => ({
  id: item.id,
  resource: item.resource || resource,
  name: item.name,
  artist: item.artist,
  album: item.album,
  album_img: item.album_img,
  year: item.year,
});

exports.main = async (
  { title, artist, album, resource = 'qmusic' },
  context,
  callback,
) => {
  try {
    const token = await (cached_token || updateToken());
    const { data: musics } = await request('fetch_id3_by_title', token, {
      title,
      artist,
      album,
      resource,
    });

    const song = musics.data.find((m) => m.is_lyric);

    if (!song) {
      callback(null, getSong(song, resource));
      return;
    }

    const { data: lyric } = await request('fetch_lyric', token, {
      song_id: song.id,
      resource: song.resource || resource,
    });

    callback(null, {
      ...getSong(song, resource),
      lyric: lyric.data,
    });
  } catch (err) {
    console.log(err);
    if (err.status === 401) {
      updateToken();
    }
    callback(null, {
      name: title,
      artist,
      album,
      err,
    });
  }
};
