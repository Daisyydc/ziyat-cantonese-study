# 字日 ZIYAT · 粵語與繁體字學習網站

面向普通話拼音使用者的香港粵語與繁體字學習網站。純靜態單頁應用，無需後端。

**線上演示**：https://daisyydc.github.io/ziyat-cantonese-study/

## 功能

- **粵拼入門與音頻**：19 聲母、56 韻母、6 聲調共 81 張發音知識卡，200 個可點播音節音頻（TTS 合成音，界面已標註）
- **粵語打字訓練**：繁簡易混字一對多訓練（發/髮、後/后、乾/幹…）、香港粵語常用字（佢冇嘅咗…）、普通話→粵語句子打字（多答案、標點空格不判錯）
- **課程地圖**：按能力分類，不限日期不限次數；原 60 課繁體課程保留，舊進度只讀遷移
- **複習（SRS）**：間隔 1/2/4/7/14 天；練習答錯自動加入次日複習；完成 ≠ 掌握
- **數據管理**：JSON 備份導出/導入（校驗、覆蓋前留底、二次確認）；進度存於瀏覽器 localStorage

## 技術

原生 HTML/CSS/JavaScript（無框架）+ hash 路由；內容由 Python 管線從開源數據生成：
[rime-cantonese](https://github.com/rime/rime-cantonese)（CC BY 4.0）、
[CC-Canto](https://github.com/amadeusine/cc-canto-data)（CC BY-SA 3.0）、
[Cantone](https://huggingface.co/datasets/AlienKevin/cantone) 合成音頻（MIT）。

## 開發與測試

- `dist/` 為站點根；`work/` 含回歸測試與補丁腳本（gitignore）
- 測試：`node work/check.cjs`（舊站回歸）、`node work/check_jp.cjs`（新模塊）、`node work/check_data.cjs`（數據完整性）
- 內容管線在另一倉庫（build.py / build_cards.py / build_course.py / build_site.py，含 pytest 38 項）
- 本地運行：`cd dist && python3 -m http.server 8000`

## 項目記錄

詳見 [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md)（改版記錄、測試結果、已驗證/未驗證清單）與 JOB_DELIVERY_SUMMARY.md（求職交付總結）。
