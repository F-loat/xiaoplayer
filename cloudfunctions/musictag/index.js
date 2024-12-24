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

exports.main = async (
  { title, artist, album, resource = 'qmusic', mode },
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

    if (mode === 'list') {
      const slicedMusics = musics.data.slice(0, 10);
      const lyrics = await Promise.all(
        slicedMusics.map((item) =>
          request('fetch_lyric', token, {
            song_id: item.id,
            resource: item.resource || resource,
          }),
        ),
      );
      callback(
        null,
        slicedMusics.map((item, index) => ({
          ...item,
          lyric: lyrics[index]?.data?.data,
        })),
      );
      return;
    }

    const song = musics.data.find((m) => m.is_lyric);

    const { data: lyric } = await request('fetch_lyric', token, {
      song_id: song.id,
      resource: song.resource || resource,
    });

    callback(null, {
      name: song.name,
      year: song.year,
      artist: song.artist,
      album: song.album,
      album_img: song.album_img,
      lyric: lyric.data,
    });
  } catch (err) {
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
