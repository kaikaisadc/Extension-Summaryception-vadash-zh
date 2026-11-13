# 上游基线与维护手册

本文件记录中文分支的上游来源、稳定标识和人工合并流程。它面向以后维护本仓库的模型或维护者，不是给普通用户看的安装说明。

## 上游基线

| 项目 | 值 |
| --- | --- |
| 上游仓库 | `https://github.com/vadash/Extension-Summaryception` |
| 上游 remote | `upstream` |
| 完整基线 SHA | `e89dc31d4a4cfaeb04bf39e4fba1b1a9a0d53b6c` |
| 上游版本 | `24.29.0` |
| 本中文分支版本 | `24.29.2` |
| 本仓库 remote | `origin` → `https://github.com/kaikaisadc/Extension-Summaryception-vadash-zh.git` |
| 许可 | AGPL-3.0-or-later，`LICENSE` 保持原文 |

本仓库保留上游 `main` 历史和提交作者信息，以独立仓库形式发布，不是 GitHub fork 网络中的派生仓库。不要在上游历史中改写作者或提交来源。

## 稳定命名空间（不要随意改）

本分支刻意使用独立命名空间，避免和旧 5.x 或其他 Summaryception 分支互相清空数据。以下 key 已写入源码，发布后应保持稳定：

| 用途 | 源码位置 | 值 |
| --- | --- | --- |
| 模块/扩展设置根 | `src/foundation/constants.js` `MODULE_NAME` | `summaryception_vadash_zh` |
| 扩展设置根 | `extensionSettings['summaryception_vadash_zh']` | 所有全局设置 |
| 聊天记忆根 | `chatMetadata['summaryception_vadash_zh']` | `layers`、`ghostedMessageIds`、`mutationEpoch` |
| 连续性检查点/注入槽 | `src/core/continuity-checkpoint.js`、`src/features/continuity-injection.js` | `summaryception_vadash_zh_continuity` |
| 消息稳定标识 | `src/foundation/message-identity.js` | 消息字段 `sc_vadash_zh_id` |
| 单消息 Token 缓存（已取消） | `src/core/token-count.js` | 旧的 `message.extra.sc_vadash_zh_token_count` 只清理，不再写入 |
| 设置页标签页会话状态 | `src/entry/ui-tabs.js` | `summaryception_vadash_zh.activeSettingsTab` |
| 提示词草稿 | `extensionSettings['summaryception_vadash_zh'].promptCustomDrafts` | 按 `settingKey` 存字符串 |

注意：DOM id、CSS class、`{{summaryception_memory}}` 宏、`/sc-*` 命令和酒馆的消息隐藏状态**仍然与上游共用**。命名空间隔离只保护存储，不代表可以双开。

## 提示词与模板位置

| 内容 | 位置 |
| --- | --- |
| 八项中文提示词正文与 builder | `src/foundation/zh-prompts.js` |
| 八项上游英文原版 | `src/foundation/prompt-constants.js` |
| 默认注入包装模板、重复召回模板 | `src/foundation/prompt-constants.js` 的 `DEFAULT_INJECTION_TEMPLATE`、`RECALL_REPEAT_INJECTION_TEMPLATE` |
| 预设注册表（单一事实来源） | `src/foundation/constants.js` 的 `PROMPT_DEFINITIONS` |
| 预设表导出 | `PROMPT_PRESETS`、`SUMMARIZER_SYSTEM_PROMPT_PRESETS`、`SUMMARIZER_REPAIR_PROMPT_PRESETS`、`PROMOTION_SYSTEM_PROMPT_PRESETS`、`PROMOTION_PROMPT_PRESETS`、`PROMOTION_REPAIR_PROMPT_PRESETS`、`AUDITOR_SYSTEM_PROMPT_PRESETS`、`AUDITOR_PROMPT_PRESETS` |
| 派生 key 导出 | `PROMPT_SETTING_KEYS`（由 `PROMPT_DEFINITIONS` 派生） |
| 中文预设检测 | `hasChinesePromptPreset(settings)`（同文件） |
| 设置 UI 模板 | `settings.html` |
| 设置页绑定/草稿恢复 | `src/entry/ui-prompts.js` |

