# ZIYAT「字日」· 项目进度与交付记录

> 需求文档：`/Users/daisy/Downloads/ZIYAT_粤语学习网站改版需求_Codex_PRD.md`（PRD v1.0，V2）
> V3 需求：2026-11-17 用户下达（产品定位调整 + 导航重构 + 粤语打字训练）
> 内容管线：`/Users/daisy/Documents/Codex/2026-11-12/referenced-chatgpt-conversation-this-is-an/`（outputs/ 为已审核内容）

## V3 改版（2026-11-17）

### 产品定位调整

原「每日六字 / 20 分钟 / 12 周计划」→ **帮助习惯普通话拼音与简体的用户，系统掌握繁体字、香港粤语书面表达与实际打字输入**。自由学习、不限日期不限次数；课程完成与知识掌握分开记录。

### 本次主要变更

| 模块 | 变更 |
|---|---|
| 导航 | 整合为 7 项：學習首頁 / 課程地圖 / 繁體字學習 / 粵語打字 / 粵拼與音頻 / 複習與進度 / 設置與數據；删除 12 週計劃、舊打字/倉頡/足跡/舊複習的导航入口（旧路由仍可访问，不删功能） |
| 学习首页 | 重做：#jp-home，含继续上次学习、粤语打字/繁体字/粤拼音频三个入口、今日待复习、实际学习进度（全部为真实统计，无假完成数） |
| 课程地图 | 按能力分类：①繁體字基礎（原 60 课迁入，只读展示原站完成状态，点击进入旧课程流程）②繁簡易混字 ③香港粵語常用字 ④粵語短句輸入 ⑤粵拼入門與音頻（A–E）⑥香港生活與職場書面表達（F 主题，部分内容徽章）；**隐藏 G/H「即將推出」** |
| 粤语打字（新核心功能） | ①繁體字輸入：36 组简→繁，重点教一对多（發/髮、後/后、裏/里、麵/面、乾/幹、係/系/繫、隻/只、獲/穫 等），提示先隐藏答案 ②香港粵語常用字：佢冇嘅咗喺啲咁嚟嗰畀乜咩喎喇 14 字，每字字形/普通话解释/粤拼/例句/合成音频/输入练习 ③句子打字：10 句普通话→自然粤语，多合理答案，标点空格不判错 ④输入法教学：Mac 拼音-繁体、Windows 微软拼音繁体字符集、Rime+rime-cantonese 粤拼输入（标注草稿待核實；明确声明网页无法检测输入法） |
| 复习 | 练习答错的题**自动加入次日复习队列**（新增行为）；复习页附熟练度统计 |
| 设置与数据 | 备份/导入/还原/清除迁入 #jp-settings；新增合成音频开关；原站設置保留入口；清除需二次确认 |
| 旧站 | app.js P3 补丁：计划页标题改为「繁體字學習」（其余 12 周课程结构保留为课程内容） |

### 改动文件

- `dist/index.html`（导航重构、品牌链接指向新首页）
- `dist/jyutping.js`（新首页/课程地图重构/打字训练 4 页签/音频卡页/设置页/复习统计/判分扩展 normSentence/错题入复习）
- `dist/jyutping.css`（打字页签、宽输入框、旧课按钮样式）
- `dist/jyutping-data.js`（重新打包：+60 道打字题、200 音频、typing 内容块）——由内容管线生成
- `dist/audio/*.wav`（+17 个常用字音节，共 200 个）
- `dist/app.js`（P3 补丁）
- `work/patch_app.cjs`（+P3）、`work/check_jp.cjs`（+V3 测试）、`work/check_data.cjs`（1638 题断言）
- 内容管线：`content_pipeline/typing_content.py`（新，模型草稿）、`build_site.py`（打字题合成）
- `PROJECT_PROGRESS.md`（本文件）

### 测试结果（2026-11-17，全部通过）

