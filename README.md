# 最强nba人贩子

手机优先的NBA球员交易网页游戏：访问球队、买入球员、换队卖出，经营30天。

- [公开试玩](https://guanzigong-agent.github.io/strongest-agent/)
- [源代码](https://github.com/guanzigong-agent/strongest-agent)

## M4成绩保存版本

2026-10-03，用户最后回复“界面可以，就这样”，确认起名与结算入榜流程。已实现本地真实SQLite成绩服务及玩家页面：昵称必填；每次买卖/移动后同步资产；结算成绩留在所选难度；刷新恢复、失败重试、不同浏览器读取均已验证。每局作为独立记录保留，昵称仅作显示名，不代表登录账号；清理浏览器数据会丢失该局恢复凭证，已上传成绩不删除。

服务端重放操作流水，不直接接受资产分数。局写入密钥、规则/名单版本、历史流水前缀和数据库版本条件更新保护记录。浏览器用存档和单写锁防止多个标签覆盖；异常存档重开前留备份。尚无正式账户、跨设备继续同一局或完整反作弊/反滥用体系。

用户已选择Sites托管排行榜API和D1数据库，GitHub Pages继续托管游戏页面。云端20项真实跨域/API检查已通过，三难度保存、服务端重算、重复提交及越权校验正常，3条验收记录已清理。M4页面已上线，实际公网22项成绩流程与18项入口/交易/布局检查全部通过；测试记录清理完成。

## 玩法与数据

真实名单与工资、模拟行情、游戏内交易及按难度保存的玩家成绩。M4流程于2026-10-03获用户确认。

- 三档初始资金：轻松3000万、标准1000万、挑战500万美元；背包均为15人。
- 30支球队、620名球员；616人有可用的当季基本工资，4人工资待核实、暂不可交易。
- 买卖不耗时间，移动到另一队推进一天；同日报价固定，第30天仍可交易和结算。
- 模拟报价以2026–27基本工资为基准，范围30%～250%，移动后刷新。其他队只能查看到访时的历史报价。
- 资产按现金加持仓统一参考价值计算，排除当地球队需求溢价。
- 三个难度分别排行；起名必填，本人资产随交易和移动更新，结算后保留。榜单读取真实成绩，不添加演示玩家。

本机存档支持刷新恢复，已提交成绩保存在云端。历史表现、年龄、伤病、潜力的估值模型留待后续实现。具体行情分布属于试玩参数，不代表真实NBA报价。详见[公开数据说明](docs/public-data-sources.md)和[排行榜设计](docs/leaderboard-design.md)。

## 本地运行

本地M4成绩服务使用 Node.js 24 的内置SQLite；当前验证版本为24.16。无需安装产品依赖。

```powershell
npm start
```

另开终端运行 `npm run start:scores`，启动 http://127.0.0.1:4174/api 的本地持久成绩服务。默认数据库在忽略目录 `output/ranking/scores.sqlite`，仅监听本机。

打开 http://127.0.0.1:4173/ 。请使用 HTTP 服务，直接双击 HTML 会受到浏览器模块与数据读取限制。

## 验证与发布

```powershell
npm test
npm run validate
node scripts/build-site.mjs
```

`npm test`目前33项，其中M4规则、API和客户端存档15项；其余及validate覆盖保留旧版。当前真实成绩浏览器检查为 `scripts/score-smoke.mjs`（22项），`scripts/leaderboard-smoke.mjs`为其兼容入口；`scripts/prototype-smoke.mjs`覆盖39项玩法；发布包和仓库子路径检查为 `scripts/site-smoke.mjs`，旧缓存跨版本检查为 `scripts/cache-smoke.mjs`。浏览器脚本通过 `PLAYWRIGHT_MODULE` 和 `TEST_BROWSER` 指定本机Playwright及浏览器路径，不使用桌面控制。`SITE_URL` 可用于检查实际部署网址。

GitHub Actions在推送到 `develop` 或 `main` 时构建并发布Pages。构建仅复制明确列出的公开资源到 `output/site/`；数据库原文件、采集缓存、浏览器截图、任务上下文和凭据不进入Pages包。源码仓库公开，生成文件及本机执行记录由 `.gitignore` 排除。

构建按内容生成版本标识，入口及资源请求带版本参数，避免新版页面继续使用旧脚本缓存。已打开的旧页面可通过带新版本参数的根入口进入新版。

## 保留的旧版

本地 `/legacy.html` 保留2025–26历史回放及旧规则（1500万美元、5人容量、70%～130%报价和浏览器存档），用于原有测试和迁移参考。它不进入当前Pages发布包。旧版资料见[历史数据说明](docs/data-sources.md)。

## 后续维护

本游戏在当前维护对话持续开发。新增功能按“需求讨论、前端展示、用户确认、工程实现、测试验收”推进。真实数据库由游戏开发总控维护，本游戏只读已交付的快照。

## 排行榜维护

云API：`https://strongest-agent-rankings.guanzigong.chatgpt.site/api`。Sites源代码位于本机独立托管检出 `services/leaderboard/`，该目录在GitHub仓库中忽略；Sites保存其独立源码历史。身份和部署记录见 `docs/hosting-status.json`。

修改游戏共用规则或排行服务后，将 `src/prototype/rules.mjs`、`src/prototype/roster.json`、`server/ranking.mjs`同步到该检出对应路径，重建和验证Worker，再用既有Sites项目发布。schema变更生成追加的Drizzle迁移，不修改已应用迁移；只做代码修改时不用重新生成migration。规则或名单更新须隔离版本。
