import { store } from '../stores';
import { weBtoa } from './base64';

interface RequestParams {
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
}

let cachedCloudInstance: Promise<WxCloud>;

const getSharedCloudInstance = async () => {
  const cloud = new wx.cloud.Cloud({
    resourceAppid: import.meta.env.VITE_CLOUD_RESOURCE_APPID,
    resourceEnv: import.meta.env.VITE_CLOUD_RESOURCE_ENV,
  });
  await cloud.init();
  return cloud;
};

const getHostedCloudInstance = () => {
  const callFunction = ({
    name,
    data,
    success,
    fail,
    complete,
  }: {
    name: string;
    data: RequestParams & {
      headers: {
        Authorization?: string;
      };
    };
    success: (res: any) => void;
    fail: (err: any) => void;
    complete: () => void;
  }) => {
    wx.request({
      ...data,
      url: `${import.meta.env.VITE_CLOUD_HOSTED_SERVER}/${name}`,
      header: data.headers,
      method: data.method || 'POST',
      data,
      success: (res) => {
        if (res.statusCode !== 200) return fail(res);
        success({ result: res.data });
      },
      fail,
      complete,
    });
  };
  return Promise.resolve({
    callFunction,
  }) as Promise<WxCloud>;
};

export const getCloudInstance = () => {
  if (cachedCloudInstance) {
    return cachedCloudInstance;
  }
  if (import.meta.env.VITE_CLOUD_ENV) {
    wx.cloud.init({
      env: import.meta.env.VITE_CLOUD_ENV,
    });
    cachedCloudInstance = Promise.resolve(wx.cloud);
    return cachedCloudInstance;
  } else if (import.meta.env.VITE_CLOUD_RESOURCE_ENV) {
    cachedCloudInstance = getSharedCloudInstance();
  } else if (import.meta.env.VITE_CLOUD_HOSTED_SERVER) {
    cachedCloudInstance = getHostedCloudInstance();
  } else {
    throw new Error('服务配置缺失');
  }
  return cachedCloudInstance;
};

export const request = <T>({ url, method, data, timeout }: RequestParams) => {
  const header: {
    Authorization?: string;
  } = {};
  const serverConfig = store
    ? store.serverConfig
    : wx.getStorageSync('serverConfig');
  const { domain, privateDomain, auth, username, password } =
    serverConfig || {};
  if (!domain) return Promise.reject('domain error');
  if (auth && username && password) {
    header.Authorization = `Basic ${weBtoa(username + ':' + password)}`;
  }
  return new Promise<{ data: T; statusCode: number }>(
    async (resolve, reject) => {
      const prefix = domain.startsWith('http') ? '' : 'http://';
      const options = {
        url: `${prefix}${domain}${url}`,
        method,
        data,
        timeout,
      };
      if (domain === privateDomain) {
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
