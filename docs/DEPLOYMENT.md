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

模型适配当前使用 OpenAI 兼容 `/chat/completions` + JSON 输出，服务端再做严格 Schema 校验；只有兼容此请求结构的供应商可直接替换。网页逐日调用，每次只生成一天，`totalDays` 为全程天数、`dayOffset` 指定当前日期；上下文保留已生成路线以便衔接。单次输出上限8000–16000 token（DeepSeek最多8192），45秒模型超时，只有可修正格式/质量或平台5xx最多重试一次；进度与已通过校验的日期保存在客户端草稿中。此流程不是云端持久化后台任务：离开规划页面会停止后续日期；刷新或关闭浏览器不能保证取得当前在途请求的结果，已经保存的日期仍可恢复。

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

### 浏览器显示 Failed to fetch

这是浏览器无法读取 HTTP 响应，不足以判断模型 Key 无效。常见原因是 CORS 预检被拒绝、服务未启动、Render 正在唤醒或网络不可达。

HTTP 代理现在从公开模板 `config/web-deployment.json` 读取本项目默认前端来源；已有 Render 服务未填写 `ALLOWED_ORIGIN` 也允许 `https://sn0w051201.github.io`。显式环境变量仍优先；变量值必须是来源，不能包含 `/-/` 路径。可信的 `RENDER_EXTERNAL_URL` 和服务同源也可访问；无关来源仍返回403，不使用通配符，服务器 Key 仍需令牌。

`/api/health` 返回 `{"ok":true,"service":"moodnomad-proxy","version":2}`，可用于确认新版本已部署。网页区分网络、超时、模型授权、代理响应格式和攻略结构错误；网络失败提供健康检查入口，不要求重新配置 Key。客户端等待上限120秒，允许免费实例冷启动，但不自动重发可能收费的生成请求。

### 代理已连接但“生成失败”

新版本不再统一屏蔽为“检查模型配置或缩短天数”：`/api/ai` 返回固定、安全的错误码与说明。`KEY_INVALID`=模型平台401，`MODEL_QUOTA`=余额/额度不足（包含OpenAI的429 insufficient_quota），`MODEL_FORBIDDEN`=权限或地区，`MODEL_NOT_FOUND`=模型名称/权限，`MODEL_RATE_LIMIT`=频率限制，`MODEL_PARAMETERS`=参数不支持，`MODEL_TIMEOUT`=等待模型超时，`MODEL_OUTPUT_LIMIT`=输出被截断，`MODEL_OUTPUT_FORMAT/QUALITY`=结构或内容校验未通过。上游原始报文和密钥不会返回前端。

身份、余额、权限、参数、限流、超时和明确截断不重复调用；平台5xx或可修正的格式/质量错误最多重试一次，后者附加修正要求。DeepSeek输出参数限制8192 token，避免默认5天请求超出其参数范围；OpenAI上限16000。仅在明确截断时建议缩短天数。健康检查新增 `modelDiagnostics:true` 标记，便于确认部署了诊断版本。

OpenAI API 与 ChatGPT Plus/Pro 独立计费；网页选择OpenAI时使用的是 OpenAI 官方 API 域名，第三方中转平台的Key不能当作官方Key使用。没有真实凭据时测试使用模拟上游，不宣称已经验证用户账号或实际计费状态。

### 模型已返回内容，但行程结构校验失败

OpenAI 默认 `gpt-4o-mini`、GPT-4o 当前别名/已知结构化快照、GPT-4.1 家族使用严格 JSON Schema 约束字段、类型与枚举；其他模型和 DeepSeek/通义千问继续使用 JSON object 模式。Schema 从同一套 Zod 领域结构生成，不单独复制业务字段；不支持的长度/范围关键字写入描述，由服务端 Zod 再严格校验。

适配层只做可确定的表示转换：未知坐标 `null` → 不保存坐标，`9:05` → `09:05`，整数数字字符串 → 同单位整数，丢弃模型附加的 id/done/元数据。`costMinor:"1234"` 仍是1234分；缺失金额、空金额、带货币符号/小数金额、非法坐标和时间仍拒绝，不把缺失费用默认为零。说明超长时不截断内容，要求模型修正。

最多一次格式修正携带上次回复（40KB以内）及具体字段位置/长度限制；不保存原始回复、不记录密钥。仍失败时，网页提示例如“行程天数/第1项/活动/第1项/推荐详情/推荐理由：超出上限250”，不回显用户或模型的原始文字。保存后的行程依然经过原有严格校验，费用预估不会成为实际支出。健康检查的 `structuredPlans:true` 表示已部署本修复。

### 多日攻略超过单次输出上限

网页改用顺序逐日请求，不再将整份5—14天攻略放进一个模型输出。每个请求的 `days=1`，携带全程 `totalDays`、当前 `dayOffset` 和原路线/已完成路线摘要；按整数分稳定分配每日预算及余数，全部完成后再合并并验证全程预算和内容覆盖。单日提示要求简洁完整，仍保留三餐、游玩、茶歇、夜间活动、理由、交通、预约与备选。

草稿键 `moodnomad-ai-plan-draft-v1` 最多保存最近一份、7天有效，记录输入、公开模型/代理身份、旅程范围与已通过校验的日期，不含配置里的Key或令牌。优先localStorage、其次sessionStorage，均不可用时暂存内存并提醒。失败/刷新可继续未完成日期；完成草稿可直接恢复查看。多标签页使用 Web Locks 串行协调，缺少该API时在本页面排队。停止操作会等当前日期返回并保存，随后停止；不能承诺取消已经发给模型的费用。

保存旅行成功、恢复示例或导入备份时清除草稿；丢弃草稿不会删除正式旅行。前端的新请求字段需要同时部署本次后端；健康检查 `dailyPlanning:true` 表示已支持逐日协议。CloudBase 模式也按天计入 `AI_DAILY_LIMIT`，长行程或多次追问可能触及原有每日限额，可由管理员合理设置，不在客户端绕过。

### 精细攻略接口升级

部署新前端时同步更新Render或CloudBase后端。Render在服务页选择 **Manual Deploy → Deploy latest commit**，构建用 `npm ci && npm run build`，启动用 `npm run start:server`。公开健康检查 `/api/health` 应含 `completeHandbook:true`；已有模型密钥、CORS和代理地址配置继续使用。该标志只表示接口版本，不代表模型余额或配置有效。

完整攻略默认需要每天一次及4组手册请求，失败继续不会重复已保存结果。保留现有每分钟12次请求限制，达到限流时稍后继续；CloudBase管理员需确认 `AI_DAILY_LIMIT` 足够本人需求与费用预算。未提供真实API凭据时，可先用离线参考验证完整展示、下载、保存和清单流程。
