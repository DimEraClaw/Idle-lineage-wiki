# Equipment Stage E3-C Report

## 1. 階段結論

Equipment Stage E3-C 已建立唯讀 Equipment Repository、索引、Shadow Comparison 與自動化測試，並以預設關閉的方式最小接入 `wiki.html`。

本階段沒有切換 Equipment UI 的資料來源。玩家看到的裝備卡片、搜尋、篩選、排序與 Detail 仍全部使用既有 `wiki.html#EQUIP_DATA` 與既有 render functions。Shadow 模式只在背景讀取正式 Dataset、產生內部 diagnostics，沒有新增玩家可見文字或操作。

基準比較結果為：

- Equipment identity：786 / 786，無缺漏、無重複。
- blocking mismatch：0。
- expected mismatch：922。
- Identity、Classification、可驗證 Detail 欄位：通過。
- Search 與 Relation：存在已分類、非 blocking 的遷移差異，尚不可宣告完全 parity。

## 2. 本次新增與最小修改

新增：

- `js/wiki-equipment-data.js`
- `js/wiki-equipment-shadow-adapter.js`
- `tools/test_equipment_repository.js`
- `tools/test_equipment_shadow_comparison.js`
- `docs/EQUIPMENT_STAGE_E3C_REPORT.md`

最小修改：

- `wiki.html`
  - 新增兩個 script reference。
  - 宣告預設關閉的 Shadow flag。
  - 新增不等待、不阻塞既有 UI 的 Shadow initialization hook。
  - 新增 console-free 的 `data-equipment-shadow-*` 內部診斷屬性。

未修改 Equipment JSON、Schema、Generator、Validator、`EQUIP_DATA`、Equipment render functions、CSS、WikiDataCore 或其他 Domain 實作。

## 3. Feature Flag

宣告：

```text
window.EQUIPMENT_DATA_SHADOW_ENABLED = false
```

唯一啟用條件：

```text
wiki.html?equipmentShadow=1
```

行為：

- 未帶 `equipmentShadow=1`：不建立 Repository、不 fetch `data/equipment/*.json`、不執行 Shadow Comparison。
- 帶 `equipmentShadow=1`：在既有 `initEquipWiki()` 之後非阻塞地建立 Repository、載入 Dataset、建立索引並比較。
- 其他值、空值或沒有 query：一律視為 disabled。
- Shadow 結果只保存在內部狀態與 `documentElement.dataset` diagnostics，不顯示給玩家。

## 4. Dataset dependencies 與失敗政策

Repository 只允許讀取：

| Dataset | 角色 | 失敗政策 |
|---|---|---|
| `data/equipment/equipments.json` | Entity 與所有查詢索引的必要來源 | required；失敗時清空 Repository、`ready=false`、停止比較 |
| `data/equipment/diagnostics.json` | source conflict、unresolved 語意與 Shadow 分類依據 | required；失敗時清空 Repository、`ready=false`、停止比較 |
| `data/equipment/unresolved.json` | unresolved 專用查詢的便利投影 | optional；失敗時從 diagnostics 中 `status=unresolved` 的紀錄建立唯讀 fallback |

`unresolved.json` 可選的理由是它是 diagnostics 的可重建子集合；`diagnostics.json` 不可選，因為缺少它會使 5 筆 price conflict、624 筆 legacy relation unresolved 與其他語意差異失去正式分類依據。

Repository 不讀取 `wiki.html#EQUIP_DATA`、`js/00-data.js`、DB、Monster/Craft 原始檔、localStorage 或玩家存檔。

## 5. Repository API

公開 API：

- `load()`
- `getEquipmentById(equipmentId)`
- `getEquipmentByName(displayName)`
- `searchEquipment(keyword)`
- `getAll()`
- `getByGroup(group)`
- `getByType(equipmentType)`
- `getBySlot(slot)`
- `getByClass(classKey)`
- `getRelations(equipmentId)`
- `getDiagnostics(equipmentId)`
- `getUnresolved(equipmentId)`
- `getState()`

額外內部量測 API：

- `measureSearch(queries)`

保證：

- ID lookup 只使用 `equipmentId`。
- exact name 只作查詢；同名多筆時回傳 `null`，不選第一筆、不建立 identity。
- 中文名稱、中文分類標籤與 Equipment ID 都可搜尋，搜尋不參與 identity resolve。
- 回傳 Entity、Relation、Diagnostics、Unresolved 與 state 均為 deep copy，consumer 無法污染 Repository 內部狀態。
- duplicate Equipment ID、invalid envelope、required 404 或 JSON parse error 均 fail closed。
- load failure 以 `false` 回報，不產生 unhandled rejection。
- Repository 不操作 DOM。

## 6. Index counts

