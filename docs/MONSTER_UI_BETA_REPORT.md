# Monster UI Beta Report

## 1. 範圍與結果

Monster UI Beta 在 Alpha 的 Feature Flag 邊界內加入可分享 deep link、URL／history 狀態還原、正式 Item label、掉落反向查詢與玩家優先的 Monster Detail。必要 Monster Dataset、Schema、generator、validator、Mapping、Craft、Cards、Equipment 主資料及 WikiDataCore 均未修改。

Feature Flag 仍為 `window.MONSTER_UI_ALPHA = false`，且只有 `monsterUI=1` 才載入三份 Monster JSON 並顯示 Monster Tab。

## 2. 新增／修改檔案

新增：

- `tools/test_monster_ui_beta.js`
- `docs/MONSTER_UI_BETA_REPORT.md`

修改：

- `js/wiki-monster-data.js`
- `js/wiki-monster-view.js`
- `wiki.html`

沒有新增 `js/wiki-monster-item-adapter.js`。現有內嵌資料可直接以一個小型 label source API 接入，不需要建立另一個 Item Repository 或再次載入大型資料。

## 3. Item label 資料來源

正式 label source 是 `wiki.html#EQUIP_DATA` 的既有 `id`／`name`：

- `wiki.html` 在 Feature Flag 啟用分支內呼叫 `MonsterWikiData.setItemLabelSource(EQUIP_DATA)`。
- Repository 只建立 `itemId → displayName` Map，不複製 Equipment record、不 fetch 額外檔案，也不把 label 寫入 Monster Dataset。
- `EQUIP_DATA` 目前有 1,019 筆可用 label；886 個唯一 Base Drop Item ID 中，673 個可直接對應，213 個維持未解析。
- 找不到 label 時顯示正式 Item ID 與「名稱資料尚未建立」，不從 ID 猜名稱。
- label source 設定失敗只清空 label index；Monster、Map、Drop repository 仍為 ready。

## 4. Repository API

保留 Alpha API：

- `load()`
- `getMonsterById()`
- `getMonsterByName()`
- `searchMonsters()`
- `getMap()`
- `getDropTable()`
- `getDrops()`
- `getState()`

新增：

- `setItemLabelSource(items)`
- `searchDrops(keyword)`
- `getMonstersDroppingItem(itemId)`
- `getItemDisplay(itemId)`
- `getMonsterDetail(monsterId)`

Repository 建立 Item → DropEntry／Monster 的反向索引。`getMonsterDetail()` 只組合 Monster、全部 Map 與 Base Drop read model，不修改 canonical records。所有對外 entity、relation 與陣列結果均回傳 deep snapshot；consumer 修改結果不會污染內部索引。

## 5. URL 規格

正式 deep link：

`wiki.html?monsterUI=1&tab=monster&monster=<monsterId>`

Monster URL state：

- `tab=monster`
- `monster=<canonical monsterId>`
- `monsterSearch=<keyword>`；空值時移除。
- `monsterMode=monster|drop`；未知值安全回到 `monster`。

規則：

- identity 只使用 Monster ID，不使用中文名稱。
- 使用 `URL`／`URLSearchParams` 並保留 `monsterUI=1` 等無關 query。
- 搜尋輸入使用 `replaceState`；開啟／關閉 Detail 與切換模式使用 `pushState`。
- URL 未改變時不新增 history entry。
- 不存在的 Monster ID 顯示「找不到此怪物資料」，保留搜尋入口且不選第一筆。
- Feature Flag 關閉時 `monster` query 不會觸發 JSON fetch，`tab=monster` 安全回到 Equipment。

## 6. History／popstate

- `popstate` 只綁定一次。
- history 還原時呼叫 `switchTab(..., {syncHistory:false})`，不再次 push／replace，避免循環。
- Back 可由 Monster B 回 Monster A，或由 Detail 回搜尋結果。
- Forward 可重新開啟 Detail。
- 重新整理會還原 tab、mode、keyword 與 Monster Detail。
- `switchTab` 新增可選的 `options.syncHistory`，既有一至二參數呼叫維持相容。

## 7. Drop reverse lookup

Monster UI 提供「怪物」與「掉落物」兩種模式。掉落物模式支援：

- 正式 Item ID substring、大／小寫不敏感搜尋。
- 已解析 `EQUIP_DATA.name` 搜尋。
- 同一 Item 的全部 Base Drop Monster，不選第一筆。
- Item 名稱、Item ID、怪物數量、怪物名稱、Boss 狀態、全部地圖摘要與基礎掉率。
- 點擊任一怪物會開啟 Monster Detail 並 push 正式 Monster ID 到 URL。

頁面固定提示：「目前顯示遊戲基礎掉落表，不包含尚未建模的特殊或條件掉落。」機率明示為「基礎掉率」，沒有套用或宣稱 runtime modifier 後的最終值。

## 8. Monster Detail

顯示順序調整為：

1. 名稱。
2. 等級與 Boss 狀態。
3. 全部出現地圖。
4. 全部 Base Drop。
5. HP。
6. 收合的技術資訊／Monster ID。

