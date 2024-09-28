/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    musiclist: Record<string, string[]>;
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
}

interface ImportMeta {
  env: {
    VITE_CLOUD_ENV?: string;
    VITE_CLOUD_RESOURCE_APPID?: string;
    VITE_CLOUD_RESOURCE_ENV?: string;
  };
}
