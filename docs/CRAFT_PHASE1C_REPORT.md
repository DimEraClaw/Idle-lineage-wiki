# 製作與配方百科 Phase 1C 報告

## 1. 執行範圍

本階段建立製作百科資料載入、runtime 驗證、索引與查詢層，並以預設關閉的 feature flag 最小接入 `wiki.html`。

執行日期：2026-07-12

未使用新資料重畫 UI；現有 NPC 清單、配方卡片、搜尋、drawer、配方樹與舊 `CRAFT_DATA` 全部保留。

## 2. 修改檔案

- 新增 `js/wiki-craft-data.js`
- 最小修改 `wiki.html`
- 新增 `docs/CRAFT_PHASE1C_REPORT.md`

沒有修改 CSS、`index.html`、`afk-*.js`、現有遊戲模組、`data/craft/*.json`、生成器、Schema 或驗證器。

## 3. 新資料層 API

資料層集中於唯一命名空間 `window.CraftWikiData`：

- `load()`
- `validateLoadedData()`
- `buildIndexes()`
- `getState()`
- `isReady()`
- `getLoadError()`
- `getRecipeById(recipeId)`
- `getRecipesByNpcId(npcId)`
- `getRecipesByResultId(itemId)`
- `getRecipesByRequirementId(itemId)`
- `getItemById(itemId)`
- `getNpcById(npcId)`
- `getSourceByItemId(itemId)`
- `searchRecipes(keyword)`
- `calculateRecipeRequirements(recipeId, targetQuantity)`
- `resetForTests()`

`load()` 使用單例 Promise；同一頁多次呼叫會共用同一 Promise，不重複 fetch 或建索引。`resetForTests()` 可清除資料、索引、錯誤及狀態。

## 4. Feature flag 行為

```js
window.CRAFT_WIKI_PHASE1_ENABLED = false;
```

- 預設值固定為 false。
- false 時直接且只執行一次舊 `initCraftWiki()`，`CraftWikiData` 維持 idle，不請求 JSON。
- `craftPhase1=1` 才啟用測試預載。
- `craftPhase1=0`、無參數或其他無效值維持 false。
- 重新整理會由 URL 再次還原測試狀態。
- 沒有讀寫 localStorage。
- true 模式只載入、驗證及建立索引，畫面仍由舊 `initCraftWiki()` 渲染。
- 必要資料失敗時只初始化一次舊 UI，並顯示一次非阻擋 fallback 提示。

`<html>` 上的 `data-craft-phase1-*` 僅記錄測試狀態、ready、可選錯誤數與索引數量，不建立視覺 UI。

## 5. JSON 載入結果

使用 `Promise.allSettled` 載入相對路徑：

- `./data/craft/recipes.json`（必要）
- `./data/craft/items.json`（必要）
- `./data/craft/npcs.json`（必要）
- `./data/craft/drops.json`（可選）
- `./data/craft/unresolved.json`（可選）

一般 true 模式下五份 JSON 均回應 HTTP 200。Fetch 會檢查 `response.ok`，load 與 parse error 都包含檔名。

## 6. Runtime 驗證結果

驗證通過：

- recipes、items、npcs、drops、unresolved 皆為陣列。
- Recipe、Item、NPC 與 SourceRecord item ID 唯一。
- 所有 result、requirement、NPC 外鍵都能解析到完整資料或 stub。
- unresolved Item/Npc stub 狀態合法。
- requirements 不含 gold，也沒有重複 itemId。
- result/requirement quantity 為正整數。
- currencyCost currency 為 gold，amount 為非負有限數值。
- `recipesByResultId` 的值一律為陣列。
- Runtime duplicate recipe 測試會拒絕資料並回報重複 ID，不會部分啟用。

## 7. 索引數量

| 索引 | key 數量 |
| --- | ---: |
| `recipesById` | 279 |
| `recipesByNpcId` | 47 |
| `recipesByResultId` | 272 |
| `recipesByRequirementId` | 278 |
| `itemsById` | 471 |
| `npcsById` | 47 |
| `sourcesByItemId` | 471 |

`npc_mystic_mage` 保留空 Recipe[]。跨 NPC 同成品 `hlm_silver` 查詢保留兩份 Recipe，沒有首筆覆蓋。

## 8. 搜尋測試

- 空白 keyword 經 trim 後回傳全部 279 筆配方。
- 搜尋 NPC ID `npc_sebas` 回傳 8 筆。
- 搜尋不依賴 DOM 或 `NPC_ORDER`。
- 實作涵蓋成品 name/ID、description、requirement name/ID、NPC name/ID。
- 中文名稱只參與搜尋，不建立關聯。

舊 UI 搜尋亦實際測試：搜尋「紅色斗篷」後顯示 2 張符合的既有卡片，清除後可正常切換 NPC。

