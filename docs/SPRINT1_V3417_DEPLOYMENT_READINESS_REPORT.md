# Sprint 1：v3.4.17 正式同步驗收報告

## 結論

**目前不可部署（Not Ready for Deployment）。**

Monster、Equipment、Mapping、Dataset、View Payload 與全部自動回歸測試均已完成並通過；但實際瀏覽器驗收發現 `wiki.html` 的 Equipment Dataset 初始化仍以 `786` 作為成功筆數基線。新版 Repository 已正確載入 `825` 筆，因此被錯誤切回 legacy，造成頁面顯示 0 筆且 39 件新增裝備無法搜尋或開啟 Deep Link。

本 Sprint 的允許修改範圍不包含 `wiki.html`，因此沒有越權修改該檔。部署前必須另行授權將初始化基線由 786 更新為 825，並重新執行本報告的 Browser 驗收。

## 1. 同步來源

| 項目 | 驗證值 |
| --- | --- |
| GameVersion | `v3.4.17` |
| Source SHA | `c3d4f96f13aefabf1453a4a3f1f54d688fd573f6` |
| 來源快照 | `temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot` |
| 產物穩定性 | Generator output 與 checked-in candidate byte-identical |

## 2. 修改檔案

本 Sprint 的變更分為以下責任範圍：

- Monster：`tools/generate_monster_data.py`、`tools/validate_monster_data.py`、`tools/test_monster_data.py`、`schemas/drop-table.schema.json`、`data/monster/monsters.json`、`data/monster/maps.json`、`data/monster/drop_tables.json`、`data/monster/unresolved.json`。
- Monster Repository 相容性：`js/wiki-monster-data.js`。新版存在兩個同名「地獄奴隸」；此最小調整讓名稱索引保留多筆結果，精確名稱查詢遇到歧義時回傳 `null`，避免整個 469 筆 Dataset 載入失敗。未改 UI 或新增功能。
- Legacy Mapping：`tools/generate_legacy_entity_mappings.py`、`tools/validate_legacy_entity_mappings.py`、`tools/test_legacy_entity_mappings.py`、`data/mappings/legacy-entity-mappings.json`、`data/mappings/unresolved-legacy-mappings.json`。
- Equipment fixtures：`fixtures/equipment/equipment-allowlist.json`、`fixtures/equipment/equipment-classification-mapping.json`、`fixtures/equipment/equipment-source-fixture.json`、`tools/validate_equipment_fixtures.py`、`tools/test_equipment_fixtures.py`、`schemas/equipment-classification-mapping.schema.json`。
- Equipment Dataset：`tools/generate_equipment_data.py`、`tools/validate_equipment_data.py`、`tools/test_equipment_data.py`、`schemas/equipment.schema.json`、`data/equipment/equipments.json`、`data/equipment/diagnostics.json`、`data/equipment/unresolved.json`。
- Equipment View Payload 與既有測試基線：`tools/validate_equipment_view_payload.py`、`tools/test_equipment_view_payload.py`、`schemas/equipment-view-index.schema.json`、`data/equipment/equipment-index.json`、`data/equipment/equipment-details-0.json` 至 `data/equipment/equipment-details-f.json`、`tools/test_equipment_repository.js`、`tools/test_equipment_shadow_comparison.js`、`tools/test_equipment_view_adapter.js`、`tools/test_equipment_ui_rc.js`。
- 本報告：`docs/SPRINT1_V3417_DEPLOYMENT_READINESS_REPORT.md`。

沒有修改 `wiki.html`、CSS、現有 UI 功能、Craft Dataset、Release Hub、Skill、Quest 或 WikiDataCore。

工作區另有 Sprint 開始前已存在的 Semantic Diff／Source Inventory 文件、fixtures、schemas 與工具變更；本 Sprint 沒有修改或清理它們。`tools/test_equipment_ui_rc.js` 與 `tools/test_equipment_view_adapter.js` 原本已有 U2-B1 基線調整，本 Sprint 僅在其上更新 v3.4.17 的 Equipment 預期值。

## 3. Monster 更新

| 項目 | 舊版 | v3.4.17 | 差異 |
| --- | ---: | ---: | ---: |
| Monster | 460 | 469 | +9 |
| Boss | 70 | 72 | +2 |
| Map | 214 | 217 | +3 |
| DropTable | 433 | 441 | +8 |
| DropEntry | 3,655 | 3,812 | +157 |

新增 Monster：`sanct_hellslave`、`sanct_cursed_fighter`、`sanct_cursed_mage`、`sanct_cursed_knight`、`sanct_scavenger`、`sanct_tethys`、`sanct_wyvern`、`sanct_giltas`、`sanct_dantes`。

Browser 實測上述 9 個 ID 均可由 Monster 搜尋框找到。`sanct_giltas` Deep Link 可顯示名稱、等級 99、HP 440000、Boss、地圖與 78 筆基礎掉落；搜尋結果開啟與 URL 狀態同步正常。

## 4. Equipment 更新

| 項目 | 舊版 | v3.4.17 | 差異 |
| --- | ---: | ---: | ---: |
| Equipment identity | 786 | 825 | +39 |
| Weapon | — | 324 | — |
| Armor | — | 354 | — |
| Accessory | — | 147 | — |
| 已解析分類 | — | 824 | — |
| 未解析分類 | — | 1 | — |
| Monster Drop relations | — | 1,607 | — |
| Craft result relations | — | 220 | — |
| Craft requirement relations | — | 103 | — |

