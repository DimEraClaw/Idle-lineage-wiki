# WikiDataCore Phase 1D 實作報告

## 階段範圍與完成狀態

Phase 1D Stage 1 已完成。此次只建立統一資料核心的最小骨架、Craft compatibility adapter、測試工具與受 feature flag 控制的最小接線。未搬移 loader、未切換 UI 資料來源，也未修改 Craft JSON、Schema、CSS 或既有 `CraftWikiData` API。

新增檔案：

- `js/wiki-data-core.js`
- `js/wiki-data-core-craft-adapter.js`
- `tools/test_wiki_data_core.js`
- `docs/WIKI_DATA_CORE_PHASE1D_REPORT.md`

最小修改：

- `wiki.html`：依序載入 core 與 adapter、加入預設關閉的 flag、在既有 Craft 初始化完成後執行受控註冊。

## WikiDataCore facade

唯一新增的全域入口為 `window.WikiDataCore`，提供：

- `registerDataset(definition)`
- `hasDataset(name)`
- `getDataset(name)`
- `getDatasetStatus(name)`
- `getRepository(name)`
- `listRepositories()`
- `registerCraftAdapter(source)`
- `diagnostics`
- `resetForTests(datasetName?)`

內部以 IIFE、plain object 與 `Map` 實作。共用 read-only repository factory 及 adapter registry 收納於 facade 內，不另外建立全域 helper。

## Dataset registry

Dataset definition 支援 `name`、`version`、`status`、`repositories`、`diagnostics`、`adapterType`。狀態可表達 `idle`、`registering`、`ready`、`fallback`、`error`；未註冊的查詢回傳 `idle`。

同名 Dataset 不覆寫既有註冊，會產生 `duplicate_dataset` diagnostic。repository 名稱衝突會產生 `index_collision`，不會靜默取代既有 repository。

## Repository contract

共用最小 contract：

- `getById(id)`
- `getAll()`
- `has(id)`
- `search(keyword)`
- `getStatus()`
- `getValidationErrors()`

`getById()` 對未知 ID 回傳 `null`；索引查詢對未知 ID 回傳空陣列。`getAll()` 每次回傳新陣列，entity snapshot 深度凍結，外部修改不會污染 repository。repository 不依賴 DOM、history 或 fetch。

Craft Dataset 只註冊 `recipes`、`items`、`npcs`、`drops`。其中 recipes 另提供 `getByNpcId`、`getByResultId`、`getByRequirementId`；drops 另提供 `getByItemId`。

## Diagnostics API

diagnostic 結構包含 `code`、`severity`、`dataset`、`entityType`、`entityId`、`message`、`sourceLocation`、`blocking`。API 提供 `add`、`getAll`、`getByDataset`、`getByCode`、`clear`、`count`。

已覆蓋 `duplicate_dataset`、`adapter_not_ready`、`repository_registration_error`、`api_parity_error`、`index_collision`、`unsupported_repository`。diagnostic 保留在核心內，不直接渲染 UI；非阻擋 unresolved 不會自動把 Dataset 設為 error。

## Craft compatibility adapter

adapter 只在 `CraftWikiData.isReady() === true` 時建立一次 read-only snapshot。資料只透過既有公開查詢 API取得：recipes 由 `searchRecipes('')` 取得，再由既有 ID 查詢組成 items、npcs 與 drops。

adapter 不 fetch、不讀 JSON、不依賴 DOM、不修改來源資料，也不變更 `CraftWikiData` 方法。若來源尚未 ready，Dataset 保持未註冊並記錄非阻擋的 `adapter_not_ready`。`resetForTests('craft')` 只清除 core Dataset、repositories、diagnostics 與 adapter snapshot，不重設 `CraftWikiData`。

## Feature flag 行為

預設值為：

```js
window.WIKI_DATA_CORE_ENABLED = false;
```

- 預設或非精確參數：不註冊 craft Dataset，不觸發額外 fetch，原 UI 照常運作。
- `wikiDataCore=1`：嘗試註冊 adapter。
- `wikiDataCore=1` 且未啟用 `craftPhase1=1`：不呼叫 `CraftWikiData.load()`，Dataset 維持 idle/not-ready，記錄 `adapter_not_ready`。
- `wikiDataCore=1&craftPhase1=1`：沿用 `CraftWikiData` 已完成的單次載入並註冊 ready Dataset；UI 仍使用既有資料流。
- 不使用 localStorage，也不改變既有 URL 行為。

## Parity 與特殊案例測試

`node tools/test_wiki_data_core.js` 通過，驗證結果：

| 項目 | 結果 |
|---|---:|
| recipes | 279 |
| NPC | 47 |
| items | 471 |
| result keys | 272 |
| requirement keys | 278 |
| source keys | 471 |

下列查詢與既有 API 結果一致：`getRecipeById`、依 NPC／result／requirement 查 recipes、item、NPC、drop source 及 `searchRecipes`。

特殊案例均通過：`hlm_silver` 保留兩筆 Recipe、`npc_mystic_mage` 回傳空 Recipe 陣列且保留 stub、四筆非 1 yield 計算在 adapter 接線前後一致、ambiguous 結果不變、unresolved stub 狀態保留、未知 ID 語意一致、snapshot 不可由外部污染、重複註冊產生 diagnostic、reset 不影響來源。

## Fetch、來源與 UI 影響

- `CraftWikiData.load()` 仍是唯一 JSON loader，共請求既有五個 JSON；adapter 額外 fetch 數為 0。
- `js/wiki-craft-data.js` 未修改，測試前後 API function identity 與來源 payload 均一致。
- Craft JSON、Schema、CSS、`index.html`、`afk-*.js` 均未修改。
- UI DOM 與樣式未修改；只增加 script、flag、註冊函式與測試用狀態屬性。

## 瀏覽器、Console、Network 與 baseline

實際瀏覽器驗證三種模式：預設關閉、core-only、core + Craft Phase 1。三者原 Craft UI 均保留 29 個既有 sidebar NPC；ready 模式成功列出 `drops,items,npcs,recipes`，core-only 模式產生 1 筆 `adapter_not_ready`。

已實際點擊／操作：Craft 搜尋、NPC 篩選、配方樹展開、掉落來源抽屜、百科分頁、裝備搜尋、裝備詳情開啟與關閉。基準結果維持：初始裝備 786 件，搜尋「武器」328 件；赫特 8 筆配方與 8 個配方樹入口。Console Error 為 0；wiki、三支資料腳本與五個 Craft JSON 的 HTTP 狀態皆為 200，無 404。

## 剩餘限制與 Stage 2 建議

目前 core 是 compatibility snapshot，不是 loader 或 UI 的正式資料來源；adapter 的資料完整度受 `CraftWikiData` 公開查詢能力限制。Stage 2 前仍應維持：core 不自行 fetch、不可一次搬移 loader、不可直接改 UI 資料流、不得用名稱建立關聯。

建議可以進入下一階段，但應採小步驟、單一 consumer、feature flag 與完整 parity／fallback 驗證；在明確核准前，不應讓 UI 改讀 WikiDataCore，也不應移除 `CraftWikiData`。
