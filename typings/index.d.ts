/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    musiclist: Record<string, string[]>;
    serverConfig: {
      domain: string;
      username?: string;
      password?: string;
    };
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
}
