/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    musiclist: Record<string, string[]>;
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
}

declare const process = {} as {
  env: {
    WX_CLOUD_ENV: string;
  };
};
