# Monster UI Release Candidate Report

## 1. 範圍與結果

Monster UI Release Candidate 已將既有 Monster UI Beta 從 query opt-in 調整為預設啟用的正式分頁。玩家不需要加入 `monsterUI=1`；頁面載入後會嘗試讀取三份必要 Monster JSON，全部成功才顯示怪物百科。任一必要資料失敗時維持既有安全 fallback，不影響 Equipment、Craft 或 Cards。

本階段沒有新增 Monster 功能、沒有修改 CSS，也沒有修改任何 Dataset、Schema、generator、validator、mapping、Craft／Cards／Equipment 主資料或 WikiDataCore。

## 2. 新增／修改檔案

新增：

- `docs/MONSTER_UI_RC_REPORT.md`
- `tools/test_monster_ui_rc.js`

修改：

- `wiki.html`
- `js/wiki-monster-view.js`

未修改：

- `js/wiki-monster-data.js`
- `tools/test_monster_ui_beta.js`

## 3. 正式啟用方式

- 正式開關為 `window.MONSTER_UI_ENABLED = true`。
- 初始化不再要求 `monsterUI=1`，預設會嘗試載入 Monster Dataset。
- 必要 Dataset 全部成功後，View 才將 `btn-tab-monster` 顯示並設為 ready。
- 診斷屬性使用正式命名：`data-monster-ui-mode`、`data-monster-ui-ready`、`data-monster-ui-counts`。
- 玩家可見導覽與頁面標題均為「怪物百科」，不再顯示 Alpha／Beta。

保留 `monsterUI=1` 作為舊網址相容條件；它不再是正式功能的必要條件，也不會被目前 URL state 邏輯主動移除。

## 4. Dataset 依賴

Required Dataset：

- `data/monster/monsters.json`
- `data/monster/maps.json`
- `data/monster/drop_tables.json`
- `data/monster/unresolved.json`

Required Dataset Commit：`eaf79d3 feat(monster): add generated monster datasets`

Runtime 必要讀取前三份 JSON。`unresolved.json` 是正式 Dataset 組成，但目前 UI 不直接 fetch。前三份必要資料任一缺失、HTTP failure、parse error、document envelope error 或 identity error 時，不得顯示怪物百科為可用狀態。

## 5. URL 規格與相容

正式 URL state：

- `tab=monster`
- `monster=<canonical monsterId>`
- `monsterSearch=<keyword>`
- `monsterMode=monster|drop`

正式範例：

- `wiki.html?tab=monster`
- `wiki.html?tab=monster&monster=orc`
- `wiki.html?tab=monster&monsterMode=drop&monsterSearch=<keyword>`

舊網址 `wiki.html?monsterUI=1&tab=monster&monster=orc` 維持相容，並在搜尋、Detail 與 history URL 更新時保留 `monsterUI=1`。Deep link、reload、Back、Forward、Detail close 與不存在 ID 的既有行為均未改變；不存在 ID 顯示「找不到此怪物資料」，不自動選擇第一隻怪物。

## 6. Fallback

RC 自動測試已分別驗證：

1. `monsters.json` 404。
2. `maps.json` 404。
3. `drop_tables.json` 404。
4. JSON parse error。
5. Item label source failure。

必要 JSON 失敗結果：

- Repository `ready=false`，索引清空。
- Monster Tab 保持 hidden。
- `tab=monster` 初始化路徑回退 Equipment。
- failure 由 `load()` 捕捉，只產生一筆預期 `console.warn`，沒有未處理 Error。
- Equipment、Craft、Cards 的初始化與導覽接線保持不變。

Item label source 失敗結果：

- Repository 與 Monster Tab 仍為 ready。
- 掉落反查與 Detail 繼續運作。
- Item label 無法解析時顯示正式 Item ID，不猜測名稱。

## 7. 自動測試

新增 `node tools/test_monster_ui_rc.js`：15／15 passed，涵蓋：

