# ZIYAT「字日」· 项目交付总结（求职用）
# Project Delivery Summary: ZIYAT Cantonese Learning Website

> 依据：qin 仓库 git 历史（21caedf → c5188eb → fc5cc3c → e98d968）、PROJECT_PROGRESS.md、内容管线代码与测试记录。
> 说明：本文档所有功能、测试与数据均以真实代码与记录为准；未虚构用户量、技术栈或效率数据。

---

# Part A · 中文版

## 1. Project Overview 项目概述

**背景**：项目始于一个「每日六字 / 20 分钟 / 12 周计划」的繁体字学习网站（MVP，由 ChatGPT/Codex 辅助搭建并部署于 chatgpt.site）。两轮改版后，定位调整为：**帮助习惯普通话拼音与简体输入的内地用户，系统掌握繁体字、香港粤语书面表达与实际打字输入能力**。

**目标用户**：会说或听得懂部分粤语、或完全没有粤语基础的普通话母语者；看得懂汉字但不熟悉繁体字与粤拼；学习时间不固定，需要自由节奏。

**解决的实际问题**：
- 会听会说粤语，但不知道「佢、嘅、咗、冇、喺、啲」等字怎么写、怎么打；
- 用普通话拼音输入时不知如何输出繁体字，尤其是一简对多繁（发→發/髮）；
- 原有「抄写后复制回网站」的评分方式不能证明真实掌握；
- 固定每日六字、12 周计划无法满足高强度、自由安排的学习需求。

## 2. Technical Stack 技术栈

| 层 | 实现 |
|---|---|
| 前端 | 纯静态单页应用（原生 HTML/CSS/JavaScript，无框架），hash 路由，新旧模块并行挂载（旧 app.js 与 jyutping.js IIFE 分治，避免全局命名冲突） |
| 后端 | 无后端服务（静态站）；部署经 .openai/hosting.json 指向 dist/，托管于 chatgpt.site |
| 数据存储 | 浏览器 localStorage：旧数据 key `ziyat-study-v1`（只读保留），新数据 key `ziyat-study-v2`（schemaVersion=2，含 attempts/knowledge/lessons/legacy 结构）；JSON 导出导入（校验、覆盖前留底、二次确认） |
| 内容管线 | Python 3 脚本（build.py / build_cards.py / build_course.py / build_site.py）+ LSHK 粤拼音节解析器（自研，含 pytest 38 项）；开源数据源：rime-cantonese（CC BY 4.0）、CC-Canto（CC BY-SA 3.0）、Cantone 合成音节音频（MIT） |
| AI 工具 | ChatGPT/Codex（初版 MVP）；Claude Code（V2/V3 改版：代码审计、内容生成、编码、测试、排查）；AI 生成内容带 reviewStatus 标记，经人工审核后才进入正式测验 |

注：仓库中另有一个 FastAPI「错题复习教练」最小 Agent 原型，属于独立实验，**未集成进主网站**。

## 3. Project Ownership 项目主导

- **需求提出**：我基于自身学习体验撰写两版需求文档（V2 PRD 约 5,000 字含验收标准；V3 改版需求），明确目标用户、产品原则（先听后学、完成≠掌握）与禁止项（不得以复制粘贴/时长计分）。
- **范围与优先级**：要求按 P0（结构整理）→ P1（核心学习功能）→ P2（内容体验）顺序交付，先保证可用再扩展。
- **审核把关**：作为粤语母语者，逐项人工审核 AI 生成内容（教学卡 81 张、常见词清单、释义表、手工标音词），通过后才标记 approved。
- **迭代推动**：三轮迭代（V1 MVP → V2 粤拼课程接入 → V3 定位重构与打字训练）；每轮在浏览器实测并反馈问题（页面空白、12 周框架未彻底移除等），推动修复与验收。

## 4. Key Deliverables 已实现功能

