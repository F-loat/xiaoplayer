import { store } from '../stores';

export const getGlobalData = (key: keyof IAppOption['globalData']) => {
  return getApp().globalData?.[key];
};

export const setGlobalData = (
  key: keyof IAppOption['globalData'],
  value: any,
) => {
  const { globalData } = getApp();
  if (globalData) globalData[key] = value;
};

export const noop = () => {};

const formatNumber = (n: number) => {
  const s = n.toString();
  return s[1] ? s : '0' + s;
};

export const formatTime = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    [year, month, day].map(formatNumber).join('/') +
    ' ' +
    [hour, minute, second].map(formatNumber).join(':')
  );
};

export const isPrivateDomain = (domain: string) => {
  const ip = domain.split(':')[0];
  const privateIPRegex =
    /^(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2[0-9]|3[0-1])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})$/;
  return privateIPRegex.test(ip);
};

export const sleep = (time?: number) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), time);
  });
};

export const parseAuthUrl = (url: string) => {
  const values = url.split('@');
  if (values.length <= 1) {
    const domain = values[0];
    const isPrivate = isPrivateDomain(domain);
    return {
      domain,
      [isPrivate ? 'privateDomain' : 'publicDomain']: domain,
    };
  }
  const [account, domain] = values;
  const [username, password] = account.split(':');
  const isPrivate = isPrivateDomain(domain);
  return {
    domain,
    [isPrivate ? 'privateDomain' : 'publicDomain']: domain,
    auth: !!username && !!password,
    username,
    password,
  };
};

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
  return new Promise<{ data: T; statusCode: number }>((resolve, reject) => {
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
      wx.cloud.callFunction({
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
  });
};