```
node work/check.cjs       PASS — 旧站 60 课回归 + P1/P2/P3 补丁断言
node work/check_jp.cjs    PASS — 新模块：打字判分（含发→髮 一对多判错、标点空格容忍）、
                           答错入复习队列、6 个新页面渲染、隐藏「即将推出」、备份路由重定向
node work/check_data.cjs  PASS — bundle 完整性（1638 题/38 课/81 卡/200 音频）
pytest content_pipeline   PASS — 38 项
http://127.0.0.1:8000     全部资源 200
```

### 已驗證 vs 尚未驗證（重要）

**已程序驗證**：判分逻辑、SRS 间隔、数据完整性、页面渲染、路由、旧站无回归。
**已人工审核（此前版本）**：粤拼教学卡 81 张文案、常见词清单、释义表、音系例字。
**尚未人工審核（本版新增，标 needs-review/draft）**：36 组繁简转换内容、14 个常用字例句、10 句粤语参考答案、输入法教学步骤（macOS/Windows 具体菜单路径请按实际系统核实）、打字题未入小测（仅练习）。
**音頻**：全部 200 个为 TTS 合成音（Cantone，MIT），界面已标注；精确辨音考试仍待真人录音。

### 安全备份

- git tag `v2-before-v3`（指向 V2 版本）
- 完整备份 `~/Documents/Codex/backups/qin-v3-backup-20261117.tar.gz`
- 旧数据：v1（`ziyat-study-v1`）从未被写入，旧进度只读迁移为 legacy 展示

### 尚未完成

1. 真人录音（听声辨音考试用）
2. F 主题句子/对话素材（每主题 3–5 句 + 问答）
3. 粤拼 MCQ 200 题人工审核后入小测池
4. 打字内容人工审核（见上）
5. P2 内容与体验完善（丰富课程、响应式打磨）

### AI 协作过程记录

1. AI 审计旧站源码（路由/判分/存储/构建管线），人类确认审计结论
2. AI 用开源数据（rime-cantonese、CC-Canto）生成字词表与题库草稿 → 人工审核后标记 approved
3. AI 生成教学卡与课程地图 → 人工审核
4. AI 实施前端接入（新旧并行架构）→ 自动化回归（vm 测试 ×3 套 + pytest）
5. V3：AI 生成打字训练内容草稿（标注待审核）→ AI 实施导航重构与打字功能 → 自动化测试 + 资源检查
6. 所有 AI 生成内容均带 reviewStatus/needs-review 标记，与人工审核内容严格区分

---

## V2 改版（2026-11-14，已并入 V3）



### 内容管线（另一仓库，已人工审核）

- 字词表 31,395 字 + 8,862 两字词（rime-cantonese CC BY 4.0 + CC-Canto CC BY-SA 3.0，含 290 词中文释义）
- 题库 1,578 题（714 题 approved），教学卡 81 张（全部 approved），课程地图 38 课（A–F，G/H 标即将推出）
- 合成音节音频 183 个（Cantone，MIT，界面标注「合成音」）

### 本站改动（本次提交）

| 文件 | 改动 |
|---|---|
| `dist/app.js` | P1：旧 `render()` 对 `#jp-*` 路由直接 return（新旧分治）；P2：第 6 题「抄写计分题」改为同课客观繁体选择 MCQ（保留每课 6 题，抄写计分路径已移除，`grep 抄寫`=0） |
| `dist/index.html` | 加 `jyutping.css`；侧栏加「粵拼入門」导航组（#jp-home/#jp-map/#jp-review/#jp-backup）；加 `jyutping-data.js` + `jyutping.js` |
| `dist/jyutping-data.js` | 站点数据包（JPDATA：38 课/81 卡/1,578 题/179 vocab 切片/183 音频清单），由内容管线 `build_site.py` 生成 |
| `dist/jyutping.js` | 新模块（IIFE）：`#jp-*` 路由、存儲 v2（`ziyat-study-v2`）、客观判分、SRS、课程页/地图/复习/备份/进度页 |
| `dist/jyutping.css` | 新模块样式（沿用字日配色令牌） |
| `dist/audio/*.wav` | 183 个合成音节音频（2.5MB） |
| `work/patch_app.cjs` | 补丁脚本（每条 find 恰好 1 次才替换，幂等，可审计重放） |
| `work/check.cjs` | 追加 2 条断言：无抄写题、jp 路由下旧 render 不碰 #app |
| `work/check_data.cjs` | 新增：bundle 完整性（id 唯一/小测⊆approved/音频无坏链） |
| `work/check_jp.cjs` | 新增：jyutping 模块 vm 回归（判分/抽题/SRS/迁移/导入校验/完成判定/渲染） |

