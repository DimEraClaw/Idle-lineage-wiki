# World Atlas Preview v0 報告

## 1. 新增與修改檔案

新增：

- `css/wiki-world-atlas-preview.css`
- `js/wiki-world-atlas-preview.js`
- `tools/test_world_atlas_preview.js`
- `docs/WORLD_ATLAS_PREVIEW_V0_REPORT.md`

最小修改：

- `wiki.html`：加入 Preview 專用 CSS、JavaScript 與 `worldPreview=1` 初始化接線。

本階段未修改 Dataset、Schema、Generator，也未取代既有 Monster Wiki。

## 2. Preview URL

`wiki.html?worldPreview=1`

未帶參數時不建立 World Atlas Tab 或內容容器，既有頁面維持原狀。

## 3. 版面配置

- 左欄：16 個既有卡片地區，可直接切換地區。
- 中欄：目前地區、單一搜尋框、地圖 Filter Tabs、怪物卡與既有 NPC 區塊。
- 右欄：點選怪物後顯示完整 Detail 資料卡。
- 窄螢幕：左欄改為可折疊的地區選擇器；Detail 改為由下方開啟的 Drawer。

地區切換後，中欄立即顯示該地區全部怪物，不要求使用者再次選擇地區。

## 4. Monster Card 樣式

每張卡片高度限制在約 280px，直接顯示名稱、Lv、種族、屬性、HP、AC、MR 與 Boss 標記。圖片資料缺少時使用明確的佔位符，不猜測圖片。

卡片內含「特性」、「出沒地圖」、「掉落」三個收合區塊，預設全部關閉；實際操作可個別展開。

## 5. Detail Layout

右側 Detail 顯示名稱、Boss 狀態、Lv、種族、屬性、HP、攻擊、命中、AC、MR、EXP 與 Gold，並提供「特性」、「出沒地圖」、「掉落」、「技術資料」四個收合區塊。無資料欄位顯示「資料尚未建立」。

## 6. Map Tabs

Map Tabs 僅作為目前結果的即時 Filter，不是第二層導覽。地區模式提供「全部」與該地區可辨識的地圖；搜尋模式提供「全部結果」與符合結果的地圖。

## 7. NPC 區塊

只讀取既有 `data/craft/npcs.json`。NPC 位置文字可與目前 Map 標籤相容時，顯示於怪物區塊下方；找不到資料時不顯示、不補造。以「沉默洞穴」實測可列出 3 筆既有 NPC。

## 8. 已知限制

- 專案尚未建立正式 Region Entity／Region ID；左側沿用現有卡片地區定義，地區與 Map 的部分關係仍是既有名稱相容結果。
- Monster 圖片尚無正式資料來源，因此只顯示佔位符。
- NPC 尚無 Map EntityRef；目前僅以既有位置文字做 Preview 級相容比對。
- 搜尋與地圖分群是操作預覽，不建立新的索引或 Dataset。
- Equipment Dataset 已由既有 Repository 載入，但本版介面未新增 Equipment 專屬區塊。

## 驗收結果

- World Atlas Preview tests：10/10 passed。
- Monster Merge Preview：9/9 passed。
- Monster UI RC：15/15 passed。
- Monster UI Beta：21/21 passed。
- Equipment UI RC：72/72 passed。
- Preview 與必要 JSON／CSS／JavaScript：HTTP 200。
- Preview Console Error：0。
- 一般模式未建立 World Atlas UI。
- `git diff --check`：passed。

本階段未 commit、未 push。