1. **粤拼入门课程**：38 节（A 认识粤拼 / B 声母 / C 韵母 / D 入声与声调 / E 拼读整合 / F 生活主题），81 张发音知识卡（19 声母、56 韵母、6 声调），含发音要领、普通话对比、易错警告、例字与 200 个可点播音节音频（TTS 合成音，界面已标注）。
2. **题库与测验**：1,638 题（看字写粤拼/写声母/写韵母/写声调/看词写粤拼/看粤拼选字/打字题）；**714 题经人工审核**，小测只从已审核题抽取；无提示小测只记录首次独立作答。
3. **粤语打字训练**：繁体字输入 36 组（重点讲解一简对多繁：發/髮、後/后、乾/幹、獲/穫）；香港粤语常用字 14 个（佢冇嘅咗喺啲咁嚟嗰畀乜咩喎喇，含解释/粤拼/例句/音频/输入练习）；句子打字 10 句（普通话→自然粤语，多种合理答案，标点空格不判错）；输入法教学（Mac/Windows 拼音繁体、Rime 粤拼，标注待核实）。
4. **课程地图与自由学习**：按能力分类（繁体基础/繁简易混字/常用字/短句/粤拼/生活职场），不限日期不限次数；旧 60 课课程迁入地图，旧进度只读保留。
5. **复习体系（SRS）**：间隔 1/2/4/7/14 天；练习答错自动加入次日复习；连续 3 次首次答对才计「掌握」；课程「完成」与「掌握」分开记录。
6. **数据管理**：JSON 导出/导入（版本校验、损坏文件不覆盖、覆盖前自动留底可一键还原）、清除需二次确认；旧数据零丢失。
7. **旧功能保留**：繁体生字课程、手写自评、旧打字、仓颉；删除抄写复制计分路径（改为客观选择题）。

## 5. Change Management 改版前后变化

| 维度 | 改版前 | 改版后 | 解决的问题 |
|---|---|---|---|
| 产品定位 | 每日六字、20 分钟、12 周计划 | 自由节奏的繁体字 + 粤语书面表达 + 打字训练 | 固定节奏不符合真实学习需求 |
| 导航 | 两组导航共 11 项，含 12 周计划 | 7 个模块（学习首页/课程地图/繁体字学习/粤语打字/粤拼与音频/复习与进度/设置与数据） | 结构杂乱、入口与定位不符 |
| 课程组织 | 按日历周排列 | 按能力分类，旧课迁入地图，隐藏空模块 | 12 周框架限制自由学习 |
| 学习核心 | 抄写 + 复制回网站计分 | 客观判分（含声调数字、一对多陷阱题）+ 打字实操 | 假分数不能证明掌握 |
| 音频 | 无 | 200 个音节音频 + 发音卡（合成音已标注） | 无发音教学 |
| 数据安全 | 无导入导出，版本升级直接清档 | 双 key 隔离、只读迁移、导入校验 + 留底 + 二次确认 | 进度丢失风险 |
| 默认落地页 | 旧「今日六字」首页 | 新学习首页（真实进度统计） | 旧框架仍暴露在主要路径 |

改版过程中发现并修复的问题：浏览器缓存导致新页面空白（加版本参数强制刷新）、12 周框架经导航仍可达（专用繁体学习页 + 默认落地页与旧课完成跳转全部指向新首页）、小测单选题提交只读第一个选项（改为遍历选中项）。

## 6. AI-Assisted Development AI 辅助开发

Claude Code 在本项目中的实际作用：
- **需求分析**：将两份需求文档拆解为可执行阶段与验收标准；审计旧站源码（路由/判分/存储/构建管线），产出带行号证据的审计报告。
- **内容工程**：从开源数据（rime-cantonese、CC-Canto）生成 31,395 字 + 8,862 词的词表、1,638 题题库、81 张教学卡；所有 AI 生成内容标记 draft/needs-review，**由我（粤语母语者）逐项审核后才进入正式测验**。
- **代码实施**：设计新旧模块并行架构（旧代码仅 5 处精确字符串补丁，其余全部新增文件，最大限度降低回归风险）；实现判分、SRS、存储 v2、迁移、导入导出。
- **排查优化**：定位浏览器缓存空白页、单选提交 bug、测试环境 hash 语义差异等问题；用 Node vm 沙盒为无法运行浏览器的静态站建立回归测试。
- **测试验证**：4 套自动化测试（见第 7 节）全部通过后才交付；每次交付附「已验证 vs 未验证」清单。

## 7. Testing & UAT 测试与验收

**自动化测试（全部通过）**：
| 测试 | 内容 | 结果 |
|---|---|---|
| pytest ×38（内容管线） | LSHK 音节解析器（19 声母/56 韵母/6 声调拆分与边界） | 38 passed |
| check.cjs（旧站回归，Node vm） | 60 课 ×9 视图、判分、SRS、完成门、5 处补丁断言 | PASS |
| check_jp.cjs（新模块，Node vm） | 判分边界（发→髮判错、标点空格容忍）、SRS 间隔、迁移、导入校验、完成判定、页面渲染 | PASS |
| check_data.cjs（数据完整性） | 1,638 题 id 唯一、小测⊆已审核、200 音频无坏链 | PASS |

