# 数据库集合与权限

## MVP 存储选择

本地模式以 `moodnomad-web-v1` 键保存经版本化的状态。云模式为保证旅行保存的事务/版本一致性，**采用小团队聚合文档**：`trips` 内嵌成员、活动、账单、分摊与清单。这与原方案独立 `expenses` / `expense_splits` 等集合的规划不同，是此网页 MVP 的明确取舍，不声称已实现完整独立集合架构。

限制：每旅行最多 20 人、14 天、每天 8 项活动、100 笔账单、200 项清单，校验后文档序列化大小不超过 900KB。文件单独存储，仅保留引用。后续超过这些规模时应拆分集合并迁移事务/查询层，不能直接提高文档上限。

## 集合

| 集合 | 主键与主要字段 | 用途 |
|---|---|---|
| `users` | `_id=可信UID`, `name`, `createdAt` | 昵称资料；不保存原始模型密钥 |
| `trips` | `_id=id`, `ownerId`, `memberIds[]`, `members[]`, `days[]`, `expenses[]`, `checklist[]`, `version`, `budgetMinor` | 旅行聚合；memberIds 只由服务端维护 |
| `invitations` | `_id=SHA256(token)`, `tripId`, `createdBy`, `expiresAt`, `revoked` | 192 位随机邀请码、七天有效；令牌不保存明文 |
| `shares` | `_id=SHA256(token)`, `tripId`, `snapshot`, `expiresAt`, `revoked` | 只含选定摘要、七天有效；创建者可撤销 |
| `receipts` | `_id=SHA256(fileID)`, `fileId`, `tripId`, `createdBy`, `createdAt` | 服务端验证凭证与旅行归属 |
| `ai_usage` | `_id=SHA256(UID+日期)`, `userId`, `date`, `count` | 按用户每日请求上限，含失败尝试 |
| `ai_cache` | `_id=SHA256(UID+inputHash)`, `result`, `expiresAt` | 五分钟、按用户隔离的结构化结果缓存 |
| `ai_jobs` | 自动 ID, `userId`, `inputHash`, `promptVersion`, `model`, `status`, `durationMs`, `createdAt` | 生成记录；不写完整密钥或票据；当前为请求内执行，不是持久化后台任务队列 |

`expenses[].amountMinor`、`shares` 的指定金额、活动 `costMinor`、预算 `budgetMinor` 均为整数分。

账单：`id`, `idempotencyKey`, `createdBy`, `payerId`, `participantIds`, `splitType`, `shares`, `amountMinor`, `category`, `date`, `note`, 可选 `receipt`。

清单：`id`, `title`, `category`, `assigneeId`, `dueDate`, `private`, `createdBy`, `done`。

结清记录：`settledSignature` 绑定当前账单内容。它只是“全员已确认”的快照标记，不写回真实支付，不抵扣成员余额；修改账单后旧标记自动失效。MVP 暂未实现逐笔转账确认历史。

## 安全规则

将 `config/database-rules.json` 中每个集合对应的规则分别配置到云数据库；该文件是规则目录，不是单条可直接粘贴的规则。

```json
{"read":false,"write":false}
```

所有核心集合客户端直读直写均禁止，只通过可信云函数校验身份和业务权限。`config/storage-rules.json` 同样禁止客户端直接读写整个文件桶；云函数管理端负责上传和临时 URL。

- owner：旅行信息、成员角色、活动、账单、清单及撤销分享。
- editor：活动/公共清单，可增加与自己有关的账单，仅修改自己的账单；不能改旅行归属或角色。
- viewer：只读，不允许业务写入或上传。
- 个人清单只对其作者返回。服务端保存时合并被隐藏的其他成员个人清单，防止整文档覆盖导致丢失。
- 新增真实成员走邀请码，不能通过客户端改写成员 UID。
- 凭证属于某旅行，只有该旅行成员可以请求该账单的短期展示 URL。
- 分享摘要不返回 UID、账单细项、个人清单、凭证、精确坐标。

推荐索引见 `config/database-indexes.json`；`_id` 主键索引由平台提供。控制台字段需按自身版本的索引配置界面转换，不将示例 JSON 当成已自动应用的结果。

## 仍需真实环境验证

事务冲突、匿名身份注入、数组成员查询索引、五分钟云存储 URL、七天分享失效、多账号拒绝矩阵，以及回收过期分享/邀请码/缓存和孤立凭证。删除账单目前只去掉凭证引用，不自动删除文件；上线前补回收任务与旅行/账号删除流程。

## 网页升级的本地字段

AppState 增加可选 `favorites`, `customDestinations`, `destinationEdits`, `hiddenDestinations`, `feed`, `preferences.theme`；Trip 增加可选 `visited`, `photos`，Expense 增加可选 `estimateId`。费用预估从活动推导，绝不自动写成实际支出。照片压缩 JPEG 保存在本地，JSON 备份包含照片；模型 Key/代理令牌用独立浏览器键存储，不进入备份。

本地模式总数据上限4.5MB，云端旅行文档仍保持900KB。新增照片墙仅本地可用；未实现照片同步。发现收藏/主题云同步待接入，原数据库规则不因此放宽。
