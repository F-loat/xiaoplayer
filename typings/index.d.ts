/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    musiclist: Record<string, string[]>;
    serverConfig: {
      domain: string;
      privateDomain?: string;
      publicDomain?: string;
      auth?: boolean;
      username?: string;
      password?: string;
    };
    isPC: boolean;
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
}
