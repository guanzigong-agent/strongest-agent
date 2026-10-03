# 最强nba人贩子

手机优先的NBA球员交易网页游戏：访问球队、买入球员、换队卖出，经营30天。

- [公开试玩](https://guanzigong-agent.github.io/strongest-agent/)
- [源代码](https://github.com/guanzigong-agent/strongest-agent)

## 当前公开版本

2026-10-03用户确认M3前端并授权发布。当前发布可玩的前端原型：真实名单与工资、模拟行情、页面内交易及排行榜演示。

- 三档初始资金：轻松3000万、标准1000万、挑战500万美元；背包均为15人。
- 30支球队、620名球员；616人有可用的当季基本工资，4人工资待核实、暂不可交易。
- 买卖不耗时间，移动到另一队推进一天；同日报价固定，第30天仍可交易和结算。
- 模拟报价以2026–27基本工资为基准，范围30%～250%，移动后刷新。其他队只能查看到访时的历史报价。
- 资产按现金加持仓统一参考价值计算，排除当地球队需求溢价。
- 三个难度分别排行；本人资产随交易和移动更新，其他玩家明确标为演示，真实多人服务尚未接入。

本版刷新或关闭页面会重置进度。历史表现、年龄、伤病、潜力的估值模型、正式存档和云端成绩服务留待后续实现。具体行情分布属于试玩参数，不代表真实NBA报价。详见[公开数据说明](docs/public-data-sources.md)和[排行榜设计](docs/leaderboard-design.md)。

## 本地运行

需要 Node.js 20 或更新版本，无需安装产品依赖。

```powershell
npm start
```

打开 http://127.0.0.1:4173/ 。请使用 HTTP 服务，直接双击 HTML 会受到浏览器模块与数据读取限制。

## 验证与发布

```powershell
npm test
npm run validate
node scripts/build-site.mjs
```

前两项验证保留的旧版引擎与历史数据。当前前端的浏览器检查为 `scripts/prototype-smoke.mjs`、`scripts/leaderboard-smoke.mjs`；发布包和仓库子路径检查为 `scripts/site-smoke.mjs`。浏览器脚本通过 `PLAYWRIGHT_MODULE` 和 `TEST_BROWSER` 指定本机Playwright及浏览器路径，不使用桌面控制。`SITE_URL` 可用于检查实际部署网址。

GitHub Actions在推送到 `develop` 或 `main` 时构建并发布Pages。构建仅复制明确列出的公开资源到 `output/site/`；数据库原文件、采集缓存、浏览器截图、任务上下文和凭据不进入Pages包。源码仓库公开，生成文件及本机执行记录由 `.gitignore` 排除。

## 保留的旧版

本地 `/legacy.html` 保留2025–26历史回放及旧规则（1500万美元、5人容量、70%～130%报价和浏览器存档），用于原有测试和迁移参考。它不进入当前Pages发布包。旧版资料见[历史数据说明](docs/data-sources.md)。

## 后续维护

本游戏在当前维护对话持续开发。新增功能按“需求讨论、前端展示、用户确认、工程实现、测试验收”推进。真实数据库由游戏开发总控维护，本游戏只读已交付的快照。
