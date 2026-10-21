# 部署步骤

## A. 先发布可演示网页

1. `npm ci`，执行 `npm run check`。
2. 保持本地默认模式，执行 `npm run build`。
3. 将 `dist/` 上传到任意静态网站托管，启用 HTTPS。路由使用 fragment，分享页不要求额外的 history 路由重写。
4. 用手机打开验证：创建旅行、编辑、记账、打卡、导出海报、复制链接。Safari/微信内置浏览器的下载行为可能不同，可通过系统“分享/保存图片”处理，需真机验收。

没有真实后端时请保留“本地演示”提示。网站地址变更或 localhost 地址不应作为跨设备分享地址；在正式域名上重新生成摘要链接。

## B. 准备 CloudBase

1. 创建独立开发环境；不要复用未知生产数据库。
2. 开启 Web 匿名登录用于联调，并在安全来源/域名中登记实际前端域名和本地调试来源。正式上线应切换到正式身份体系。
3. 创建 [数据库文档](DATABASE.md) 的 8 个集合；为每个集合设置客户端全部拒绝的规则，再开放网页访问。创建对应索引。
4. 配置云存储客户端全部拒绝规则。确认不会覆盖已有环境的其他文件访问需求，因此推荐独立环境。
5. 在云控制台安全填写 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`、`AI_DAILY_LIMIT`。Key 仅存在云函数，不能写 `.env.local` 的 `VITE_` 变量。

## C. 构建与部署云函数

```bash
npm ci
npm run typecheck
npm test
npm run build:cloud
```

上传 `cloudfunctions/api/`，入口 `index.main`，启用云端依赖安装。该目录含独立 package.json 与 package-lock.json，依赖固定的 `@cloudbase/node-sdk`；入口由 esbuild 打包，已包含共享 TS、Zod 和业务实现，无需把整个仓库或 monorepo 相对路径上传。

建议 Node.js 20 或以上受支持运行时、256MB、60 秒超时。`config/cloudbase.example.json` 是部署模板，复制为 Git 忽略的 `config/cloudbase.local.json` 后在本机填写环境 ID。控制台实际支持的运行时标识以当前环境为准；不把模板存在当作已部署成功。

如使用 CloudBase CLI，先按官方文档完成当前工具版本的登录，然后指向私有配置部署；不要把 CLI 凭据放到仓库。部署脚本/工具更新函数变量时可能覆盖已有变量，务必保留模型 Key。本文不要求把 SecretId、SecretKey 传给网页。

模型适配当前使用 OpenAI 兼容 `/chat/completions` + JSON 输出，服务端再做严格 Schema 校验；只有兼容此请求结构的供应商可直接替换。一次调用按天数设置 6000–16000 输出 token，25 秒超时，失败最多重试一次，超出限制返回友好错误，不写正式行程。详细攻略输出更多，长行程可能超出输出/超时限制，可按单日生成；上线前再加入更完整的骨架/逐日后台任务。

## D. 切换网页到云模式

在 Git 忽略的 `.env.local` 中填写：

```dotenv
VITE_DATA_MODE=cloud
VITE_CLOUDBASE_ENV_ID=你的云环境ID
```

重启开发服务器或重新 `npm run build` 后上传 `dist/`。首次匿名登录创建空账号，不自动上传本地示例或私人数据。创建新旅行，再通过“偏好与数据”的邀请码在另一个浏览器加入。

## E. 必须完成的云端验收

- 首次登录返回可信 UID，浏览器不能通过传入 userId 伪造身份。
- 核心集合和文件桶的客户端直读/直写全部拒绝。
- 两个浏览器加入同一旅行；第三个未加入账号不能读写旅行和凭证。
- editor 不能修改其他作者账单或成员角色；viewer 所有写入被拒绝。
- 个人清单隔离；保存公共行程不会覆盖他人个人清单。
- 并发保存仅一个版本成功；冲突侧保留表单，刷新后重新编辑。
- 图片上传、引用归属验证和五分钟展示地址可用。
- 模型成功/超时/无效 JSON，额度上限，缓存隔离，密钥没有出现在网络响应或前端构建中。
- 分享摘要七天到期、撤销后拒绝读取，摘要不含账单细项和个人清单。
- 真实手机海报、下载、二维码扫码、复制链接与在线地图。

本轮未取得 CloudBase 环境、登录授权或模型 Key，以上真实操作**未执行**，不可将本地模拟或构建通过解释为云端验收通过。

## 官方参考

- CloudBase Web SDK：https://docs.cloudbase.net/api-reference/webv2/initialization
- CloudBase Node SDK：https://github.com/TencentCloudBase/node-sdk
- CloudBase 云函数：https://docs.cloudbase.net/cloud-function/introduce
- OpenStreetMap 瓦片使用政策：https://operations.osmfoundation.org/policies/tiles/

在线地图当前用公共 OSM 瓦片，仅在用户主动开启时请求，保留署名，不提供离线瓦片预取。大规模正式运营应选择适合流量和区域的合法地图服务，密钥类服务经后端代理。

## GitHub Pages 演示版

当前仓库的项目路径是 `/-/`，不能使用根路径 `/` 引用资源。已通过 Vite `DEPLOY_BASE_PATH` 和统一图片地址适配子目录。

```bash
npm run deploy:pages
```

此命令显式构建本地演示模式，将 `dist/` 和 `.nojekyll` 推送到 origin 的 `gh-pages` 分支。只上传公开的演示资源，不上传本地浏览器数据、模型密钥、云凭据或服务端部署包；不执行强制推送。

首次需在 GitHub 仓库 Settings → Pages，将 Source 设为 Deploy from a branch，Branch 选 gh-pages，目录 / (root)，保存。只有 Pages 构建成功并能从公网读取后才算部署完成；仅分支推送成功不等于网页已经上线。

在线演示网址为 `https://sn0w051201.github.io/-/`。2026-10-21 已验证公网 HTML、JS、CSS、图片均返回 HTTP 200；从公网获取经 TLS 验证的资源后，桌面/手机浏览器渲染、PNG 下载与只读分享检查均通过。云端 Chromium 对代理 CA 的信任与系统请求客户端不同，因此浏览器检查通过使用现有受信 CA 的请求客户端转送公开资源，未关闭 TLS 验证。大陆网络可达性取决于用户网络，不能保证所有网络都能访问 GitHub Pages。