## 9. Yield 與成本測試

四筆非 1 yield 均以 `targetQuantity = yield + 1` 測試向上取整：

| Recipe | craftCount | actualOutput | 結果 |
| --- | ---: | ---: | --- |
| `recipe_npc_narupa_wpn_30_01` | 2 | 20 | 通過 |
| `recipe_npc_narupa_wpn_5_01` | 2 | 200 | 通過 |
| `recipe_npc_elf_new_item_169_01` | 2 | 40 | 通過 |
| `recipe_npc_elf_new_item_170_01` | 2 | 40 | 通過 |

API 驗證 targetQuantity 為正整數，計算 craftCount、實際產出、剩餘量、leaf materials、總 gold 與遞迴 steps，並以 recipe ID path 提供 cycle guard。

## 10. 多配方 ambiguity 行為

以 `recipe_npc_joel_shd_bone_01` 展開 `arm_112` 時，資料層發現兩份候選配方並回傳：

```text
status: ambiguous
itemId: arm_112
recipe_npc_falin_arm_112_01
recipe_npc_finn_arm_112_01
```

API 不會擅自選第一份配方。

## 11. Fallback 測試

### recipes.json 404

- 回報 `CraftWikiData: recipes.json load failed: HTTP 404`。
- ready=false，七種索引維持空白。
- 自動回退舊 UI；29 個既有可見 NPC、7 張預設配方卡正常。
- fallback 提示恰好顯示一次。
- 裝備與卡片頁籤仍存在且可操作。

### items.json parse error

- 回報 `CraftWikiData: items.json parse failed: ...`。
- ready=false，沒有部分索引。
- 自動回退舊 UI，頁面未白屏。
- fallback 提示恰好顯示一次。

### 可選 drops.json 404

- 回報 `CraftWikiData: drops.json load failed: HTTP 404`。
- ready=true，不觸發 fallback。
- optionalErrors=1。
- recipes/items/npcs 索引正常；`sourcesByItemId=0`，維持 unresolved/unknown 語意。
- 舊畫面不受影響。

## 12. 初始化與事件

- false 模式不呼叫 `CraftWikiData.load()`。
- true 模式多次初始化共用單例 Promise。
- 舊 `initCraftWiki()` 由 once guard 保證只執行一次。
- fallback notice 由 once guard 保證只顯示一次。
- 多次頁籤切換不會重新呼叫初始化入口。
- 沒有新增 inline onclick 或任何事件監聽器；既有 inline handler 未改動。

## 13. Console 與 Network

### 正常 false／true 模式

- Console 未處理錯誤：0。
- `wiki.html`、新資料層 script 與五份 JSON HTTP 狀態：全部 200。
- Network 404：0。

### 故障模擬

- Console 只出現預期且含檔名的可辨識 load/parse 訊息。
- recipes 404 與 drops 404 是測試伺服器刻意回應。
- items parse 測試回應 HTTP 200 但內容刻意為無效 JSON。

## 14. Baseline 回歸結果

以本機 HTTP 伺服器重跑 `BASELINE_TEST_REPORT.md` 主要項目：

- 初始裝備數量「共篩選出 786 件裝備」：通過。
- 裝備搜尋「武器」顯示 328 件：通過。
- 魔法娃娃分類顯示 0 個：通過。
- 名稱 A–Z 排序更新列表：通過，首筆為「七彩鸚鵡喙」。
- 裝備卡片詳情開啟／關閉：通過。
- 製作 NPC 切換至「赫特」：通過。
- 製作搜尋：通過。
- 掉落 drawer 開啟並顯示來源：通過。
- 配方樹展開並顯示金幣總計：通過。
- 裝備、製作、卡片頁籤切換：通過。
- `tab` URL 狀態及重新整理：通過。
- `craftPhase1=0`／無效值保持 legacy：通過。
- `craftPhase1=1` 與重新整理保持測試 ready：通過。
- Console 未處理錯誤：0。
- 正常流程 Network 404：0。

## 15. UI 與舊資料確認

- 沒有修改 CSS 或視覺版型。
- 沒有用新資料重畫配方卡片、NPC 清單、搜尋、drawer 或配方樹。
- false 與 true data-only 模式皆顯示相同舊畫面：29 個可見 NPC、預設 7 張卡片。
- 沒有刪除或修改舊 `CRAFT_DATA`。
- 新資料層沒有正式上線，feature flag 預設仍為 false。

## 16. Phase 1D 判斷

可以進入 Phase 1D 的受控 view adapter／影子比對規劃。下一階段仍應維持 feature flag 預設 false、保留舊資料 fallback，先比較新舊查詢與渲染輸入一致性，再考慮讓新資料驅動畫面。