| Index | 數量 |
|---|---:|
| `equipmentById` | 786 |
| `equipmentByExactName` | 786 |
| `equipmentByGroup` | 3 |
| `equipmentByType` | 27 |
| `equipmentBySlot` | 16 |
| `equipmentByClass` | 8 |
| `relationByEquipment` | 741 |
| `diagnosticsByEquipment` | 786 |
| `unresolvedByEquipment` | 786 |
| `searchableText` | 786 |

索引只保存 Equipment ID、diagnostic key 或 relation reference key；完整 Entity 與 diagnostics 分別保存在內部 record store，沒有在每個索引重複整份 Entity。

分類數量：

- Weapon：309。
- Armor：339。
- Accessory：138。

## 7. Shadow Comparison 結果

### 7.1 Parity 摘要

| 領域 | 結果 | 說明 |
|---|---|---|
| Identity | passed | 786 個 Equipment ID 完整一致 |
| Classification | passed | group、type、slot 無 mismatch |
| Detail | passed | displayName、rarity 與已 resolved 的 22 baseStats 無 blocking mismatch |
| Search | expected difference | 10 個固定 query 中 8 個結果集合不同；Repository 額外支援 ID 與正規分類標籤 |
| Relation | unresolved | 正式 relation 已可查詢，但 624 件 Equipment 的 legacy HTML/name source 尚不能逐 target 驗證 |

搜尋固定 fixtures：

- 傳送控制戒指
- 傳送控制
- `acc_116`
- 武器
- 防具
- 戒指
- 盾牌
- 雙手劍
- 弓
- 魔杖

Search mismatch 不代表 Repository 錯誤。既有 UI 搜尋 display/editorial/source 文字；Repository 搜尋 canonical identity 與 classification labels。兩者欄位責任不同，已明確分類為 expected、non-blocking，沒有用名稱做關聯推測。

### 7.2 Mismatch 分類

| Category | 數量 | Blocking | 判定 |
|---|---:|---:|---|
| `identity_mismatch` | 0 | 0 | passed |
| `display_name_mismatch` | 0 | 0 | passed |
| `equipment_group_mismatch` | 0 | 0 | passed |
| `equipment_type_mismatch` | 0 | 0 | passed |
| `slot_mismatch` | 0 | 0 | passed |
| `search_result_mismatch` | 8 | 0 | expected |
| `price_expected_conflict` | 5 | 0 | expected；保留 E3-B source conflict |
| `description_missing_expected` | 277 | 0 | expected；legacy empty string 對 canonical null |
| `safe_semantic_mismatch` | 4 | 0 | expected；unresolved 不等於 legacy convenience zero |
| `class_requirement_semantic_mismatch` | 4 | 0 | expected；unresolved 不等於 legacy convenience `all` |
| `base_stat_mismatch` | 0 | 0 | passed |
| `relation_owner_mismatch` | 0 | 0 | passed within verifiable owner relations |
| `legacy_source_unresolved` | 624 | 0 | expected unresolved |
| `diagnostics_expected` | 0 | 0 | reserved taxonomy |
| `technical_only_difference` | 0 | 0 | none in baseline |
| `blocking_shadow_mismatch` | 0 | 0 | passed |
| **總計** | **922** | **0** | 無 blocking mismatch |

每筆 mismatch 均包含：`equipmentId`、`fieldPath`、`legacyValue`、`datasetValue`、`category`、`blocking`、`expected`、`reason`、`sourceLocation`、`notes`，並依固定 key 排序，因此 diagnostics output 可重現。

## 8. Relation parity

正式 Dataset relation 統計：

- Monster Drop：1,533。
- Craft Result：220。
- Craft Requirement：103。
- 有任一正式 relation 的 Equipment：741。

Legacy coverage：

- 有 legacy `【掉落】` claim 的 Equipment：588。
- 有未能正式解析之 legacy HTML/name sources 的 Equipment：624。

正式 relations 由 owner Dataset 的 EntityRef 建立，Repository 可直接回傳；legacy source 則包含 HTML 與名稱 target。E3-C 沒有用中文名稱反推 Monster/Craft identity，也沒有把 legacy source claim 自動升格為正式 relation。因此 Relation 領域保持 unresolved，而不是假稱完全 parity。

## 9. 效能基線

本機靜態伺服器、Codex in-app browser 的一次 Shadow cold load 樣本：

| 指標 | 結果 |
|---|---:|
| `equipments.json` response size | 11,067,281 bytes |
| `diagnostics.json` response size | 1,264,445 bytes |
| `unresolved.json` response size | 1,257,555 bytes |
| 三份 response 合計 | 13,589,281 bytes |
| fetch time | 約 2,563.5 ms |
| JSON parse time | 約 107.1 ms |
| index build time | 約 81.6 ms |
| total ready time | 約 2,738.1 ms |
| memory estimate | 約 13,844,975 bytes |
| 10 次固定搜尋平均 | 約 5.9 ms |

