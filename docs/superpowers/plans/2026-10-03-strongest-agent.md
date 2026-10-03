# 最强经纪人 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付真实 NBA 数据驱动的手机球员交易游戏，并发布 GitHub Pages 试玩链接。

**Architecture:** 静态页面加载固定历史数据；纯函数引擎负责报价、交易、移动和结算。界面与存档适配层调用引擎，真实历史记录与游戏交易归属分开维护。

**Tech Stack:** HTML、CSS、原生 JavaScript ES modules、JSON、Node 内置 test runner；测试浏览器可用时通过无桌面控制的自动化验证。

**Spec:** [已批准设计](../specs/2026-10-03-basketball-agent-design.md)

## Global Constraints

- 初始资金 15,000,000 美元；仓库最多 5 名球员。
- 球员基础价格为所选赛季的当赛季年薪，不采用剩余合同总额。
- 移动到另一队消耗一天；30 天结算现金与持仓价值。
- 所有真实球队的开局阵容球员可购买；不限制为精选球员。
- 其他球队仅保留访问时的历史报价和日期，不显示当前价格或涨跌预测。
- 新闻和比赛必须是真实快照，注明日期和来源，不使用未来信息。
- 报价乘数限制 0.70–1.30；固定位置偏好最多 ±8%，新闻及表现累计影响最多 ±22%。
- 本地文件置于 games/basketball-agent；Markdown UTF-8 无 BOM；不使用 Computer Use。
- 虎扑正式接入留待文档确认；公开仓库不含任务状态、学习记录或凭据。

## Review Focus

1. 日历跨时区：以 YYYY-MM-DD 日历日期推进，不依赖本机时区；由数据测试覆盖。
2. 双向／十天合同与赛季中转队：逐项标记合同口径及开局归属，不猜薪资；由覆盖检查覆盖。
3. 点击陈旧卡片：使用当前状态重校验归属及余额；由引擎测试覆盖。
4. 损坏、旧版或写入失败的存档：提示并保留可继续的会话状态；由存档测试覆盖。
5. Pages 仓库子路径：资源均相对引用；由子路径服务冒烟检查覆盖。

所有下列路径相对 games/basketball-agent。先检测 Node 与可用测试浏览器，不安装后台服务。Git 尚未初始化；设计阶段不初始化或自动提交整个 GameMaker 项目。执行阶段仅在游戏独立目录建立仓库，逐任务提交并排除私人上下文。

## Task 1：可核验真实数据快照

**Files:** data/snapshot.json、data/pricing-rules.json、docs/data-sources.md、scripts/validate-data.mjs、tests/data.test.mjs、package.json、.gitignore。

**Interfaces:** Snapshot = {version, season, startDate, endDate, teams, players, dailyFacts, baselines, sources}；Player = {id, name, teamId, position, salaryUsd, salarySourceId}；DailyFact = {date, playerId, type, payload, sourceId}。日期为 ISO 日历日期，金额为正整数。导出 validateSnapshot(snapshot) 返回错误数组；后续任务只消费通过验证的快照。

- [ ] 写数据测试：断言 30 支唯一球队、无重复球员 ID、各球员唯一归属、有薪资来源、完整连续 30 日、所有事实日期合法；错误日期、缺失薪资与重复归属必须报错。
- [ ] 运行 `node --test tests/data.test.mjs`，确认未实现时失败。
- [ ] 从 NBA 官方阵容、比赛与伤病／球队公告优先采集；合同如官方不披露，以可查证专业薪资数据库交叉核对并标明来源等级。优先检查最近完整赛季可核验的连续 30 日区间，按完整度选定并锁定；不得称其为当前实时阵容。保存事实摘要和链接，不复制整篇新闻。双向／十天合同明确赛季基准口径；无法核定的字段列入缺口，不静默填零。
- [ ] 实现 validateSnapshot；补齐缺口后运行数据测试和 `node scripts/validate-data.mjs`，预期零错误且覆盖说明与实际匹配。
- [ ] 写 pricing-rules 配置：最近最多 5 场比赛的 Game Score 均值对区间前基准偏差进行分档（±10%、±25% 对应 ±3%、±6%，基准分母最低 5）；新闻伤病缺阵 -8%、复出 +5%、明确角色变化 ±3%、交易先只作事实展示。叠加新闻项自发生日起按 7 天线性衰减，总影响裁剪至 ±22%。位置偏好由开局各队位置人数相对联盟均值确定并裁剪至 ±8%，全部映射写入来源说明，作为可调游戏参数。
- [ ] 创建游戏目录独立 Git 仓库并提交已批准设计、计划、数据及验证脚本；.gitignore 排除凭据、本地存档导出、临时采集文件和 node_modules。

## Task 2：报价及交易引擎

**Files:** src/engine.mjs、src/pricing.mjs、tests/engine.test.mjs、tests/pricing.test.mjs。

