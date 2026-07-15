# 怪物百科整合 Quick Preview v0 報告

## 結論

已完成以 `monsterMerge=1` 啟用的可操作預覽。預覽把既有 Monster Dataset 查詢、`REGIONS_DATA` 地區卡片手冊與掉落反向查詢集中在同一個「怪物百科」入口；未帶旗標時，既有「怪物與卡片手冊」與「怪物百科」仍各自存在，原有行為不變。

預覽網址：

`wiki.html?monsterMerge=1&tab=monster`

## 修改檔案

- `js/wiki-monster-merged-preview.js`：預覽旗標、整合導覽、地區模式、卡片手冊關聯、Detail 補充與安全 fallback。
- `js/wiki-monster-view.js`：只增加預覽啟用時的 `region` 模式委派與 Detail 擴充 hook。
- `wiki.html`：新增預覽 script、隱藏的地區模式按鈕、`REGIONS_DATA` 唯讀接線與旗標初始化。
- `tools/test_monster_merged_preview.js`：預覽、資料量、重複 Entity、unresolved、fallback 與行動版控制測試。
- `docs/MONSTER_MERGED_PREVIEW_REPORT.md`：本報告。

未修改 CSS、Dataset、JSON、Schema、Generator、Validator、Equipment、Craft 或 WikiDataCore。

## 整合方式

### Monster 資料來源

- `data/monster/monsters.json`：469 筆 Monster Entity。
- `data/monster/maps.json`：217 筆 Map。
- `data/monster/drop_tables.json`：441 筆 DropTable。
- `js/wiki-monster-data.js`：既有唯讀 Repository 與搜尋／掉落反向索引。

### 卡片與地區資料來源

- `wiki.html#REGIONS_DATA`：16 個地區、590 筆地區怪物引用、408 個唯一顯示名稱。
- 地區資料包含套裝屬性、三段加成、怪物顯示能力、地圖與舊掉落顯示資料。
- 現有 Wiki 靜態資料沒有玩家收藏進度，因此預覽明確顯示「資料尚未建立」，不讀取或虛構玩家存檔。

### 關聯策略

- 正式操作與 Deep Link 一律使用既有 Monster ID。
- Quick Preview 的舊卡片顯示資料只以「唯一完全同名」做唯讀相容性查找，不把中文名稱保存為正式外鍵，也不產生新 ID。
- 590 筆地區引用中，589 筆可對應到 407 個唯一 Monster Entity。
- `地獄奴隸` 同名對應兩個 Monster ID，維持 unresolved，卡片可顯示舊資料但不宣稱正式 Entity。
- 同一 Monster 出現在多個地區時，所有地區卡片都指向同一既有 Monster ID，不建立重複 Entity。

## 預覽資訊架構

整合頁提供三個模式：

1. 怪物：沿用名稱與 Monster ID 搜尋。
2. 地區卡片：顯示 16 個既有地區、套裝加成、地圖篩選、Boss 與一般怪物清單。
3. 掉落物：沿用 Item ID／名稱反向查詢掉落怪物與基礎掉率。

地區內容可由側欄或主內容的地區選擇器切換。主內容選擇器與查詢結果開關確保既有行動版側欄收合時仍有操作入口；未新增或改寫 CSS。

## Monster Detail

正式 Monster Detail 沿用既有內容並補充：

- 名稱、等級、Boss、HP。
- 出現地圖與基礎掉落。
- Monster ID 與原始驗證來源。
- 卡片手冊所屬地區、AC、屬性及卡片狀態。
- Monster Dataset 與卡片手冊的等級、HP 或 AC 不一致時，同時保留兩份來源並標示待驗證，不靜默覆蓋。

僅有卡片手冊資料的項目會顯示舊資料與「Monster ID：資料尚未建立」，不偽裝成正式 Entity。

## URL 與導覽

- `monsterMerge=1`：隱藏舊卡片入口，只保留「怪物百科」。
- `tab=cards&monsterMerge=1`：受控轉入整合怪物百科。
- 未帶 `monsterMerge=1`：原有兩個入口、標題與模式不變。
- 支援 `monsterMode=monster|region|drop`、`monsterRegion`、`monsterSearch` 與既有 `monster` Deep Link。
- Reload、Back、Forward 均保留整合狀態與正式 Monster Detail。

## Fallback

- 三份 Monster JSON 任一載入失敗時，不啟用整合導覽，既有卡片頁仍保留，頁面退回安全分頁。
- 地區／卡片資料缺漏不阻擋 Monster Repository 與 Monster 搜尋。
- 無正式 ID、MR、卡片狀態或其他不可驗證欄位時顯示「資料尚未建立」。
- 不拋出未捕捉錯誤，不修改任何 Dataset。

## 驗證結果

### 自動測試

- Monster merged preview：9/9 passed。
- Monster UI RC：15/15 passed。
- Monster UI Beta：21/21 passed。
- Equipment UI RC：72/72 passed。
- Equipment View Adapter：71/71 passed（首次完整回歸）。
- WikiDataCore：passed；Craft 279 recipes／47 NPCs／471 items。
- `git diff --check`：passed。

### 瀏覽器驗收

- 整合導覽：舊卡片入口確實隱藏，Monster 入口與三模式顯示正常。
- 一般模式：舊卡片入口仍顯示，地區模式按鈕維持隱藏，標題未改。
- Monster Dataset：469 筆載入完成。
- 地區：16 個；銀騎士村 19 筆，時空裂痕 Boss 4 筆。
- 地區主內容選擇器、查詢結果開啟／關閉按鈕：實際操作正常。
- 妖魔 Detail：地圖、7 筆基礎掉落、卡片手冊資料與來源證據正常。
- 掉落搜尋：`歐西斯匕首` 可反查妖魔與 1% 基礎掉率。
- Deep Link、Reload、Back、Forward：正常。
- Console Error：0。
- 必要 HTML、三支 JS 與三份 Monster JSON：HTTP 200，未觀察到新增 404。

### 行動版驗收說明

既有 `max-width: 1024px` 版面會收合側欄；本預覽已提供主內容地區選擇器及查詢結果開啟／關閉控制，避免 390px 下失去地區與搜尋結果入口。本次內建瀏覽器的 viewport override 仍回報固定 1280px，因此未能完成真實 390px 像素級視覺驗收；應在正式啟用前以實機或可用的裝置模擬再確認一次。

## 已知限制

- 沒有玩家卡片收藏 Dataset，不能顯示真實收藏張數或目前已啟用加成。
- Region 尚無正式 Entity ID；本預覽保留 `REGIONS_DATA.key` 作為預覽 URL 狀態，不宣稱為正式 Region identity。
- 卡片手冊舊數值與 Monster Dataset 可能不同，預覽只揭露差異，不裁決權威來源。
- `地獄奴隸` 維持同名多 ID conflict。
- 真實 390px 視覺驗收仍待補做。

## 建議

Quick Preview v0 已足以讓玩家試用整合資訊架構，但不建議立即取代正式導覽。下一個最小步驟應先收集預覽回饋並完成實機 390px 驗收；若方向確認，再以既有 machine-readable mapping 取代 runtime 相容性查找，並另行設計玩家卡片收藏狀態與靜態百科資料的邊界。