此數值是本機單次量測，不是跨裝置效能承諾。主要成本是傳輸三份大型文件；因 Shadow initialization 不被 `await`，不會阻塞既有 Equipment UI 的首次 render。正式 UI 切換前仍必須處理 payload 與 diagnostics 載入策略。

## 10. Fallback

實際注入並驗收：

- `equipments.json` HTTP 404。
- `diagnostics.json` HTTP 404。
- `diagnostics.json` JSON parse error。

三種情況均符合：

- `data-equipment-shadow-mode=fallback`。
- `data-equipment-shadow-ready=false`。
- Repository required load fail closed，索引不暴露半成品。
- Shadow Comparison 不執行。
- 既有 786 張 Equipment cards 正常顯示。
- Craft 使用 legacy fallback、Monster UI 正常 enabled、Cards 與首頁不受影響。
- Console Error：0。

`unresolved.json` optional failure另由 Repository 自動化測試驗證：Repository 仍 ready，並從 diagnostics 建立 unresolved fallback。

## 11. 自動化與瀏覽器驗收

### 11.1 新增測試

- Repository tests：25 / 25 passed。
- Shadow Comparison tests：32 / 32 passed。
- 合計：57 / 57 passed，超過本階段要求的 40 個案例。

覆蓋 load、三檔 fetch、786 count、所有 lookup/index API、中文與 ID search、deep-copy isolation、duplicate ID、duplicate name ambiguity、invalid envelope、404、parse error、optional unresolved fallback、repeated init、identity/classification/detail/relation/search parity、固定 mismatch 分類、deterministic sorting、`EQUIP_DATA` 不變與 synthetic blocking regressions。

### 11.2 既有回歸

- Equipment Dataset validator：passed；Schema passed；byte stable。
- Equipment Dataset tests：30 / 30 passed。
- Equipment fixture validator：passed。
- Equipment fixture tests：25 / 25 passed。
- Monster validator：passed。
- Monster tests：7 / 7 passed。
- Legacy mapping validator：passed；blocking count 0。
- Legacy mapping tests：30 / 30 passed。
- Craft validator：passed。
- WikiDataCore tests：passed。
- Monster UI RC tests：15 / 15 passed。
- Existing Monster UI Beta tests：21 / 21 passed。
- `node --check`：新增 JS 與 tests 全部 passed。
- `git diff --check`：passed。

### 11.3 Browser acceptance

正常模式：

- Shadow disabled、ready=false。
- 未建立 Equipment Repository。
- Equipment cards：786。
- Equipment、Monster、Craft、Cards baseline 正常。
- Console Error：0。

Shadow 模式：

- Repository ready。
- Shadow enabled、ready=true。
- Dataset records：786。
- blocking mismatch：0。
- 既有 Equipment cards：786，仍由 legacy data render。
- 搜尋「傳送控制戒指」得到 1 筆，Detail 可正常開啟。
- Console Error：0。

390px：

- Shadow ready。
- Equipment cards 正常。
- `scrollWidth=390`、`clientWidth=390`，無水平溢位。
- Console Error：0。

## 12. Git diff 與工作區界線

本階段只新增四個允許的程式／測試檔、一份報告，並最小修改 `wiki.html`。沒有 commit、push、rebase 或 amend。

工作區原本即存在其他已修改或未追蹤檔案；本階段未修改、未 stage、未清理那些變更。提交時必須只挑選本報告第 2 節列出的 E3-C 檔案，並另行檢查 `wiki.html` 中是否混有先前未提交內容。

## 13. E3-D 建議

建議有條件進入 E3-D，但只應先建立 feature-flagged Equipment View Adapter，不應直接把正式 UI 預設切換至 Dataset。

E3-D 前必須保留或處理：

1. 13.59 MB 三檔合計與約 2.74 秒 cold-ready 基線：玩家 UI 不應同步等待完整 diagnostics／unresolved payload。
2. Search 欄位責任：需明確決定 Dataset UI 是否保留 legacy editorial/source 搜尋，不能把目前 8 個 expected mismatch 當成錯誤或悄悄改變玩家行為。
3. 624 件 legacy source unresolved：不得以中文名稱自動關聯；正式 EntityRef 與 legacy claim 必須分層顯示。
4. 5 筆 price conflict、4 筆 safe unresolved、4 筆 req unresolved：View Adapter 必須依 diagnostics 顯示未知／待確認，不可套用 legacy convenience default。
5. E3-D 仍需保留 legacy fallback、預設關閉、Console/Network baseline 與逐功能 browser acceptance。

在上述限制下，E3-C 的 0 blocking mismatch 足以支持下一個最小步驟；不足以支持立即移除 `EQUIP_DATA` 或直接正式切換 Equipment UI。