**人工测试（UAT，由我在浏览器执行）**：每轮改版后的功能走查（导航、音频播放、打字练习、刷新持久化、备份导入导出），并实际发现两个缺陷（新页面空白=浏览器缓存；12 周框架未彻底移除），均已修复并回归。
**未执行的测试**：无浏览器自动化 E2E、无跨浏览器矩阵、无真机移动端测试；精确辨音考试因缺真人录音尚未上线。

## 8. Risk Management 风险管理

- **数据丢失**：git tag + 完整压缩备份（v2-before-v3 + qin-v3-backup-20261117.tar.gz）；新代码从不写入旧存储 key；导入校验失败零改动、覆盖前自动留底、破坏性操作二次确认。
- **错误评分**：客观判分规则（声调数字必填、nei2≠nei5、发→髮陷阱）；重考不计掌握；练习不计掌握；删除复制粘贴计分路径。
- **AI 内容不准确**：AI 生成内容全部带 draft/needs-review 标记；正式小测只从人工审核题抽取（打包期 + 运行期 + 测试期三层防线）；数据来源与许可全部记录；合成音频明示标注且不用于精确辨音考试；输入法指引明确声明「网页无法检测输入法」并标注待核实。
- **回归风险**：旧代码只做 5 处精确字符串补丁（每条须唯一匹配否则拒绝执行），新旧模块路由分治，旧站回归测试全程保护。

## 9. Project Limitations 当前限制（如实说明）

- 200 个音频为 TTS 合成音（已标注），**真人录音尚未制作**，听声辨音考试未上线；
- 打字训练内容（36 组繁简、14 常用字、10 句子、输入法指引）为**草稿状态，正在人工审核**，审核前仅作练习、不进小测；
- 粤拼「看粤拼选字」200 题未审核（仅练习）；
- F 生活主题课缺句子/对话素材（已标注「部分内容」）；
- 无账号/云同步（localStorage 本地存储，属 MVP 设计取舍）；
- V2/V3 代码已提交 git，**生产环境重新部署尚未执行**（目前以本地服务器验收）；
- 独立 FastAPI Agent 原型未集成进主站。

## 10. Resume Bullet Points（英文简历要点，见 Part B 第 10 节）

---

# Part B · English Version

## 1. Project Overview

ZIYAT ("字日", "Daily Characters") is a Cantonese-learning web app whose positioning evolved across three releases: from a fixed "6 characters / 20 minutes / 12-week plan" MVP into a free-paced platform that helps Mandarin-pinyin users (Simplified Chinese users from mainland China) master Traditional Chinese characters, written Hong Kong Cantonese, and real typing ability.

**Problems it solves**: users who can speak or understand Cantonese but cannot type characters like 佢/嘅/咗/冇/喺/啲; users who type Simplified Chinese but don't know how to output Traditional (especially one-to-many mappings such as 发→發/髮); a legacy scoring model that rewarded copy-pasting text instead of real recall; and a fixed daily/12-week schedule that didn't fit self-paced learners.

## 2. Technical Stack

- **Frontend**: static single-page application in vanilla HTML/CSS/JavaScript (no framework), hash-based routing, with legacy and new modules running side-by-side (the new module is an IIFE; the legacy app.js received only 5 exact-string patches).
- **Backend**: none (static site); deployed via .openai/hosting.json to chatgpt.site hosting.
- **Storage**: browser localStorage — legacy key `ziyat-study-v1` (read-only, never written by new code) and new key `ziyat-study-v2` (schemaVersion 2: attempts, knowledge/SRS, lesson progress, legacy snapshot); JSON export/import with validation, pre-overwrite backup and double-confirm destructive actions.
- **Content pipeline**: Python 3 scripts + a self-built LSHK Jyutping syllable parser (pytest suite); open data sources: rime-cantonese (CC BY 4.0), CC-Canto (CC BY-SA 3.0), Cantone synthetic syllable audio (MIT).
- **AI tools**: ChatGPT/Codex (initial MVP); Claude Code (V2/V3: code audit, content generation, implementation, debugging, testing). All AI-generated content carries draft/needs-review flags and enters formal quizzes only after human approval.

Note: a separate FastAPI "wrong-answer coach" agent prototype exists in another repository as an independent experiment and is **not integrated** into the main site.

