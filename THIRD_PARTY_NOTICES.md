# 来源与许可

## 设计参考

- SusanJay2004/travel-ledger-wechat-miniprogram（同行账本）：https://github.com/SusanJay2004/travel-ledger-wechat-miniprogram ，参考整数分、稳定余数、业务分层和幂等设计。本项目本轮未复制其源码。此前核查的版本为 8acffb9fc7a25eab965191f44d1d7d67c76f5f88。
- MoodNomad 产品要求来自用户上传的开发方案；网页前端采用 React/TypeScript，而非原方案的微信原生前端。

## 运行依赖

React/React DOM、Vite、TypeScript、Zod、CloudBase JavaScript SDK / Node SDK、Leaflet、lucide-react、node-qrcode 等依赖的许可请查看锁定版本包内 LICENSE。开发依赖包括 Vitest、Playwright 和 esbuild。第三方软件不因被引用而改变其原始许可。

地图采用 Leaflet；用户主动打开在线地图时使用 OpenStreetMap，保留地图内 © OpenStreetMap contributors 署名。地图数据适用 ODbL，公共瓦片另受使用政策约束。不得批量离线下载公共瓦片。

`public/images/lake.png` 是本次为 MoodNomad 生成的旅行灵感配图，不是摄影作品或景点实拍。页面、海报均不应将其描述为大理/杭州真实地点证据。

项目未引入无明确代码许可的旅游演示仓库、品牌图标或真实票据/用户资料。
