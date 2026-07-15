# World Atlas Handoff Audit Report

## 1. Git 工作區狀態 (Git Workspace Status)

目前工作區有未提交的改動與未追蹤的檔案：

### 未暫存的修改 (Modified Files)
*   [js/wiki-monster-view.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/wiki-monster-view.js)
*   [wiki.html](file:///D:/DimEraClaw/Idle-lineage-wiki/wiki.html)

### 未追蹤的檔案 (Untracked Files)
*   `css/wiki-world-atlas-preview.css`
*   `js/wiki-world-atlas-preview.js`
*   `tools/test_monster_merged_preview.js`
*   `tools/test_world_atlas_preview.js`
*   `js/wiki-monster-merged-preview.js`
*   `docs/MONSTER_MERGED_PREVIEW_REPORT.md`
*   `docs/WORLD_ATLAS_PREVIEW_V0_REPORT.md`
*   `docs/WORLD_ATLAS_PREVIEW_V01_REPORT.md`
*   `docs/WORLD_ATLAS_V1_REPORT.md`

> [!IMPORTANT]
> 本階段稽核未對現有未提交成果進行任何覆蓋或刪除。

---

## 2. 目前 World Atlas 已完成項目 (Completed Features)

*   **世界百科入口整合：** `wiki.html` 已整合「地區」、「地圖」、「怪物」、「NPC」與「製作」資料。預設載入世界百科，並支援舊 URL 路由重導向。
*   **地區與地圖摺疊：** 左側地區清單可切換，主內容以地圖 Accordion 分門別類顯示 Boss、一般怪物與 NPC。
*   **無刷新互動：** 怪物與 NPC 均採用共用 Modal（點擊開啟，關閉後保留原滾動位置）；道具/裝備提供桌面級 Tooltip hover 與點擊 Modal 整合。
*   **自然滾動設計：** 移除怪物卡內部滾動條，整體卡片高度隨內容自動撐高，維持主頁面單一垂直滾動條。
*   **行動版響應式：** 850px 以下自動隱藏左側地區改用選單， 480px 以下自動變更為單欄佈局與近全螢幕 Modal。

---

## 3. 與正式 UI 準則不一致的項目 (UI Parity Mismatches)

### A. Monster Card 欄位過多與漏項
*   **現況：** 怪物卡仍直接顯示「種族」、「攻擊」、「命中」、「MR」、「EXP」、「Gold」，這違反了正式規格。
*   **規範：** 怪物卡只應顯示：怪物圖片、名稱、等級、屬性、HP、AC，以及可驗證特性 Tag。
*   **特性 Tag 缺失：** 怪物卡片目前僅在最下方以文字提示「特性 3」，並未展開顯示可驗證特性 Tag（如「硬皮」、「狂暴」、「吸血」等）。

### B. Boss 卡片顯示問題
*   **現況：** Boss 怪物卡仍會附加 `world-atlas-boss-badge` 並顯示 "Boss" 文字。
*   **規範：** Boss 怪物卡不顯示 "Boss" 文字、不顯示皇冠或 Emoji，應僅以暗金色外框與暗金色名稱文字進行區隔。

### C. 稀有掉落 Icon 缺失
*   **現況：** 怪物卡上僅顯示文字「掉落 12」，並未直接渲染前 3~4 個重要稀有掉落物的遊戲原始 Icon 及其 Tooltip。
*   **規範：** 卡片需直接顯示稀有掉落 Icon（依遺物、高價值裝備、材料等排序），Hover 觸發 Tooltip，Click 開啟 Item Modal。

---

## 4. 兩個 Validator 失敗的實際原因 (Validator Failure Root Cause)

### 執行 Validator 失敗
當本機執行 python 驗證腳本時：
*   `validate_monster_data.py` 與 `validate_equipment_data.py` 因缺少 `jsonschema` 庫而直接報錯：`ModuleNotFoundError: No module named 'jsonschema'`。

### 資料庫層面的失敗原因
在已建立 Python 依賴的環境中，原作者報告這兩個 validator 失敗，其原因為：
1.  **Monster 無效 ItemRef：** 
    `drop_entry_legacy_owner_hellslave_mat_summonorb_core_base` 參照的 Item `mat_summonorb_core` 無效。
2.  **Equipment 缺少 amr_emperor key：** 
    裝備資料集驗證時找不到 `amr_emperor` 鍵。

### 根源分析：代碼與數據集的不一致 (Code vs Dataset Parity Mismatch)
*   在 `data/monster/` 和 `data/equipment/` 目錄下，JSON 資料集已經正確生成並同步至 `v3.4.17` 狀態（因此包含了新道具 `mat_summonorb_core` 與新裝備 `amr_emperor`）。
*   然而，本地的 [js/00-data.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/00-data.js) 與 [js/01-drops-config.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/01-drops-config.js) 仍然是舊版本，並未拷貝覆蓋為 `v3.4.17` 版本的 Snapshot。
*   Validator 運作時會從本地 `js/00-data.js` 提取 `item_ids` 作為合法道具池。由於本地 JS 檔案尚未同步，驗證時便找不到新資料，引發了 ItemRef 無效與 KeyError。

---

## 5. 建議最小修正計畫 (Proposed Minimal Modifications)

為確保通過驗收且不破壞原有結構，建議進行以下最小幅度修正：

### 數據同步 (Data Sync)
*   將 `temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot/js/` 底下的最新 JavaScript 檔案（特別是 `00-data.js`、`01-drops-config.js`）複製到本地 `js/` 目錄下。這將直接修復兩個 Python 驗證器失敗的問題。

### 介面修正 (UI Adjustments)
1.  **修改怪物卡渲染邏輯 (`js/wiki-world-atlas-preview.js`)**
    *   移除卡片上的：種族、攻擊、命中、MR、EXP、Gold。
    *   移除 Boss 卡片上的 "Boss" 徽章與文字；為 Boss 怪物名稱套用 `world-atlas-boss-name` 樣式（暗金色字體）。
    *   加入特性 Tag 渲染：直接在卡片上顯示特性標籤（如 `硬皮`、`狂暴` 等），無特殊特性時顯示 `無特殊特性`。
    *   加入稀有掉落 Icon 渲染：依規定優先權（遺物 > 高價裝備 > 材料等）篩選前 3~4 個掉落物，並渲染為原始圖示按鈕，綁定 Tooltip 和 Modal 點擊事件。
2.  **更新 CSS 樣式 (`css/wiki-world-atlas-preview.css`)**
    *   新增 Boss 專用的名稱顏色變數（例如 `color: var(--accent-gold)`）。
    *   調整卡片內部佈局，確保特性標籤與稀有掉落物 Icon 在極窄螢幕（390px）下不會溢位或折疊不全。

### 預計修改檔案
*   [js/wiki-world-atlas-preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/wiki-world-atlas-preview.js) (UI 邏輯修正)
*   [css/wiki-world-atlas-preview.css](file:///D:/DimEraClaw/Idle-lineage-wiki/css/wiki-world-atlas-preview.css) (樣式微調)
*   [js/00-data.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/00-data.js) (同步為 v3.4.17 解決 Validator 失敗)
*   [js/01-drops-config.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/01-drops-config.js) (同步為 v3.4.17 解決 Validator 失敗)

---

## 6. 正式化修正可行性評估

目前專案的結構極度清晰，世界百科 (World Atlas) 整合架構已完成 90% 以上。
只要完成上述數據同步與怪物卡片細節修正，**即可直接進入正式化修正階段**。