## Render 一键部署 Node 代理

仓库提供 `render.yaml`，可通过 [Render Blueprint](https://render.com/deploy?repo=https://github.com/Sn0w051201/-) 导入，配置 Node 22、免费实例、健康检查和当前 GitHub Pages 来源。Render 账号需由所有者授权 GitHub 仓库访问；实例可用性和套餐以平台为准。

已有 Web Service 使用：

- Build Command：`npm ci && npm run build`
- Start Command：`npm run start:server`
- Environment：`NODE_VERSION=22`、`ALLOWED_ORIGIN=https://sn0w051201.github.io`

`npm run build` 现在会自动执行 `postbuild → npm run build:server`，同时生成 `dist/` 和 `server-dist/server.mjs`；原来的 `npm install; npm run build` 也会生成后端入口。无需将构建产物提交进 Git。

若自动部署已开启，推送 main 后会重建；否则在 Render 点击 Manual Deploy → Deploy latest commit。`render.yaml` 对新建 Blueprint 生效，不会自动改变已有服务的控制台环境变量。

部署成功后，使用 Render 实际分配的网址访问 `/api/health`，应返回 `{"ok":true}`。前端代理地址填同一网址加 `/api/ai`。域名必须以控制台实际显示为准，不能从服务名称猜测。浏览器使用自己购买的模型 Key 时，服务器无需设置 `LLM_API_KEY` 或 `PROXY_ACCESS_TOKEN`。首次请求可能等待免费实例唤醒。