八项字段的 `presetKey` / `settingKey`：

| 项 | presetKey | settingKey |
| --- | --- | --- |
| 第 0 层 system | `summarizerSystemPromptPreset` | `summarizerSystemPrompt` |
| 第 0 层 user | `promptPreset` | `summarizerUserPrompt` |
| 第 0 层 repair | `summarizerRepairPromptPreset` | `summarizerRepairPrompt` |
| 第 1+ 层 system | `promotionSystemPromptPreset` | `promotionSystemPrompt` |
| 第 1+ 层 user | `promotionPromptPreset` | `promotionUserPrompt` |
| 第 1+ 层 repair | `promotionRepairPromptPreset` | `promotionRepairPrompt` |
| 审计 system | `auditorSystemPromptPreset` | `auditorSystemPrompt` |
| 审计 user | `auditorPromptPreset` | `auditorUserPrompt` |

`zh_longform` 是八项默认；第 0 层/深层合并的英文原版 key 是 `narrative`，审计的英文原版 key 是 `continuity`；`custom` 使用 textarea 当前文本。

## 合并上游的正确流程

不要用 `git reset --hard upstream/main`、不要直接 `git checkout upstream/main -- .` 或用整目录覆盖的方式“升级”。这些操作会把中文界面、中文提示词和中文默认值一起冲掉。

建议流程：

1. `git fetch upstream`
2. 从当前中文分支新建独立维护分支，例如 `zh/upstream-24.xx.y`。
3. 用 `git merge --no-ff <上游提交>` 合并，或按需 `cherry-pick` 相关提交；冲突逐个人工解决。
4. 逐项阅读 diff，人工复核下面“必须保持”的清单。
5. 确认无遗漏后，再合并回中文主分支并更新版本号。
6. 不 push、不触发 CI，直到用户明确授权。

本分支没有、也不应新增“自动把 upstream 同步进中文分支”的 Actions；上游更新必须人工复核，不能承诺自动同步。

## 每次合并必须保持

- `manifest.json`：`display_name` 为“分层摘要 · 中文版”，`homePage` 指向本仓库，`auto_update: true`，作者/归属保留。
- 安装地址和默认目录名：`Extension-Summaryception-vadash-zh`；README 中的安装 URL 不指回上游。
- 中文默认：八项 `defaultPreset` 为 `zh_longform`，`defaultSettings` 中八项文本为中文。
- 英文原文：八项上游英文提示词仍然完整可选，不能因为中文化删掉英文预设。
- 保存兼容：`MODULE_NAME`、聊天 store key、`promptCustomDrafts` 路径和八项 preset/setting key 不能无故改名。
- 语言清理策略：任一项 `zh_longform` 时 `stripChineseIdeographs` 必须为 `false` 且 UI 禁用；全英文/custom 才允许手动开启，且不自动开启。
- 中文标点与句数：`src/core/repair-diagnostics.js` 对 `。！？` 的分句支持必须保留；新增中文提示词应继续使用动态句数/Token 限制，不写死固定字数。
- 协议格式：`<narrative>`、`current_date_time`、`<declined>reason</declined>`、`<active_continuity>`、审计 JSON 键/布尔字段/pair-key、`[S]` 秘密标记、`{{player_name}}`/`{{context_str}}`/`{{story_txt}}`/`{{summary}}`/`{{summaryception_memory}}` 以及 `EXECUTION_TRIGGER_*` 锚点不得随意改名。
- 中文 UI：`settings.html` 与 `src/entry/*` 的用户可见文字保持中文；`settings-help-data.js` 的动态说明、`settings-help.js` 的 tooltip、toastr 通知、确认框、命令帮助、状态标签都要随源码复核。
- 中文术语一致：原文保留区、待摘要区、深层合并、记忆注入、连续性审计、备用连接、Token（不是字数）。

