## 卯卯音乐

> [xiaomusic](https://github.com/hanxi/xiaomusic) 小程序客户端，使用小爱音箱播放本地/NAS音乐

原生小程序开发，采用 Skyline 渲染模式，支持全局工具栏及自定义路由效果，感谢由 [weapp-vite](https://github.com/weapp-vite/weapp-vite) 及 [weapp-tailwindcss](https://github.com/sonofmagic/weapp-tailwindcss) 提供的开箱即用的现代化开发体验

## 功能特性

- 全局工具栏
- 自定义路由
- 逐字歌词
- 后台播放
- 倍速播放
- 暗色模式
- 封面主题色
- 歌曲刮削
- 定时任务配置

## 预览

### 小程序码

<p>
  <img alt="weapp" src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/weappcode.jpg" width="24%" />
</p>

### 截图

<p>
  <img src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/screenshot/5.png" width="24%" />
  <img src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/screenshot/6.png" width="24%" />
  <img src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/screenshot/7.png" width="24%" />
  <img src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/xiaoplayer/screenshot/8.png" width="24%" />
</p>

## 运行

1. 克隆仓库

```sh
git clone https://github.com/F-loat/xiaoplayer.git
```

2. 安装依赖

```sh
pnpm install
```

3. 运行项目

```sh
pnpm dev
```

4. 预览效果

使用微信开发者工具导入项目

## FAQ

### 是否支持公网连接

支持，IP 及域名方式均可使用，建议开启 xiaomusic 的密码登陆，开启后通过 `user:pass@ip:port` 格式配置服务地址

注：账号密码为 xiaomusic 后台配置，非小米账号；未开启密码登陆直接使用 `ip:port` 配置服务地址即可

### 网络异常，请在局域网环境下使用

小程序局域网连接有如下限制，部分设备连接失败可更换端口尝试

- 允许与局域网内的非本机 IP 通信
- 允许与配置过的服务器域名通信，详见相关说明
- 禁止与以下端口号连接：1024 以下 1099 1433 1521 1719 1720 1723 2049 2375 3128 3306 3389 3659 4045 5060 5061 5432 5984 6379 6000 6566 7001 7002 8000-8100 8443 8888 9200 9300 10051 10080 11211 27017 27018 27019
  每 5 分钟内最多创建 20 个 TCPSocket

## 赞赏

> Tip: 点击小程序设置页面底部 5 次可关闭小程序内部广告

<p>
  <img alt="赞赏码" src="https://assets-1251785959.cos.ap-beijing.myqcloud.com/reward.png" width="24%" />
</p>