### 存儲与判分设计（对齐 PRD 6/4 节）

- 新存储 key `ziyat-study-v2`（schemaVersion 2）：lessons（status/lastPosition/steps）、attempts（8 字段契约）、knowledge（SRS 间隔 1/2/4/7/14 天）、legacy（v1 只读快照，标注「不計入粵拼掌握」）；**从不写 v1 key**，v1 清档逻辑零触发
- 客观判分：完整粤拼输入（含声调数字）、声母/韵母/声调分项输入、看粤拼选字 MCQ；纸笔=自评不计分；练习不计掌握；小测只从 approved 抽题、只记首次独立作答
- 完成≠掌握：课程 completed 与知识熟练度分开记录；JSON 导出/导入（校验+覆盖留底 `-prebk` 一键还原）

### 测试结果（全绿）

```
node work/check.cjs       PASS（60 课/9 视图/判分/SRS/完成门/WebMCP + P1/P2）
node work/check_jp.cjs    PASS（路由/判分/抽题/SRS/迁移/导入校验/完成判定/渲染）
node work/check_data.cjs  PASS（bundle 完整性）
pytest content_pipeline   PASS（38 项，内容管线仓库）
本地 http.server 冒烟      index.html/style.css/app.js/data.js/jyutping-data.js/jyutping.js/jyutping.css/audio 全部 200
```

## 尚未完成 / 已知限制

1. **真人音频**：183 个音节均为 TTS 合成音（已标注），精确辨音考试需真人录音后才能上线（当前无听力计分题）
2. **F 主题句子/对话**：每主题暂只有词汇+词拼写题，PRD 要求 3–5 句 + 至少一组问答（课程页已标「部分內容」徽章）
3. **MCQ（看粤拼选字）**：200 题仍为 draft，仅出现在练习、不进小测；待人工审核后自动进入抽题池
4. **G/H 阶段**（情境听说/综合应用）：标「即將推出」
5. 练习完成门槛：每课需答 ≥10 题（E1 等综合课共 816 题，全部答完不现实）；与计划中「全覆盖」不同，属务实调整
6. 旧站「打字練習」模块仍是原判分逻辑（未改动，属旧功能保留范围）

## 手动验收清单（用户侧）

1. `cd dist && python3 -m http.server 8000` → 打开 http://127.0.0.1:8000
2. 旧站：#home/#plan/#lesson/#typing/#cangjie/#settings 全部照常；小测第 6 题变为「對應哪個繁體字」选择
3. 新站：侧栏「粵拼入門」→ 课程地图选 B1（b/p 送气）→ 听卡（注意合成音横幅）→ 练习（draft 带徽章）→ 纸笔自评 → 小测 → 总结；A1 无卡无测课只需自评即完成
4. 首页「繼續上次學習」、复习页（答错后次日到期）、备份页导出/导入/还原/清除
5. DevTools 检查 `ziyat-study-v2` 结构、`ziyat-study-v1` 原封不动
6. file:// 直接双击 dist/index.html 冒烟（数据经 script 注入、音频可播；持久化以 http 为准）

## 下一步

- 真人录音（优先教学卡例字 + 六调最小对立组）→ 上线听声辨音题
- F 主题句子/对话素材（用户审核）
- MCQ 200 题人工审核 → 入小测池
- 部署：提交本仓库后，按 ChatGPT hosting 流程重新发布（.openai/hosting.json 不变，dist 即站点根）
