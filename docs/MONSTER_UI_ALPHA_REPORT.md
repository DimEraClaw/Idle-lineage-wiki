# Monster UI Alpha Report

## 1. 範圍

Monster UI Alpha 提供第一個可使用的 Monster 百科查詢頁。實作只新增獨立 Monster Repository／View scripts，並在 `wiki.html` 加入受 Feature Flag 控制的 script references、Monster Tab container 與初始化接線。

本階段沒有新增 Contract、Schema、Generator 或 Validator，也沒有修改 Craft、Equipment、Cards、首頁、WikiDataCore、Release、Interaction、Knowledge 或任何 Monster Dataset。

## 2. 檔案

新增：

- `js/wiki-monster-data.js`
- `js/wiki-monster-view.js`
- `docs/MONSTER_UI_ALPHA_REPORT.md`

最小修改：

- `wiki.html`

`wiki.html` 的改動限於：隱藏的 Monster Tab button、Monster pane container、兩個 script references、`MONSTER_UI_ALPHA=false`、query flag 判定，以及 DOMContentLoaded／tab search 的初始化接線。

## 3. Monster Repository

`window.MonsterWikiData` 不操作 DOM，只 fetch：

- `data/monster/monsters.json`
- `data/monster/maps.json`
- `data/monster/drop_tables.json`

API：

- `load()`
- `getMonsterById(monsterId)`
- `getMonsterByName(displayName)`
- `searchMonsters(keyword)`
- `getMap(mapId)`
- `getDropTable(dropTableId)`
- `getDrops(monsterId)`
- `getState()`

實際載入索引：460 Monster、214 Map、433 DropTable。Repository 沒有 fetch Item、Craft、Equipment、Cards 或其他來源。

## 4. 搜尋與 Detail

搜尋支援：

- Monster displayName substring。
- Monster ID substring。
- `toLocaleLowerCase()` 大小寫不敏感比對。
- 中文完整或部分字串比對。
- `getMonsterByName` 中文正式名稱精確查詢。

Detail 第一版顯示：

- 名稱。
- Monster ID。
- 等級。
- HP。
- Boss 是／否。
- 全部 MapRef 對應地圖，不選第一筆。
- 可展開的 Base DropEntry 列表。

Drop Dataset 沒有 Item displayName，Alpha 只顯示已驗證 `itemRef.entityId`，不讀取其他 Dataset 補名。Map label、Map relation 或 DropTable 缺失時顯示「資料尚未建立」。

## 5. Feature Flag

- 全域 flag：`window.MONSTER_UI_ALPHA = false`。
- Query opt-in：`monsterUI=1`。
- 預設狀態下 Tab button 保持 hidden，不載入 Monster JSON，也不初始化 View。
- 只有 flag 啟用且三份 Dataset 全部載入成功後，才顯示 Monster Tab。
- `tab=monster` 在 flag 關閉或載入失敗時安全回到 Equipment pane。

## 6. Fallback

三份 JSON 以 `Promise.all` 作為同一必要載入單元。任一 request、HTTP status、JSON parse、document envelope 或 index uniqueness 失敗時：

- `load()` 回傳 false。
- Repository `ready=false`。
- 所有暫存 index 清空。
- Monster Tab 維持 hidden。
- Monster View 不註冊 input interaction、不切換 pane。
- 只寫入不含資料細節的 `console.warn`，不拋出未處理錯誤。
- Equipment、Craft、Cards 與首頁初始化流程繼續執行。

故障 fixture 驗證結果：ready=false、Monster count=0、search result=0，且 failure 被本地處理。

## 7. 驗證結果

### Static／Repository

- 兩份 JavaScript `node --check` passed。
- `git diff --check` passed。
- Repository 僅提出 3 個允許 request。
- `getMonsterById('orc')` → 妖魔。
- `getMonsterByName('妖魔')` → `orc`。
- `searchMonsters('ORC')` 可命中 `orc`。
- 妖魔：11 Map、7 DropEntry。
- 六個要求的 Repository API 全部存在。

### Browser

- 預設 URL：mode=disabled、ready=false、Monster Tab 不可見、Equipment pane 正常。
- `monsterUI=1&tab=monster`：mode=enabled，460／214／433 index counts 正確。
- 中文搜尋「妖魔」顯示 12 個實際名稱命中，可點擊精確「妖魔（orc）」。
- 大小寫搜尋 `ORC` 可命中 `orc`。
- 妖魔 Detail 顯示名稱、level 2、HP 6、Boss 否、11 張地圖與 7 筆掉落。
- `aton_enemy` 的 Map／Drop 均顯示「資料尚未建立」。
- Drop details 可實際點擊展開。
- Monster UI 的必要 HTML、scripts 與 JSON HTTP status 全為 200。

### Existing baseline

- Equipment：實際點擊，active pane 正確，786 個項目正常渲染。
- Craft：實際點擊，legacy mode 維持，29 個 NPC navigation items 正常。
- Cards：實際點擊，17 個 region navigation items 與首頁內容正常。
- Browser Console Error：0。
- 沒有更改既有 Craft、Equipment 或 Cards render／data functions。

## 8. 下一步

Alpha 已可供受控試用。建議下一步先做小型 Beta 改善，而不是擴張 Domain：

1. 由正式 Item Domain／Repository 提供 Drop Item label；未就緒前維持 Item ID。
2. 加入明確 Monster deep link（`monster=<id>`）與 back／forward 測試。
3. 增加 Boss／Map filter，但不改搜尋 identity。
4. 補獨立自動化 View tests 與 JSON failure browser fixture。
5. 完成一輪使用驗收後，再評估是否把 flag 預設開啟。