- 預設正式開關與正式診斷命名。
- 無 `monsterUI=1` 載入三份 JSON並顯示 Tab。
- 正式與舊 deep link。
- 不存在 ID、Monster 搜尋、Drop reverse lookup。
- Reload、Back／Forward、Detail close URL。
- 三份 JSON 個別 404 與 parse fallback。
- Item label fallback。
- 重複初始化／事件綁定防護。
- 玩家可見 Alpha／Beta 字樣與既有分頁 baseline。

完整回歸結果：

- `node --check js/wiki-monster-data.js`：passed。
- `node --check js/wiki-monster-view.js`：passed。
- `node --check tools/test_monster_ui_beta.js`：passed。
- `node --check tools/test_monster_ui_rc.js`：passed。
- Monster validator：Schema passed；460 Monster、214 Map、433 DropTable、3,655 DropEntry；deterministic hashes unchanged。
- Monster data tests：7／7 passed。
- Monster Beta tests：21／21 passed。
- Monster RC tests：15／15 passed。
- Mapping validator：passed；blocking count 0。
- Mapping tests：30／30 passed。
- Craft validator：passed；279 recipes、47 NPC、471 indexed items。
- WikiDataCore tests：passed；consoleErrors 為空。
- `git diff --check`：沒有 whitespace error；只有本階段前既有文件與 working-copy 的 LF→CRLF warning。

## 8. 瀏覽器驗收

本機靜態伺服器實測：

- `wiki.html`：Monster mode=`enabled`、ready=`true`；索引為 460 Monster、214 Map、433 DropTable、886 unique drop items、1,019 item labels；怪物百科按鈕預設可見。
- `wiki.html?tab=monster`：直接開啟怪物百科，不需要旗標。
- `wiki.html?tab=monster&monster=orc`：還原妖魔 Detail，顯示 level 2、HP 6、11 張地圖與 7 筆基礎掉落。
- `wiki.html?monsterUI=1&tab=monster&monster=orc`：舊網址正常，query 保留。
- Monster ID `orc` 搜尋命中妖魔。
- 物品名稱「歐西斯之矛」可反查妖魔。
- 關閉 Detail 後移除 `monster`；Back 還原妖魔，Forward 還原關閉狀態；重新載入 deep link 仍顯示妖魔。
- Equipment、Craft、Cards、Monster 四個導覽按鈕均實際點擊，active pane 與內容正常。
- 390×844 viewport：`html` 與 `body` 的 client width／scroll width 均為 390px，沒有水平溢出；妖魔 Detail 正常顯示。

## 9. Console／Network

- 四種指定 URL 與 390px 驗收頁面的 Browser Console Error：0。
- `wiki.html`、五份本機 Wiki scripts 與三份必要 Monster JSON 逐一 HTTP 驗證均為 200。
- 正常模式 Network 404：0。
- fallback 自動測試僅包含刻意注入的必要 JSON failure，沒有未處理 Error。

## 10. 既有功能回歸

- Equipment：按鈕可操作，Equipment pane active，既有內容正常。
- Craft：按鈕可操作，Craft pane active，既有內容正常。
- Cards：按鈕可操作，Cards pane active，既有內容正常。
- Monster UI 僅保留 Beta 已有的搜尋、Detail、地圖、基礎掉落、反向查詢、deep link、URL/history 與 Item label fallback。

## 11. 尚未處理的限制

- 213 個唯一 Base Drop Item ID 仍無 `EQUIP_DATA` label，維持 unresolved。
- 不包含特殊或條件掉落、runtime modifier 後機率、Card、Quest、Boss／Map filter、排序與全站搜尋。
- 沒有建立 Item Dataset、WikiDataCore Monster repository 或新的跨 Domain 功能。
- 未修補 Monster Dataset 的既有 unresolved records。

## 12. 提交與部署建議

建議將本 RC 的兩個修改檔與兩個新增檔作為獨立 Commit，並與 Required Dataset Commit `eaf79d3` 一起部署。部署前應再次確認四個 RC 檔案的 staged 範圍，且 GitHub Pages 可取得三份 runtime 必要 JSON。
