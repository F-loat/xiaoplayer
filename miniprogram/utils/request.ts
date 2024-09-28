import { isPrivateDomain } from '.';
import { store } from '../stores';

const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// btoa
const weBtoa = function (string: string) {
  string = String(string);
  let bitmap,
    a,
    b,
    c,
    result = '',
    i = 0,
    rest = string.length % 3;

  for (; i < string.length; ) {
    if (
      (a = string.charCodeAt(i++)) > 255 ||
      (b = string.charCodeAt(i++)) > 255 ||
      (c = string.charCodeAt(i++)) > 255
    )
      throw new TypeError(
        "Failed to execute 'btoa' on 'Window': The string to be encoded contains characters outside of the Latin1 range.",
      );

    bitmap = (a << 16) | (b << 8) | c;
    result +=
      b64.charAt((bitmap >> 18) & 63) +
      b64.charAt((bitmap >> 12) & 63) +
      b64.charAt((bitmap >> 6) & 63) +
      b64.charAt(bitmap & 63);
  }

  return rest ? result.slice(0, rest - 3) + '==='.substring(rest) : result;
};

let cachedCloudInstance: Promise<WxCloud>;

const getSharedCloudInstance = async () => {
  const cloud = new wx.cloud.Cloud({
    resourceAppid: import.meta.env.VITE_CLOUD_RESOURCE_APPID,
    resourceEnv: import.meta.env.VITE_CLOUD_RESOURCE_ENV,
  });
  await cloud.init();
  return cloud;
};

const getCloudInstance = () => {
  if (cachedCloudInstance) {
    return cachedCloudInstance;
  }
  if (import.meta.env.VITE_CLOUD_ENV) {
    wx.cloud.init({
      env: import.meta.env.VITE_CLOUD_ENV,
    });
    cachedCloudInstance = Promise.resolve(wx.cloud);
    return cachedCloudInstance;
  }
  cachedCloudInstance = getSharedCloudInstance();
  return cachedCloudInstance;
};

export const request = <T>({
  url,
  method,
  data,
  timeout,
}: {
  url: string;
  method?:
    | 'OPTIONS'
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'DELETE'
    | 'TRACE'
    | 'CONNECT';
  data?: any;
  timeout?: number;
}) => {
  const header: {
    Authorization?: string;
  } = {};
  const { domain, username, password } = store.serverConfig;
  if (!domain) return Promise.reject('domain error');
  if (username && password) {
    header.Authorization = `Basic ${weBtoa(username + ':' + password)}`;
  }
  return new Promise<{ data: T; statusCode: number }>(
    async (resolve, reject) => {
      const options = {
        url: `http://${domain}${url}`,
        method,
        data,
        timeout,
      };
      if (isPrivateDomain(domain)) {
        wx.request({
          ...options,
          header,
          success: resolve,
          fail: reject,
        });
      } else {
        const cloud = await getCloudInstance();
        cloud.callFunction({
          name: 'proxy',
          data: {
            ...options,
            headers: header,
          },
          success: (res) =>
            resolve({
              data: res.result as T,
              statusCode: 200,
            }),
          fail: reject,
        });
      }
    },
  );
};
