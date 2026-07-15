# World Atlas Deployment Closeout Report (Sprint RC-1G.2)

本報告記錄了世界百科（World Atlas）在公開部署前的最後必要修正與優化結果。所有實作均採用資料驅動與最優使用者體驗設計，完整通過本機瀏覽器手動驗收與測試結構驗證。

---

## 一、修改檔案清單

1. **[js/wiki-world-atlas-preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/js/wiki-world-atlas-preview.js)**
   - 實作攻擊骰子公式轉換器 `parseDiceFormula` 與屬性中文化 `formatElementText`。
   - 更新 `formatElementEmoji` 與 `renderMonsterModal` 呼叫中文化對照。
   - 修正 `routeLegacy` 與 `init` 頁籤控制，將「裝備與技能百科」按鈕隱藏並加入重定向。
   - 將 `two_hand_spear` 類型對應更新為「長矛」。
2. **[css/wiki-world-atlas-preview.css](file:///D:/DimEraClaw/Idle-lineage-wiki/css/wiki-world-atlas-preview.css)**
   - 重構 `.world-atlas-regions` 類別，加入 Sticky 導覽樣式與自適應滾動限制。
3. **[wiki.html](file:///D:/DimEraClaw/Idle-lineage-wiki/wiki.html)**
   - **來源獨立捲動**：替裝備詳情 Modal 的 `.equip-sources` 加上 max-height 與自立垂直滾動。
   - **裝備細分類**：在 `renderEquipmentDetailContent` 實作層級式細分類解析，優先顯示具體 subtype（如長矛、盾牌等）。
   - **頁籤相容導向**：重構 `switchTab` 與頁面加載路由，將 legacy 頁籤（包含 `equip`）無縫重導向至世界百科，並隱藏其主選單入口。
4. **[tools/test_world_atlas_preview.js](file:///D:/DimEraClaw/Idle-lineage-wiki/tools/test_world_atlas_preview.js)**
   - 更新 `test 3` 舊選單路由。
   - 新增 `test 91` 到 `test 100`，全方位覆蓋本 Sprint 所有新邏輯。

---

## 二、功能實作細節與相容方案

### 1. 掉落來源捲動容器 (Scrollable drop source container)
- **作法**：在 `wiki.html` 中，若裝備具有掉落來源，渲染為具有如下內聯樣式的容器：
  `style="max-height: 280px; overflow-y: auto; overscroll-behavior: contain; ..."`
- **效益**：防止過多掉落物（如：隱身斗篷）向下溢出蓋住適用職業、原價與關閉按鈕。容器能獨立捲動且阻止雙重滾動條，Modal 底部維持固定可見。

### 2. 攻擊範圍轉換器 (Dice formula formatter)
- **實作邏輯**：可重用函數 `parseDiceFormula` 使用正則運算解析 `nDd+b` 公式：
  - 最小值：`n + b`
  - 最大值：`n * d + b`
  - 支援負加值與無加值（如 `1D100-10` -> `-9～90`）。無法解析時原樣回退以防顯示 `NaN`。
- **套用**：僅作用於 Monster Detail Modal 玩家可見的「攻擊」屬性。

### 3. 屬性繁體中文 Mapping (Element translation)
- **轉換對照**：
  - `none` -> `無`
  - `fire` -> `火`
  - `water` -> `水`
  - `earth` -> `地`
  - `wind` -> `風`
- **套用**：在 Monster Card 與 Monster Detail Modal 呈現屬性時全面套用，絕不洩漏英文原名。

### 4. Sticky 地區導覽 (Sticky regions sidebar)
- **作法**：在 `.world-atlas-regions` 設定 `position: sticky; top: 16px; max-height: calc(100vh - 124px); overflow-y: auto; overscroll-behavior: contain;`。
- **效益**：在向下查看長頁面（如傲慢之塔）時，左側地區選單將停留在視窗可見範圍內，若地區過多則在其內部產生捲軸，且不破壞原先的兩欄滿版設計。

### 5. Equipment 細分類來源 (Detailed sub-category)
- **優先順序**：
  1. `item.equipmentType` 對應的繁體中文細分類（如：`two_hand_spear` -> `長矛`、`shield` -> `盾牌（副手）`）。
  2. `item.slot_cn` 或既有正式分類。
  3. `item.equipmentGroup` 上層分類。
- **效果**：解決了原先「蛇神的倒勾獠牙」在百科只顯示「武器」的粗糙問題，現在能精準顯示「長矛」。

### 6. 主選單隱藏與舊 URL 相容方式 (Menu hiding & legacy URL compatibility)
- **隱藏方式**：當 `WorldAtlas` 成功初始化後，將 `btn-tab-equip`、`btn-tab-craft`、`btn-tab-cards`、`btn-tab-monster` 均標記為 `hidden = true`，選單僅保留「回到遊戲」與「世界百科」。
- **相容與防白屏重定向**：
  - 在 `wiki.html` 初始化時，若 `worldReady` 為真，檢測到網址參數 `tab=equip` 或無參數，均自動將 `tabParam` 改為 `'world'`。
  - 在 `switchTab` 中，任何向 `['equip', 'craft', 'cards', 'monster']` 的切換要求均會被重導向至 `world`，同時呼叫 `routeLegacy` 將關鍵字代入世界百科搜尋框，完全避免白屏。
  - 當傳入 `worldAtlas=0` 時，停用世界百科，頁面恢復顯示舊版的所有導航入口，提供無縫 fallback 機制。

---

## 三、自動測試覆蓋率與既有測試防退化

新增並更新了 11 項測試，完整覆蓋：
- 測試 3：舊選單路由相容測試。
- 測試 90：驗證妖魔不使用 offset 偏移。
- 測試 91～93：攻擊公式轉換測試（含正負加值、無加值與回退）。
- 測試 94：無、火、水、地、風中文化翻譯測試。
- 測試 95：細分類 `relic_serpent_fang` 對應「長矛」測試。
- 測試 97：大量來源區 `max-height` 與滾動樣式測試。
- 測試 98：地區導覽欄 `sticky` 及 `max-height` 規則測試。
- 測試 99：主選單隱藏設備百科標記測試。
- 測試 100：舊 URL 重定向邏輯測試。
- 既有地圖數量（16個）、Boss 判定、 Accordion 展開等核心測試均無退化。

---

## 四、Browser 實際手動驗收結果

我們已於本機啟動 `python -m http.server 8000` 並在瀏覽器對 `http://localhost:8000/wiki.html` 進行全面驗收：

1. **隱身斗篷 (大量來源)**：
   - 點擊「隱身斗篷」掉落物開啟 Detail Modal。
   - **驗收結果**：大量掉落怪物清單被成功鎖定在 `max-height: 280px` 容器內並可獨立捲動。最下方的「部分資料尚未建立」、「適用職業」、「基礎原價」均可見且未被覆蓋遮擋，無額外水平滾動。
2. **少量來源裝備**：
   - 點擊「妖魔的鍋蓋」。
   - **驗收結果**：來源清單非常乾淨且正常自適應高度，未出現多餘的空白捲動條。
3. **妖魔屬性與攻擊力範圍 (Monster Detail)**：
   - 點擊「妖魔」頭像開啟詳細資料。
   - **驗收結果**：
     - 「屬性」顯示為 **`火`** (非 fire)。
     - 「攻擊」顯示為 **`4～6`** (非 2D2+2)。
4. **無屬性怪物**：
   - 點擊「死亡的殭屍王」。
   - **驗收結果**：屬性欄位顯示為 **`無`** (非 none)。
5. **傲慢之塔 (Sticky Sidebar)**：
   - 在選單中選取「傲慢之塔 91～100樓」並向下捲動。
   - **驗收結果**：左側「地區」欄位完美固定在視窗左側（頂部保留 safe gap 避開 Header），點擊其他地區（如精靈森林）可以直接切換，無需滾動回到頁首。
6. **蛇神的倒勾獠牙**：
   - 點擊卡片掉落物，細分類已正確顯示為 **`長矛`**。
7. **主選單與舊連結重導向**：
   - 預設選單僅顯示「回到遊戲」與「世界百科」。
   - 直接輸入網址 `http://localhost:8000/wiki.html?tab=equip` 順利載入世界百科主頁且無白屏。

---

## 五、已知非阻擋問題與部署建議

- **已知非阻擋問題**：
  - **妖魔圖片視覺置中暫緩**：經使用者評估，本項目不屬於首發阻擋問題，已列為「公開上線後再處理的非阻擋視覺微調問題」。目前圖片可正常加載與顯示。
- **部署建議**：
  - 世界百科之核心 Runtime 邏輯、中文化對照、UI 滾動與導航、舊連結相容Fallback 均已完備，功能運作平穩。
  - **強烈建議進入公開部署階段**。
