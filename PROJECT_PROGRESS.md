# ZIYAT「字日」V2 改版 · 项目进度

> 需求文档：`/Users/daisy/Downloads/ZIYAT_粤语学习网站改版需求_Codex_PRD.md`（PRD v1.0）
> 内容管线：`/Users/daisy/Documents/Codex/2026-11-12/referenced-chatgpt-conversation-this-is-an/`（outputs/ 为已审核内容）

## 已完成（2026-11-14，Phase 0 + Phase 1 主要内容接入）

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