Map 有 label 時顯示 `displayName`；無 label 時顯示 `mapId` 與「名稱資料尚未建立」。Drop 顯示 Item label／ID、基礎掉率、數量及 partial／unresolved 狀態。沒有 Map 或 Drop 時顯示「資料尚未建立」，不輸出尚未建立的 CardRef／QuestRef 假欄位。

## 9. 互動與 fallback

- Monster pane 使用一次性事件委派處理 mode、結果、Detail close、input 與 keyboard。
- 搜尋有 180ms debounce；Enter 立即搜尋；Escape 關閉 Detail。
- `init()` 可重入，重複呼叫不重綁事件。
- 必要的 `monsters.json`、`maps.json`、`drop_tables.json` 任一 HTTP／parse／envelope／identity 失敗：repository index 清空、View 不初始化、Tab 維持隱藏並回退 Equipment，沒有未處理 Error。
- 可選 Item label source 失敗：UI 繼續使用、掉落仍完整顯示 Item ID，不將 repository 標為 failed。

## 10. 自動測試

`node tools/test_monster_ui_beta.js`：21／21 passed，涵蓋要求的 20 個案例及 repository snapshot isolation：

- Flag 關閉／開啟 fetch 邊界。
- deep link、無效 ID、搜尋 URL、Detail close。
- popstate、重新整理。
- Item ID／名稱反查與同 Item 多 Monster。
- Item label failure、必要 JSON 404／parse failure。
- 事件不重複綁定。
- 中文／大小寫搜尋、百分比單位、無 Map／Drop。
- Equipment／Craft／Cards 接線 baseline。

其他驗證：

- `node --check`：三份新增／修改 JS passed。
- Monster validator：Schema passed；460 Monster、214 Map、433 DropTable、3,655 DropEntry；deterministic hash unchanged。
- Monster tests：7／7 passed。
- Mapping validator：passed；Mapping tests 30／30 passed。
- Craft validator：passed；279 recipes、47 NPC、471 items。
- WikiDataCore tests：passed；consoleErrors 為空。
- `git diff --check`：沒有 whitespace error；僅既有未暫存文件與本次檔案的 LF→CRLF working-copy warnings。

## 11. Browser 驗收

正常模式實測：

- `?monsterUI=1&tab=monster&monster=orc` 可還原妖魔 Detail，搜尋欄合理同步為「妖魔」。
- 「妖魔」得到 12 筆結果，含 `orc`；`ORC` 得到 10 筆結果，含 `orc`。
- 物品名稱「歐西斯之矛」可反查 1 隻怪物；Item ID `scroll_armor` 保留 120 隻怪物，未解析名稱明確標記。
- 由掉落結果點擊妖魔後 URL 加入 `monster=orc`；Back 回搜尋結果，Forward 重開妖魔；reload 保留 drop mode、keyword 與 Detail。
- 關閉 Detail 後移除 `monster` query。
- 不存在 ID 顯示「找不到此怪物資料」，沒有自選第一隻。
- 390×844 viewport：頁面、Monster pane、搜尋欄與 Detail 均無水平溢出。
- Equipment、Craft、Cards 按鈕實際點擊後 active pane 正確；內容維持 786 Equipment cards、29 Craft NPC、17 Card regions。

故障 fixture 實測：

- 必要 `maps.json` 404：mode=`fallback`、Monster Tab 隱藏、Equipment pane active、Console Error 0；唯一 404 是預期 fixture request。
- Item label source failure：mode=`enabled`、Monster Tab 可見、妖魔 Detail 正常、7 筆掉落全以 Item ID 顯示並標記名稱未建立、Console Error 0。

Console／Network：

- 正常模式 Console Error：0。
- Browser inventory 觀察到 5 份 Wiki scripts 與 3 份 Monster JSON；逐一 HTTP 驗證均為 200，正常模式 Network 404：0。
- 故障模式只有刻意製造的 `maps.json` 404；沒有其他非預期 request failure。

## 12. Git diff 與未處理限制

本階段專案變更限於兩個新增檔案與三個允許修改檔案。工作區另有本階段開始前即存在的其他未提交文件、Dataset、Schema 與工具變更，均未修改或納入本功能。

尚未處理：

- 213 個唯一 Base Drop Item ID 尚無 `EQUIP_DATA` label，維持 unresolved。
- 不包含特殊、條件、卡片、區域、活動掉落與 runtime modifier 後機率。
- Map label 缺口仍依 Dataset 狀態呈現，不自行美化 mapId。
- 未建立跨 Domain 全站 Search、WikiDataCore Monster adapter 或其他 Entity UI。

## 13. 是否建議預設啟用

暫不建議。Beta 的分享、history、反查、fallback 與回歸測試已可供 opt-in 驗收，但仍有 213 個 Drop Item label unresolved，且 Feature Flag 尚未經一輪實際玩家使用驗收。建議先保留 `false`，收集 Beta 使用結果並確認 URL 與 Item label 覆蓋，再另案決定是否預設開啟。
