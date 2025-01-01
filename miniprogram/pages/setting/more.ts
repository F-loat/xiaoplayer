import { store } from '@/miniprogram/stores';
import { request } from '@/miniprogram/utils';
import { ComponentWithStore } from 'mobx-miniprogram-bindings';

ComponentWithStore({
  data: {
    formData: {} as {
      account: string;
      password: string;
      enable_save_tag: boolean;
      pull_ask: boolean;
      device_all: boolean;
      use_music_api: string;
      continue_play: string;
      delay_sec: string;
      keywords_play: string;
      keywords_stop: string;
      auth: boolean;
      httpauth_password: string;
      httpauth_username: string;
    },
    _settings: {} as {
      port: number;
      mi_did: string;
      device_list: {
        miotDID: string;
      }[];
    },
  },
  storeBindings: [
    {
      store,
      fields: ['version'] as const,
      actions: [] as const,
    },
    {
      store: store.feature,
      fields: ['musicScrape'] as const,
      actions: [] as const,
    },
  ],
  lifetimes: {
    async attached() {
      setTimeout(() => {
        if (!this.data._settings.port) {
          wx.showLoading({
            title: '加载中',
          });
        }
      }, 600);
      const { data } = await request<any>({
        url: '/getsetting?need_device_list=true',
      });
      this.data._settings = data;
      this.setData({
        formData: {
          account: data.account,
          password: data.password,
          enable_save_tag: data.enable_save_tag,
          pull_ask: !!data.pull_ask_sec,
          device_all:
            !data.device_list?.length ||
            data.device_list?.length === Object.keys(data.devices).length,
          use_music_api: data.use_music_api,
          continue_play: data.continue_play,
          delay_sec: data.delay_sec,
          keywords_play: data.keywords_play,
          keywords_stop: data.keywords_stop,
          auth: !data.disable_httpauth,
          httpauth_password: data.httpauth_password,
          httpauth_username: data.httpauth_username,
        },
      });
      wx.hideLoading();
    },
    detached() {
      wx.hideLoading();
    },
  },
  methods: {
    handleFormChange(e: {
      currentTarget: {
        dataset: {
          name: string;
        };
      };
      detail: {
        value: string;
      };
    }) {
      const { name } = e.currentTarget.dataset;
      if (!name) return;
      this.setData({
        formData: {
          ...this.data.formData,
          [name]: e.detail.value,
        },
      });
    },
    async handleSaveConfig() {
      wx.showLoading({
        title: '保存中',
      });
      const { formData, _settings } = this.data;
      await request({
        url: '/savesetting',
        method: 'POST',
        data: {
          ..._settings,
          ...formData,
          pull_ask_sec: formData.pull_ask ? 1 : 0,
          mi_did: formData.device_all
            ? _settings.device_list?.map((item) => item.miotDID).join(',')
            : _settings.mi_did,
          disable_httpauth: !formData.auth,
          device_list: undefined,
          devices: undefined,
          key_match_order: undefined,
          key_word_dict: undefined,
          user_key_word_dict: undefined,
        },
      });
      store.setServerConfig({
        ...store.serverConfig,
        auth: formData.auth,
        username: formData.httpauth_username,
        password:
          formData.httpauth_password === '******'
            ? store.serverConfig.password
            : formData.httpauth_password,
      });
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'none',
      });
      await store.initSettings();
      wx.reLaunch({ url: '/pages/index/index' });
    },
  },
});