## 3. Project Ownership

- Wrote two requirement documents (a ~5,000-word V2 PRD with acceptance criteria; V3 repositioning requirements), defining target users, product principles ("hear first, then rules"; completion ≠ mastery) and prohibitions (no copy-paste/time-based scoring).
- Set scope and priorities: P0 structure → P1 core learning features → P2 content polish; "make it genuinely usable before expanding".
- As a native Cantonese speaker, personally reviewed AI-generated content batch by batch (81 teaching cards, common-word lists, glossaries, hand-annotated readings) before marking them approved.
- Drove three iterations and performed browser UAT each round, feeding defects (blank pages, leftover 12-week framing) back into fixes.

## 4. Key Deliverables

1. **Jyutping phonology course**: 38 lessons (A–F) with 81 pronunciation cards (19 initials / 56 finals / 6 tones) — articulation guides, Mandarin comparisons, common-error warnings, examples, and 200 click-to-play syllable audios (TTS, labeled as synthetic).
2. **Question bank & quizzes**: 1,638 questions across 7 types; **714 human-approved**; no-hint quizzes draw only from approved questions and only count first independent attempts.
3. **Cantonese typing training**: 36 Simplified→Traditional pairs with one-to-many explanations (發/髮, 後/后, 乾/幹, 獲/穫); 14 common Hong Kong Cantonese characters with gloss, Jyutping, example sentences, audio and input practice; 10 sentence-typing exercises (Mandarin prompt → natural Cantonese, multiple accepted answers, punctuation/space tolerant); input-method guide for macOS/Windows (flagged for verification).
4. **Skill-based course map & free pacing**: categories (Traditional basics / confusing pairs / common characters / short sentences / Jyutping / daily-life themes), no date locks, no daily limits; legacy 60-lesson course migrated into the map with read-only progress.
5. **Spaced-repetition review**: 1/2/4/7/14-day intervals; wrong practice answers auto-queued for next-day review; mastery requires 3 consecutive first-attempt correct answers; course completion is tracked separately from mastery.
6. **Data management**: validated JSON export/import, one-click rollback of pre-import state, double-confirm clear; zero legacy data loss.
7. **Legacy preservation**: original character lessons, handwriting self-assessment, typing and Cangjie modules retained; the copy-paste scoring path was removed and replaced with an objective MCQ.

## 5. Change Management

| Area | Before | After | Problem solved |
|---|---|---|---|
| Positioning | Fixed 6 chars / 20 min / 12-week plan | Free-paced Traditional + Cantonese writing + typing mastery | Rigid schedule didn't fit real usage |
| Navigation | Two groups, 11 items incl. 12-week plan | 7 modules (Home / Course Map / Traditional / Cantonese Typing / Jyutping & Audio / Review & Progress / Settings & Data) | Cluttered IA, wrong entry points |
| Course organization | Calendar-week grid | Skill-based map; legacy courses migrated; empty modules hidden | Calendar framing blocked free learning |
| Core learning | Copy-paste "handwriting" scoring | Objective grading (tone digits mandatory, one-to-many trap questions) + real typing | Fake scores |
| Audio | None | 200 syllable audios + pronunciation cards (synthetic, labeled) | No pronunciation teaching |
| Data safety | No export; version bump wiped data | Isolated keys, read-only migration, validated import with rollback | Progress-loss risk |
| Default landing | Legacy "6 chars today" home | New home with real progress stats | Old framing still exposed |

Defects found and fixed during iteration: new pages blank due to browser caching (added cache-busting version params); 12-week framing still reachable via nav (dedicated Traditional page + all redirects pointed to the new home); single-choice quiz submission read only the first radio option (fixed to read the selected one).

## 6. AI-Assisted Development

How Claude Code was used in practice:
- **Requirements analysis**: decomposed the PRDs into executable phases and acceptance criteria; audited the legacy codebase (routing / scoring / storage / build pipeline) into an evidence-based report with file/line references.
- **Content engineering**: generated a 31,395-character + 8,862-word vocabulary, a 1,638-question bank and 81 teaching cards from licensed open data; every AI-generated item was flagged draft/needs-review and gated by my native-speaker review before entering formal quizzes.
- **Implementation**: designed the parallel-module architecture (legacy file received only 5 exact-string patches, everything else additive) to minimize regression risk; implemented grading, SRS, storage v2, migration and import/export.
- **Debugging & optimization**: root-caused the browser-cache blank pages, the radio-button submission bug and a test-harness hash-format mismatch; built Node vm sandbox regression tests for a site that has no server-side test runner.
- **Verification**: all 4 automated suites must pass before delivery; each release includes an explicit "verified vs unverified" list.