Allowlist 已更新為 825；classification mapping 為 824 resolved + 1 unresolved。正式 Dataset、diagnostics、unresolved、825 筆搜尋索引與 16 個 Detail shards 均已重建。索引大小 915,956 bytes，低於 1 MiB；所有產物 deterministic 且 byte-stable。

Repository、View Adapter、Shadow Comparison 與 UI RC 的隔離測試均確認 39 個新增 identity 存在、分類計數正確、Detail shard 可載入、Monster relation 使用正式 Monster ID、Deep Link 與 legacy fallback 邏輯有效。

實際頁面未通過：索引已載入 825 筆，但 `wiki.html` 的 `initEquipmentDataViewIfEnabled()` 仍要求 `count === 786`，導致 `equipmentDataMode=fallback`、`equipmentDataReady=false`，搜尋 `wpn_giltas_sword` 為 0 筆，Deep Link 顯示找不到 Equipment ID。

## 5. Mapping 更新

- 8 個新增且名稱唯一的 Monster owner mapping 已解析。
- 3 個新增 Map ID 已納入資料來源與 Map Dataset。
- Legacy Mapping validator：`blockingCount = 0`。
- resolved mappings：3,099；unresolved/conflict records：572。
- 「地獄奴隸」保留為 `conflict`，候選為 `de_train_hellslave` 與 `sanct_hellslave`；沒有自動選擇 target。
- 同名 DropTable owner 保留 `owner: null`、`ownerType: unknown` 與來源證據，沒有把掉落猜配給任一 Monster。

## 6. Unresolved 與人工確認

### 必須保留的 unresolved

- `wpn_giltas_wand`：可確認為 Equipment identity 與 weapon group，但缺少可驗證的 weapon subtype／`isWand`／既有 ID tag；`equipmentType` 保持 `null`，不得用中文名稱猜測。
- 「地獄奴隸」：兩個正式 Monster ID 共用顯示名稱；Legacy name、Card compatibility、Craft、Wiki Monster 與 Drop owner 關聯均保留 conflict。
- 既有未解析資料仍留在正式 diagnostics/unresolved，不因本次同步自動補造 ID、分類或關聯。

### 部署阻擋

1. `wiki.html` 的 Equipment Dataset 成功筆數基線仍為 786，必須更新為 825。
2. 更新後必須重跑 Equipment Search、Detail、Monster Relation、分類、Deep Link、Reload／Back／Forward、Console 與 Network 驗收。

## 7. 自動測試結果

| 範圍 | 結果 |
| --- | --- |
| Monster schema／validator／deterministic | passed；469 / 217 / 441 / 3,812 |
| Monster pipeline | 7/7 passed |
| Monster UI Beta | 21/21 passed |
| Monster UI RC | 15/15 passed |
| Equipment fixtures | validator passed；25/25 passed |
| Equipment Dataset | validator passed；30/30 passed |
| Equipment View Payload | validator passed；30/30 passed |
| Legacy Mapping | validator passed；30/30 passed |
| Equipment Repository | 25/25 passed |
| Equipment Shadow | 32/32 passed |
| Equipment View Adapter | 71/71 passed |
| Equipment UI RC | 72/72 passed |
| Craft validator | passed |
| WikiDataCore | passed；Console errors 0 |
| Semantic Diff | 45/45 passed |
| Source Inventory | 18/18 passed |
| Source Manifest | 22/22 passed |
| `git diff --check` | passed；僅 Git 的 LF→CRLF 工作樹提示，無 whitespace error |

Shadow Comparison 的 42 個 blocking-category differences 均為已稽核的 39 個新版 identity 與 3 個新增 `resNone` canonical stat 差異；`blocking_shadow_mismatch = 0`。這些不是未知回歸，但 legacy 與新版 Dataset 本來就不再具有完整 identity parity。

## 8. Browser 驗收

| 驗收項目 | 結果 |
| --- | --- |
| Monster 搜尋（全部 9 個新增 ID） | passed |
| Monster Detail／Drop／Map | passed |
| Monster Deep Link | passed |
| Equipment 搜尋（39 個新增 Equipment） | **blocked**；頁面停在 0 筆 legacy fallback |
| Equipment Detail／Monster Relation／分類 | **blocked**；正式 View 未接上頁面 |
| Equipment Deep Link | **failed**；`wpn_giltas_sword` 顯示找不到 |
| Console Error | 0 |
| Monster 必要 JSON | HTTP 200 |
| Equipment index／實測 Detail shard／diagnostics／unresolved | HTTP 200 |
| 新增 Network 404 | 未觀察到 |

HTTP 實測大小：`monsters.json` 996,848 bytes、`maps.json` 293,492 bytes、`drop_tables.json` 6,991,902 bytes、`equipment-index.json` 915,956 bytes、實測 `equipment-details-5.json` 877,136 bytes；全部為 JSON object 且回應 200。

## 9. 部署判定

**Not Ready for Deployment。**

資料同步本身已完成，且所有自動測試通過；唯一已確認的部署阻擋是 `wiki.html` 的 786 筆硬編碼成功基線。由於該檔不在本 Sprint 允許修改範圍，本次保留現況並提出最小修正：只將 Equipment Dataset 初始化的預期筆數改為 825，不改 Repository、View Adapter、JSON、UI 行為或 fallback 架構。完成該一行接線後，需重新執行 Browser 驗收，通過後才可改判為 Ready for Deployment。