## 24.29.2 新维护点

- 提示词编辑：`input` 期间不得调用归一化后回写 textarea；空白是临时编辑态，不能覆盖 `promptCustomDrafts` 的最后非空文本。IME 组词由 `compositionstart`/`compositionend` 隔离，后台 `syncAllSettingsToDOM` 跳过聚焦 textarea。失焦/切预设再同步执行用提示词。
- 消息 Token：不要重新引入按文本长度命中的消息级缓存。宿主 facade 没有可靠的 tokenizer/model 身份，消息计数应保守重算；`removeMessageTokenCaches` 只负责清理旧版本写入的 Extension Chat Data。
- Tokenizer 回退：真实 tokenizer 成功时始终优先使用精确值。失败时的 CJK 回退带安全余量并设置 `estimated`，但这只是预算估算，不是“一个汉字恒等于一个 Token”的模型真值；tokenizer 恢复后必须能重新精确计数。
- 输出清理：先移除完整思考块，再剥离 `stripPatterns` 中的孤立标记；保留 `<output>` 正文，空字符串 stripPattern 必须跳过以避免死循环。
- 重做上下文：`prior_context` 只能来自稳定 ID 能映射到当前 chat、且全部来源严格早于目标最早来源的完整片段。混合范围、未知来源和晚于目标的片段必须排除，不能按层号或数组顺序推断时序。
- 版本文件：`manifest.json`、`package.json`、`package-lock.json` 的版本保持一致。

## 中文文本维护要点

- 中文提示词不是英文逐字翻译，修改时要保持 P2 设计：区分事实/计划/猜测/传闻/梦境、保留不确定性、不凭外部知识补全、不写无损保证、第三人称、`<declined>` 通道等。
- 动态预算/修复附加信息可以保持英文，但不得加入 English-only 或“禁止汉字”之类会破坏中文路径的约束。
- 内置中文预设会随版本更新；用户想固定文本必须使用 `custom`。不要用更新覆盖 `custom` 文本或 `promptCustomDrafts`。
- 修改提示词只影响之后生成的摘要，不自动迁移或重写旧记忆。

## CI 与测试

- `.github/workflows/lint.yml` 只保留 `workflow_dispatch` 手动触发；本次发布**没有触发**。
- 上游测试代码继续保留在 `tests/`，不要删除；但本次按用户要求未运行测试、lint、typecheck、format、浏览器验证或模型试调用。
- 以后运行测试或 CI 需要用户另行明确授权；不要用 CI 结果宣称本次已经实机验证。
- 不要新增自动 push/PR 测试或自动上游覆盖工作流，避免发布时自动执行未经授权的检查或覆盖中文内容。

## 发布前人工检查清单

- [ ] `git remote -v`：`origin` 是本仓库，`upstream` 是 vadash。
- [ ] `manifest.json` 版本、`homePage`、`display_name`、作者信息正确。
- [ ] `README.md` 安装 URL、目录名、旧 5.x 迁移、更新方式、八项提示词、审计默认、Token 预算和“未测试”声明完整。
- [ ] `README.en.md` 仍是上游英文原文，`LICENSE` 未改。
- [ ] 八项中文提示词、英文原版和 `custom` 路径都可用。
- [ ] 任一项中文预设时汉字删除被强制关闭；全英文/custom 时可手动开启。
- [ ] `promptCustomDrafts` 仍按字段持久化，切回 `custom` 能恢复。
- [ ] `settings.html` 没有漏译的可见文字、`title`、`aria-label`、`placeholder`；ID/class/data 属性、option value、宏和协议标签未被翻译。
- [ ] 通知、确认框、命令帮助、状态标签、片段浏览器均为中文。
- [ ] 中文句号分句逻辑未被破坏。
- [ ] 没有新增自动同步上游的工作流。
