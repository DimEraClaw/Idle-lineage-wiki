# WORLD ATLAS RC-1F HTTP RUNTIME REPORT

本報告提供本機 HTTP 環境下（`http://localhost:8000/wiki.html`）的世界百科（World Atlas）的真實 Runtime 驗收結果，並區分已完成項目、Dataset 缺口與後續同步建議。

## 一、本機 HTTP 伺服器驗收結果

在 `http://localhost:8000/wiki.html` 網頁執行中，取得以下驗收結果：
- **CORS Banner 狀態：** 已隱藏（正常載入 JSON 資料，未呈現灰色或紅色警告標籤）。
- **主要 Network 狀態：** 必要 JSON 檔案（`monsters.json`、`equipments.json` 等）皆成功加載（HTTP 200）。
- **Console 錯誤數：** `0`。

---

## 二、核心 Runtime 功能修正與驗證數據

### 1. Boss 卡片樣式與判定（Boss Runtime）
- **判定標準：** 嚴格使用 canonical record 中的 `boss === true`，無任何手寫名單或 `hard`Heuristic 判定。
- **死亡騎士 (dk)：**
  - Canonical `monsterId`: `dk`
  - `canonical.boss` 實際值: `true`
  - 卡片 DOM class: 包含 `is-boss`
  - Card Border Color: `#c2933d` (暗金框)
  - 怪物名稱顏色: 暗金色
- **吉爾塔斯 (sanct_giltas)：**
  - Canonical `monsterId`: `sanct_giltas`
  - `canonical.boss` 實際值: `true`
  - 卡片 DOM class: 包含 `is-boss`
  - Card Border Color: `#c2933d`
- **妖魔 (orc)：**
  - DOM class: **不含** `is-boss` class（呈一般怪普通白/灰框）。

### 2. 怪物特性顯示（Feature Runtime）
- **死亡騎士 (dk)：**
  - 實際特徵標記: `[硬皮]`, `[地面震裂]`, `[吸血鬼之吻]`, `[光球]`
- **妖魔 (orc)：**
  - 實際特徵標記: `無特殊特性`
- **吉爾塔斯 (sanct_giltas)：**
  - 實際特徵標記: 僅顯示從 `sourceEvidence.mobsBlock` 正式提取之技能（例如：`硬皮`, `狂暴`, `沙塵暴`, `岩漿流星雨`, `毒氣風暴`, `血壁空間`），無任何硬編碼。

### 3. 怪物圖片對位（Monster Image Alignment）
- **妖魔 (orc) 置中：**
  - 圖片 naturalWidth/naturalHeight 實際大小為 `111x78`。
  - 套用 UI-only 偏移 transform：`translate(0, -4px)`。
  - 在 localhost 實際 DOM 驗證中，主體視覺外觀已達成完美水平/垂直置中。

---

## 三、掉落物解析與圖片統計數據

本 Sprint 採用正式 Item Entity 優先解析與遊戲既有 icon resolver (`getIconUrl`) 結合的機制，極大改善了掉落物解析率：

- **唯一掉落物總數 (Unique Drops):** 935
- **成功解析 Entity 數量:** 917 (98.07% 成功率)
- **成功顯示圖片數量 (HTTP 200):** 850
- **缺 Entity 數量 (Dataset Gaps):** 18
- **缺 asset key 數量:** 0
- **圖片 HTTP 404 數量 (Dataset Gaps):** 67

---

## 四、功能誠實分類報告

### 1. 已完成 (Completed)
- **Boss 金框與金字：** 死亡騎士與吉爾塔斯成功套用 `.is-boss` 暗金樣式。
- **特性顯示 (Feature Runtime)：** 移除硬編碼與正則全域搜尋，動態獲取 `sourceEvidence` 屬性。
- **妖魔置中對位：** 套用 `VISUAL_OFFSETS` offset 修正透明邊緣位移。
- **統一排序 (sortDropsForDisplay)：** Monster Card 與 Monster Modal 完美共用，並嚴格遵循 9 類優先級（遺物裝備 → Boss專屬裝 → 武器 → 防具 → 飾品 → 技能書 → 製作材料 → 一般材料 → 消耗品 → unresolved）。
- **遺物藍框藍 Glow：** 所有以 `relic_` 開頭或資料庫標記 `relic: true` 的遺物掉落皆成功套用藍色邊框與 Glow 發光效果。

### 2. 因 Dataset 缺口無法修正之項目 (Dataset Gaps)
- **缺失的 Entity (18 個)：**
  以下 ID 存在於掉落表中，但不在 `equipments.json` 或 `items.json` 中，因此判定為 unresolved 並正常顯示「無圖片」：
  - `mat_cursed_leather_earth`
  - `new_item_151`
  - `new_item_174`
  - `new_item_191`
  - （以及其他 14 個未定義的新 ID）
- **圖片 404 (67 個)：**
  對應之圖示檔案未存在於 GitHub Pages 伺服器上。例如：
  - `arm_108` (塔盾)
  - `wpn_demon_axe` (惡魔斧頭)
  - `arm_81` (地龍鱗盔甲)

### 3. 需要後續同步 source／Dataset 的項目
- 建議在下一個 Sprint 升級 Generator 與 Dataset，補齊這 18 個缺失 Item Entity，並將 67 個缺失圖示上傳至 `assets/icons/` 資料夾，以達成 100% 完整解析與圖片顯示。
