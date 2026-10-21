# 来源与许可

## 设计参考

- SusanJay2004/travel-ledger-wechat-miniprogram（同行账本）：https://github.com/SusanJay2004/travel-ledger-wechat-miniprogram ，参考整数分、稳定余数、业务分层和幂等设计。本项目本轮未复制其源码。此前核查的版本为 8acffb9fc7a25eab965191f44d1d7d67c76f5f88。
- MoodNomad 产品要求来自用户上传的开发方案；网页前端采用 React/TypeScript，而非原方案的微信原生前端。

## 运行依赖

React/React DOM、Vite、TypeScript、Zod、CloudBase JavaScript SDK / Node SDK、Leaflet、lucide-react、node-qrcode 等依赖的许可请查看锁定版本包内 LICENSE。开发依赖包括 Vitest、Playwright 和 esbuild。第三方软件不因被引用而改变其原始许可。

地图采用 Leaflet；用户主动打开在线地图时使用 OpenStreetMap，保留地图内 © OpenStreetMap contributors 署名。地图数据适用 ODbL，公共瓦片另受使用政策约束。不得批量离线下载公共瓦片。

`public/images/lake.png` 是本次为 MoodNomad 生成的旅行灵感配图，不是摄影作品或景点实拍。页面、海报均不应将其描述为大理/杭州真实地点证据。

项目未引入无明确代码许可的旅游演示仓库、品牌图标或真实票据/用户资料。

## 升级版摄影与地图

发现页本地摄影素材是风景参考，不声称拍摄于卡片对应城市：

| 文件                                      | 原始来源                                                                                                                                                              | 许可来源                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `images/discover/mountains.jpg`           | [Next.js image-component 示例](https://github.com/vercel/next.js/tree/canary/examples/image-component/public)                                                         | 仓库 MIT，原文存于 `public/licenses/next.txt`                           |
| `hills.jpg` / `forest.jpg` / `valley.jpg` | [Start Bootstrap Grayscale](https://github.com/StartBootstrap/startbootstrap-grayscale/tree/master/dist/assets/img)，对应 bg-masthead / demo-image-01 / demo-image-02 | 仓库 MIT，`public/licenses/grayscale.txt`；项目注明摄影来自 Unsplash    |
| `ocean.jpg`                               | [Start Bootstrap Landing Page](https://github.com/StartBootstrap/startbootstrap-landing-page/tree/master/dist/assets/img/bg-masthead.jpg)                             | 仓库 MIT，`public/licenses/landing-page.txt`；项目注明摄影来自 Unsplash |

摄影的品牌、肖像、商标权不因代码许可获得额外授权；保留原始来源，不将其作为城市实拍或平台背书。下载时保留 TLS 验证，素材按原文件发布未修改。

`src/data/world-paths.json` 从 [Natural Earth 1:110m admin 0 countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) 外环坐标转换为 SVG 路径，公共领域（https://www.naturalearthdata.com/about/terms-of-use/），用于足迹示意。

新增依赖：Tailwind CSS / @tailwindcss/vite（MIT）、Recharts（MIT）、Prettier（MIT 开发工具）。天气由 Open-Meteo Forecast API 提供，页面保留署名；使用政策见 https://open-meteo.com/en/terms 。目的地编辑资料为本项目维护的旅行参考，不等于实时旅游信息。
