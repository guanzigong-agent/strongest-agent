# 最强nba人贩子验证记录

日期：2026-10-03。

## 旧版历史回放

以下18项单元／集成测试、合同解析及历史数据校验针对保留的旧版，不代表新的实时云端排行榜已实现。

- `npm test`：18 项通过，0 项失败。
- `python tests/test_salary_parser.py`：2 项通过，覆盖 Base Salary／Cap Hit 区分、后签合同与 DEAD CAP 排除。
- `npm run validate`：30 队、522 名球员、4,799 条比赛表现，薪资基准缺失 0，结构错误 0。
- Headless Edge + Playwright：375×812 手机与 1280×900 桌面；买入、移动、卖出、30 天边界、结算、存档重载、新开局、搜索重置通过；四个手机入口无横向溢出，页面脚本错误 0。
- 存储故障注入：交易仍成功，持续显示保存失败警告；后续保存成功后恢复。
- `/test-repo/` 仓库子路径：HTML、CSS、模块、JSON 均 200；`.git`、采集缓存和采集脚本不由试玩服务暴露。
- 独立代码审查：发现存档失败提示覆盖、浅校验、个人路径和跨局过滤残留；前三项及过滤残留均已修复。存档新增测试先复现失败再通过；浏览器故障注入先复现提示缺失再通过。无未处理的审查小项。
- Markdown：UTF-8 无 BOM／无多余零宽和方向控制字符检查通过。

## 数据核验范围

结构通过不等于全部真实事实官方核验。使用有日期的社区开季名单，尚未完成逐队官方阵容全量复核；多数薪资来自单一专业数据库。KJ Simpson 是根据已确认双向合同计算的年度标准，非实际到账证明。新闻仅 5 条精选记录，不是完整伤病与交易资讯库。

## 发布状态

用户确认：公开仓库 `guanzigong-agent/strongest-agent`。

用户已确认M3前端并授权发布。原先普通沙箱中的CLI401已定位为Windows凭据访问限制；允许读取凭据后 `gh api user` 核验账号为 `guanzigong-agent`。

当前Pages包采用 `scripts/build-site.mjs` 的明确文件清单，只包含当前前端、紧凑名单、公开数据说明和根入口，共9个文件；不包含旧版、数据库原文件、采集缓存、浏览器输出、执行台账、私人上下文或凭据。

## 当前M3前端

- `scripts/prototype-smoke.mjs`：39项检查，覆盖三档资金、15人上限、交易循环、报价刷新、历史报价隔离、第30天边界、375px与1280px布局。
- `scripts/leaderboard-smoke.mjs`：26项检查，覆盖三难度隔离、本人资产随买卖／移动刷新、昵称、排名、结算退出、演示断线重试和布局。
- 排行榜没有云端服务；当前测试验证本页逻辑与演示交互，不声称验证真实多人同步。
- `scripts/site-smoke.mjs`：本地发布包与实际公网网址各17项检查通过；根入口跳转、模块与名单资源、标准档资金、15人容量、买入—移动—卖出、榜单、375px和1280px布局均正常，脚本异常和资源失败为0。

## 实际发布结果

- 2026-10-03已创建公开仓库：[guanzigong-agent/strongest-agent](https://github.com/guanzigong-agent/strongest-agent)，默认分支 `develop`。
- Pages使用Actions发布，部署版本 `d0e1845c4af65498406a4383305f046726808445`。
- [首次部署流水线](https://github.com/guanzigong-agent/strongest-agent/actions/runs/37116390036)成功；旧版测试与数据校验、当前公开包构建和Pages部署均成功。
- [公网试玩](https://guanzigong-agent.github.io/strongest-agent/)已用无头浏览器实际检查，包含17项上线检查。
- 排行榜仍为演示，刷新页面会重置当前局；这些限制已在网页及README说明。
