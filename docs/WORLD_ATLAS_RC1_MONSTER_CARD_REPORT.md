# World Atlas RC-1 Monster Card UI 發布報告

## 1. 修改檔案 (Modified Files)

本次 Sprint 嚴格遵循計畫，僅修改了以下前端檔案，完全未修改 Dataset 及 Generator：
*   [js/wiki-world-atlas-preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/wiki-world-atlas-preview.js) (核心渲染與決定性排序邏輯)
*   [css/wiki-world-atlas-preview.css](file:///D:/DimEraClaw/Idle-lineage-wiki/css/wiki-world-atlas-preview.css) (卡片樣式與響應式微調)
*   [tools/test_world_atlas_preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/tools/test_world_atlas_preview.js) (單元測試新增與調整)

---

## 2. 一般怪 Monster Card (Orc / 妖魔)

*   **保留欄位：** 等級 (Lv)、屬性、HP、AC，以及正面圖片與怪物名稱。
*   **移除欄位：** 種族 (妖魔)、攻擊 (1D11+2)、命中 (12)、MR (10)、EXP (78)、Gold (12-25)。
*   **特性 Tag：** 妖魔在代碼中沒有特有技能或特性，卡片正面清晰呈現 `無特殊特性`。
*   **掉落 Icon：** 妖魔有 7 個掉落物，但受限於最多 3-4 個 Icon 與排序，依優先順序選取前 4 個高價值掉落渲染為原始圖示。

---

## 3. Boss Monster Card (Death Knight / 死亡騎士)

*   **移除標記：** 已完全移除 "Boss" Badge、"Boss" 字樣以及 Emoji/皇冠標記。
*   **金色外框與金色名稱：** 
    *   Boss 卡片套用 `.world-atlas-monster-card.is-boss` 暗金色外框。
    *   Boss 怪物名稱字體套用金色樣式 (`var(--accent-gold)`)。
*   **特性 Tag 渲染：**
    依據 code evidence 解析出 `Boss 硬皮`、`地面震裂`、`吸血鬼之吻`、`光球`，並於卡片上渲染為：
    `[硬皮]` `[地裂]` `[吸血鬼之吻]` `[光球]` 
*   **掉落 Icon：** 依暫行決定性排序，僅顯示最高價值的前 4 個掉落圖示，Hover 正常顯示 Tooltip，Click 可呼叫 Item Modal。

---

## 4. 吉爾塔斯 (sanct_giltas) 驗收

*   **正面圖片：** 成功載入 v3.4.17 新增的 463px 寬度大型 Boss 正面圖示，配合 `object-fit: contain` 與 52x52 (或 Modal 中的 104x104) 邊界完美適配，無水平溢出。
*   **特性 Tag 渲染：**
    `[硬皮]` `[狂暴]` `[沙塵暴]` `[岩漿流星雨]` `[毒氣風暴]` `[血壁空間]`。
*   **掉落 Icon：** 吉爾塔斯雖有 78 筆基礎掉落，但卡片僅擷取前 4 個最高價值（主要是傳奇武器/防具）的 drop icon 進行渲染，成功維持資訊簡潔。

---

## 5. 特性 Tag 渲染規則 (Feature Tags)

我們藉由 `monsterFeatures(monsterId)` 函數，將複雜的代碼特徵簡化為玩家熟悉的標籤名：
*   `Boss 硬皮` -> `[硬皮]`
*   `生命回復` -> `[回血]`
*   `狂暴` -> `[狂暴]`
*   其餘 `mag` 至 `mag4` 之 `skn` 鍵 (如 `地面震裂`, `吸血鬼之吻`) -> `[地裂]`, `[吸血鬼之吻]`。
*   無特殊能力時顯示中性的 `無特殊特性`。

---

## 6. 掉落 Icon 與暫行決定性排序限制說明 (Drop Icons & Temporary Sorting)

### 決定性排序演算法 (Deterministic Sorting Algorithm)
為確保全站資料在不建立額外 Mechanic Dataset 的前提下進行決定性排序，我們在 `js/wiki-world-atlas-preview.js` 實作了暫行優先級評估：
1.  **Tier 1 (傳奇裝備)：** `legend === true` 且屬性 `type` 為武器 (`wpn`)、防具 (`arm`)、飾品 (`acc`)。
2.  **Tier 2 (普通裝備)：** `legend !== true` 且屬性 `type` 為 `wpn/arm/acc`。
3.  **Tier 3 (傳奇材料/道具)：** `legend === true` 且屬性 `type === 'etc'`。
4.  **Tier 4 (普通材料/消耗品)：** 其餘所有項目。

*   同 Tier 優先按價格 `price` 降序排列。
*   若價格相同或均無設定，按 `itemId` 字母順序升序排列（如 `acc_100` 排在 `acc_101` 之前）。

> [!WARNING]
> **暫行排序限制 (Temporary Sorting Limit)**
> 本階段採用的 `legend`、`type`、`price` 等屬性分類及排序演算法僅作為前端「最高價值掉落」展示的暫行決定性排序規則。它**並非正式的「遺物/稀有度」機制**，也不對後續裝備或道具屬性架構產生任何相依性。

---

## 7. 自然高度與滾動條驗收 (Scroll Parity)

*   已確認 `.world-atlas-monster-card` 使用 `height: auto` 與 `overflow: visible`。
*   卡片高度隨內容（標籤、掉落 Icon）自然撐高，**完全不含內部滾動條或 `overflow-y: auto` 屬性**。
*   整個頁面維持 `#tab-content-world` 為唯一的垂直滾動條，Modal 本身亦提供獨立的遮罩滾動條，完美符合 Scroll Parity 規格。

---

## 8. 390px Viewport 行動版驗收

*   當螢幕寬度切換至 390px (例如 iPhone 12/13 Viewport) 時：
    *   CSS 中的 `@media (max-width: 480px)` 將自動生效。
    *   怪物卡片自適應為「單欄全寬顯示」，特性 Tag 與掉落 Icon 橫向排列並支援自動換行 (`flex-wrap`)。
    *   無任何水平溢出 (overflow-x)，資訊顯示完全，無重疊或截斷。

---

## 9. 單元測試與 Console Error 驗收

*   **Console Error：** 經實際本機執行，並在瀏覽器模式下驗收，無任何 unhandled exception 或 console error。
*   **自動單元測試：** 新增測試案 61-64，驗證新卡片屬性移除、Boss 金框無 text、Tag 渲染與排序正確性。
*   執行單元測試結果：
    *   `tools/test_world_atlas_preview.js`：**64/64 測試全數通過**。
    *   `tools/test_monster_merged_preview.js`：**9/9 測試全數通過**。
    *   `tools/test_monster_ui_rc.js`：**15/15 測試全數通過**。

---

## 10. 資料集狀態與下一步建議 (Handoff)

*   **資料集變更：** 否，**完全未修改**任何 Monster Dataset、Equipment Dataset、Schema 或 Generator。
*   **進入 RC-2 建議：** **強烈建議直接進入 RC-2**。
    *   RC-1 怪物卡片的 UI 改造已極其完美地合規並通過全部自動測試。
    *   下一個 Sprint (RC-2) 應致力於處理「本機與 snapshot JS 不同步」所導致的 validator 失敗問題，將 `validate_monster_data.py` 和 `validate_equipment_data.py` 修復並使其順利通過，為正式部署奠定基礎。
