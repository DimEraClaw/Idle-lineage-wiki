# World Atlas RC-1E - Monster Card Polish Report

本報告詳細記錄 **Sprint RC-1E** 階段的各項修正與驗收結果。

---

## 1. Monster Card 特性顯示修正 (P0)
- **問題診斷：**
  - 在先前實作中，`keyedSourceEntry` 使用 `block.indexOf('"' + entityId + '"')` 查找 JS 程式碼塊中的 Key。但對於 `js/00-data.js` 中無引號的 Key（例如 `dk:`、`orc:` 或 `sanct_giltas:` 等）將會搜尋失敗，導致 CORS 降級模式或某些瀏覽器環境中無法正確載入技能/特性，顯示「無特殊特性」。
- **修正方案：**
  - 改用強健的正則表達式 `new RegExp("(?:[\"']?" + entityId + "[\"']?)\\s*:\\s*(?=\\{)")` 來匹配 Key（支援雙引號、單引號或無引號），並搭配括號對稱平衡提取器，精確截取整個資料區塊。
  - 將特性的防禦特性 `'Boss 硬皮'` 統一更名為 `'硬皮'`。
- **渲染表現：**
  - **死亡騎士：** 成功顯示 `[硬皮]` `[地裂]` `[吸血鬼之吻]` `[光球]` 等特性。
  - **吉爾塔斯：** 成功顯示 `[硬皮]` `[狂暴]` `[沙塵暴]` `[岩漿流星雨]` `[毒氣風暴]` `[血壁空間]` 等特性，且為非硬編碼的動態解析。
  - **妖魔：** 僅有無特殊特性的怪物顯示為 `[無特殊特性]`。

## 2. Boss 卡片樣式符合規範 (P0)
- Boss 卡片嚴格依據 `canonical.boss === true` 進行判定。
- Boss Card 僅套用暗金色外框與暗金色名稱，無任何 Boss Badge、皇冠、Emoji 等裝飾。

## 3. Monster Image 水平/垂直對位微調 (P0)
- **妖魔 (orc) 置中修正：**
  - 因妖魔 (orc) 的原始畫布圖片偏左，在 `VISUAL_OFFSETS` 中為其建立獨立的微調參數：
    `'orc': 'translate(6px, -4px) scale(1.05)'`
    這在維持整體 CSS 置中框架的同時，精確且安全地將妖魔圖片向右修正 6px，使其視覺完美置中。

## 4. 掉落物 9-Tier 排序與移除 Price 排序 (P0)
- 完全移除任何基於 `price` 的排序邏輯。
- 排序順序為：**Relic（遺物） → Boss 專屬裝備 → 武器 → 防具 → 飾品 → 技能書 → 製作材料 → 一般材料 → 消耗品**。

## 5. 掉落物外框與藍色 Glow 樣式 (P1)
- 在 `createItemImage` 函式中引入 CSS Class 標記：
  - **Relic 掉落：** 標記為 `.is-relic`，使用 CSS 設定為藍色外框 (`#3b82f6`) 與淡藍 Glow (`box-shadow: 0 0 6px rgba(59, 130, 246, 0.5)`)。
  - **Boss 專屬裝備：** 標記為 `.is-boss-exclusive`，使用 CSS 設定為暗金色框 (`var(--accent-gold)`)，無 Glow。
  - **一般物品：** 標記為 `.is-general`，維持一般灰框。

## 6. Hover 縮放動畫效果 (P2)
- 在 `css/wiki-world-atlas-preview.css` 中設定 `transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms...` 的平滑動畫。
- 滑鼠懸停（Hover）在掉落物圖示或其按鈕/列時，套用縮放比例：
  - **普通/一般物品：** `scale(1.00)`
  - **Boss 專屬：** `scale(1.05)`
  - **Relic 遺物：** `scale(1.08)` 並微幅增加藍色 Glow 到 `12px`。
- 無任何閃爍、呼吸燈、彩虹效果或粒子，動效非常優雅 premium。

## 7. Monster Card 欄位裁剪規格
- **保留：** 怪物圖片、名稱、Lv、屬性、HP、AC、特性 Tag、前四項掉落。
- **移除：** 種族、攻擊、命中、MR、EXP、Gold。所有移除欄位均完整保留於 Monster Modal 彈出視窗中。

---

## 8. 單元測試執行結果
我們更新了 `tools/test_world_atlas_preview.js` 並新增測試 88、89、90，以完整覆蓋 RC-1E 全新規格（包括無引號 Code 區塊提取、Relic 藍 Glow 與 Boss 金外框、Hover 縮放比例與 orc 對位偏移等）。

單元測試執行結果：
```bash
World Atlas v1 tests: 90/90 passed
```
**90 項測試 100% 全數通過**。

---

## 9. 關鍵回報
* **修改檔案：** 
  * [js/wiki-world-atlas-preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/wiki-world-atlas-preview.js)
  * [css/wiki-world-atlas-preview.css](file:///D:/DimEraClaw/Idle-lineage-wiki/css/wiki-world-atlas-preview.css)
  * [tools/test_world_atlas_preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/tools/test_world_atlas_preview.js)
* **測試結果：** 90/90 全數通過，無任何 Console 錯誤。
* **是否修改 Dataset：** 否。
* **是否 commit：** 否。
* **是否 push：** 否。