## 7. Testing & UAT

**Automated (all passing)**:
| Suite | Scope | Result |
|---|---|---|
| pytest ×38 (content pipeline) | LSHK syllable parser (19/56/6 phoneme splitting and edge cases) | 38 passed |
| check.cjs (legacy regression, Node vm) | 60 lessons × 9 views, scoring, SRS, completion gate, 5 patch assertions | PASS |
| check_jp.cjs (new module, Node vm) | Grading edge cases (發→髮 rejected, punctuation tolerance), SRS intervals, migration, import validation, completion rules, page rendering | PASS |
| check_data.cjs (data integrity) | 1,638 unique question ids, quizzes ⊆ approved, 200 audio files with no broken links | PASS |

**Manual UAT (performed by me in the browser each release)**: navigation, audio playback, typing practice, refresh persistence, backup restore; found two real defects (blank pages = browser cache; leftover 12-week framing), both fixed and regression-tested.
**Not executed**: no automated browser E2E, no cross-browser matrix, no real-device mobile testing; precise listening-discrimination quizzes are not live pending real human recordings.

## 8. Risk Management

- **Data loss**: git tags plus full tarball backups; new code never writes the legacy storage key; failed imports change nothing; pre-overwrite backup with one-click rollback; destructive actions require double confirmation.
- **Incorrect scoring**: strict grading rules (tone digits required; nei2 ≠ nei5; 发→髮 trap questions); retakes don't count toward mastery; practice never counts; the copy-paste scoring path was removed.
- **AI content inaccuracy**: draft/needs-review flags on all AI content; quizzes draw only from human-approved questions (three defensive layers: build-time assert, runtime filter, test suite); sources and licenses recorded; synthetic audio labeled and excluded from precise listening exams; IME instructions explicitly state the webpage cannot detect input methods and are flagged for user verification.
- **Regression risk**: legacy code modified only via 5 exact-string patches (each must match exactly once or the patcher aborts); routing separation between old and new modules; legacy regression suite runs on every change.

## 9. Project Limitations (stated honestly)

- The 200 audio files are TTS-synthetic (labeled); **real human recordings are not yet produced**, so listening-discrimination quizzes are not live.
- The typing-training content (36 pairs, 14 characters, 10 sentences, IME guide) is **in draft, pending my human review**; until approved it appears in practice only, never in quizzes.
- The 200 "pick the character" MCQ questions are not yet approved (practice only).
- F theme courses lack sentence/dialogue material (badged "partial content").
- No accounts or cloud sync (localStorage by MVP design).
- V2/V3 code is committed to git, but **production redeployment has not yet been executed** (currently validated on a local server).
- The standalone FastAPI agent prototype is not integrated into the main site.

## 10. Resume Bullet Points (4 bullets, English)

1. **Owned end-to-end delivery of a Cantonese-learning web app for Mandarin-speaking users** — translated two PRDs into phased scope (P0 structure → P1 core typing MVP → P2 polish), prioritized by learner value, and shipped three releases (MVP → Jyutping course integration → repositioning to typing-focused learning) with zero legacy data loss.
2. **Directed AI-assisted development with Claude Code** — audited a legacy codebase, generated a 1,638-question bank and an 81-card pronunciation course from licensed open data, and enforced human-review gates (714 questions and all teaching cards approved by a native-speaker review before entering formal quizzes).
3. **Drove change management across releases** — replaced a fixed 12-week plan with a skill-based course map and 7-module navigation, removed a copy-paste scoring loophole, and migrated legacy progress read-only, documented via git tags, full backups, and a maintained project record.
4. **Established quality assurance and risk controls** — 4 automated test suites (38 pytest cases + 3 Node vm regression suites, all passing) plus per-release manual UAT; caught and fixed real defects (browser-cache blank pages, quiz submission bug); enforced import validation, pre-overwrite backup, and double-confirm destructive actions.

---

*本文档依据真实项目文件生成：/Users/daisy/Documents/Codex/2026-09-20/qin（PROJECT_PROGRESS.md、git 历史、work/ 测试套件）与内容管线仓库 /Users/daisy/Documents/Codex/2026-11-12/referenced-chatgpt-conversation-this-is-an/。*
