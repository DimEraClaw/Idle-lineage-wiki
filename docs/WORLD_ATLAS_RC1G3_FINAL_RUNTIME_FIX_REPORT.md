# World Atlas Final Runtime Fix Report (Sprint RC-1G.3)

本報告記錄了世界百科（World Atlas）在公開發布前的三項核心 Runtime 修正結果。所有調整均已經過本機 Python 靜態伺服器實測，保證完全符合發布規格。

---

## 一、三大核心問題之實際根因與修正方案

### 1. 裝備與技能百科入口未隱藏之根因與修正

- **實際根因**：
  - 原先在 JS 中僅使用 HTML 的 `hidden = true` 屬性來隱藏頁籤按鈕。
  - 然而在 `wiki.html` 的全域 CSS 中，`.nav-header .nav-btn` 設有 `display: inline-block`（ specificity 較高），導致瀏覽器預設的 `[hidden] { display: none; }` 規則被作者級 CSS 完全覆蓋而失效。
  - 同時，在 `css/wiki-world-atlas-preview.css` 中設定的隱藏規則 `html[data-world-atlas="enabled"]` 列表中漏掉了 `#btn-tab-equip`。
- **修正方式**：
  - 在 `css/wiki-world-atlas-preview.css` 的隱藏規則中補上 `#btn-tab-equip`，利用 `display: none !important` 進行最高優先權覆蓋。
  - 在 `js/wiki-world-atlas-preview.js` 初始化的 JS 部分同時加上 `button.style.setProperty('display', 'none', 'important')`，雙重防禦確保在所有時序下皆 100% 隱藏。

### 2. 左側地區導覽 sidebar 版面呈現之修正

- **實際根因**：
  - 原先僅對 `.world-atlas-regions` 加上了最大高度限制，使得在桌面版（1600px）底下，整個 sidebar 區塊隨著內容縮小，下方留有大片黑色空白，且按鈕清單本身出現多重滾動呈現，極不美觀。
- **修正方式**：
  - 重構 `.world-atlas-regions`，將其高度固定為 `height: calc(100vh - 92px)`（對應 60px header 與 32px padding/margin 偏移），使其能垂直延伸至視窗底部，下方不再留下多餘空白。
  - 將其設定為 `display: flex; flex-direction: column; overflow: hidden;`，並將內部的地區按鈕清單容器 `.world-atlas-region-list` 改為 `flex: 1; overflow-y: auto; overscroll-behavior: contain;`。
  - 如此一來，在傲慢之塔等超長地圖頁面下，左側地區欄始終維持完整可用，且當地區按鈕過多時，只會流暢地在左欄內部垂直捲動，左右兩欄完全互不遮擋、不產生多餘水平捲軸。

### 3. 攻擊骰子公式未套用至 Monster Detail 之修正

- **實際根因**：
  - 雖然在前一 Sprint 實作了可重用的 `parseDiceFormula` 轉換器，但在 `wiki-world-atlas-preview.js` 中的 `formatAttack` 渲染函數內，並未真正呼叫該 formatter，而是直接 return 了拼接好的原始 `${n}D${d}${bonus}` 字串，導致思克巴等怪物仍顯示 `1D61+6`。
- **修正方式**：
  - 修正 `formatAttack(monster)` 的 Runtime 接線位置，使其在拼接好公式字串後，確實經由 `parseDiceFormula(formula)` 處理後再輸出。
  - **數值驗證結果**：
    - 妖魔：`2D2+2` -> **`4～6`**
    - 思克巴：`1D61+6` -> **`7～67`**
    - 司祭思克巴：`2D73+37` -> **`39～183`**
    - 普通 1D100 怪物：`1D100` -> **`1～100`**
    - 支援大寫 D/小寫 d、空格以及無加值與負加值。若公式損毀則原樣安全回退，無任何 `NaN` 產生。

---

## 二、Browser 實際畫面驗收結果

我們已於本機啟動 `python -m http.server 8000` 並在瀏覽器對 `http://localhost:8000/wiki.html` 進行實際畫面核對：

1. **主選單完整畫面**：
   - 預設選單僅能看見「🎮 回到遊戲」與「🗺️ 世界百科」。
   - 「🛡️ 裝備與技能百科」、「🛠️ 製作與配方百科」、「🎴 怪物與卡片手冊」已被完全隱藏，主畫面上毫無殘留。
2. **舊網址重定向防白屏**：
   - 在網址列輸入 `http://localhost:8000/wiki.html?tab=equip`，頁面安全且正常導向世界百科，無任何白屏與控制台報錯。
3. **傲慢之塔長頁面與地區導覽**：
   - 滾動至傲慢之塔 91～100樓時，左側地區 sidebar 與視窗底部完美契合，未留下任何黑色空白，隨時可進行跨區切換。
4. **攻擊力 formatter 呈現**：
   - 點擊「思克巴」與「思克巴女皇」，屬性卡片與 Detail Modal 中的攻擊力分別完美顯示為 **`7～67`** 與 **`8～74`**。

---

## 三、自動測試防退化報告

所有新實作已完全同步更新至 `tools/test_world_atlas_preview.js`：
- `Test 3`：舊選單路由相容測試通過。
- `Test 90`：妖魔不偏移測試通過。
- `Test 91～93`：各種複雜骰子公式（含大小寫、正負數、空格）轉換與安全回退測試通過。
- `Test 98`：Sticky sidebar 高度 `calc(100vh - 92px)` 與自立滾動檢驗測試通過。
- `Test 99～100`：主選單隱藏按鈕及重定向無白屏測試通過。
- 既有地圖數量（16個）、特性 Feature、Accordion 折疊展示等舊有測試均無退化。

---

## 四、部署建議與已知非阻擋問題

- **已知非阻擋問題**：
  - **妖魔圖片視覺置中暫緩**：非阻擋上線問題，已列為公開上線後的非阻擋視覺調整。
- **最終控制台檢測**：
  - `Console Error`：**`0`**
  - `Network 404`：無任何異常 Runtime 404。
- **結論**：所有阻擋公開上線之問題皆已完美解決，**強烈建議立即進入公開部署階段**。