**Interfaces:** createGame(snapshot, startTeamId) → State；quote(snapshot, state, teamId, playerId) → 整数美元；act(snapshot, state, action) → {ok, state, error}；settle(snapshot, state) → {cash, inventoryValue, totalAssets, totalProfit, realizedProfit, unrealizedProfit}。State 包含 version、day、teamId、cash、owners、holdings（playerId/cost）、realizedProfit、visitedQuotes、ended。Action 为 buy/sell（playerId）、move（teamId）、finish。失败返回原状态；成功返回新状态。

- [ ] 写失败测试：余额 15000000、容量 5、重复买卖和过期卡片拒绝、失败不改变状态、唯一归属、买回成本重置、固定买入移动卖出盈亏；报价不受页面刷新影响、裁剪上下限、不读 day 之后事实。
- [ ] 运行 `node --test tests/engine.test.mjs tests/pricing.test.mjs`，预期失败。
- [ ] 实现上述纯函数；第 1 天开始、第 30 天禁移动仍可交易；finish 一次性结束。每次到达记录当地完整报价快照，其他队快照不主动刷新。统一结算价排除球队偏好。不得把全队报价送入面向玩家的视图模型。
- [ ] 增加 29 次移动到第 30 天、同队移动拒绝、终局操作拒绝、持仓成本与总收益分解相等的测试并运行全部引擎测试，预期通过。
- [ ] 提交报价与交易引擎。

## Task 3：手机界面和本地存档

**Files:** index.html、styles.css、src/app.mjs、src/views.mjs、src/storage.mjs、tests/storage.test.mjs。

**Interfaces:** buildView(snapshot, state, tab) → 仅含当地报价／历史报价的视图模型；loadGame(storage, version) → {state, warning}；saveGame(storage, state) → {ok, warning}。app 负责加载相对路径数据、调用 act、渲染与错误提示，不实现独立交易算法。

- [ ] 写存档失败测试：坏 JSON、版本不符、非法负余额／重复持仓拒绝；quota 异常返回 warning、不吞掉当前状态。
- [ ] 运行 `node --test tests/storage.test.mjs`，预期失败。
- [ ] 实现存档验证；保存失败允许会话继续并明确提示。坏档不静默覆盖，重开前明确确认。重开恢复 1500 万和原始归属。
- [ ] 实现「最强经纪人」手机布局：顶部资产／天数，市场、仓库、地图、新闻；姓名及位置过滤；当地交易显示成本和盈亏，地图标注未访问及历史日期；新闻有来源、日期且不出现预测。开局默认湖人，可换球队。
- [ ] 运行所有测试；用 375px 及桌面视口检查无横向溢出、点击区域可用、新闻链接可访问；通过浏览器自动化或结构检查验证陈旧按钮不会重复交易，记录实际验证能力。
- [ ] 提交页面与存档。

## Task 4：整局验收与部署包

**Files:** tests/integration.test.mjs、README.md、docs/verification.md；按验收发现修复相关模块。

**Interfaces:** 复用 Task 2 和 Task 3 的已定义接口，不增加第二套状态或结算规则。

- [ ] 写完整回归：选择买得起的球员→移动→卖出→检查资金／归属／收益→推进到第 30 天→结算；重开验证归零。持仓无法买满时仍可正常推进。
- [ ] 运行 `node --test` 和数据验证，全部通过；在 `/test-repo/` 子路径服务页面，检查 HTML、CSS、模块与 JSON 响应成功。
- [ ] 使用本地 HTTP 服务提供可试玩原型；README 给出确切启动命令、数据截止日期、玩法、版本及来源说明。记录移动视口和完整循环验证结果，不将结构检查描述成视觉验证。
- [ ] 检查所有 Markdown 无 BOM／多余隐藏字符、公开包无绝对本机路径／凭据／上下文文件，提交交付及验证记录。

## Task 5：GitHub Pages 发布

**Files:** README.md、按账户可用方式新增 .github/workflows/pages.yml（仅必要时）。

**Interfaces:** 输出核验过的仓库 URL、Pages URL 和部署状态；保持与本地同一快照版本。

- [ ] 检查 `gh auth status` 与仓库状态；向用户确定账号、仓库名及可见性，复用已有明确授权，不冒用示例作者仓库。
- [ ] 预览待公开文件列表，使用 GitHub CLI 推送游戏独立仓库；按 Pages 官方文档选择主分支静态发布或标准 Actions，不包含 GameMaker 根目录任务文件。
- [ ] 等部署完成后，通过 HTTP 验证首页和资源，再执行线上交易冒烟验证；失败时保留本地可玩版并报告具体部署状态。
- [ ] 回填真实网址及验证证据；本地完成、GitHub 推送、Pages 上线分别报告。虎扑未接入不计作阻塞本地交付。

## 执行选择

计划已自查设计覆盖、接口一致性、异常条件与子路径发布要求。推荐在本对话由主智能体直接执行，数据和引擎接口紧密相连，首版无需逐任务启动独立智能体；若用户选择子智能体执行，再遵循对应执行技能。实施前等待用户审核计划并选择执行方式。
