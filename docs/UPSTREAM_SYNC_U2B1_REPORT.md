# Upstream Sync U2-B1 Report

## 1. 結論與範圍

本階段已完成兩項基線工作：

1. 將 Equipment View Adapter 與 UI RC 測試更新為目前已發布的資料來源行為。
2. 建立一份不含版本身分的 15 檔上游來源 Inventory fixture，明確區分 canonical owner、classification owner 與各類 evidence。

本階段沒有產生 v3.4.17 Dataset，沒有修改 `wiki.html`、正式 Dataset、Monster／Equipment Generator 或玩家可見 UI。

## 2. 新增與修改檔案

修改：

- `tools/test_equipment_view_adapter.js`
- `tools/test_equipment_ui_rc.js`

新增：

- `schemas/release-source-inventory.schema.json`
- `fixtures/releases/upstream-source-inventory-v1.json`
- `tools/validate_source_inventory.py`
- `tools/test_source_inventory.py`
- `docs/UPSTREAM_SYNC_U2B1_REPORT.md`

既有 `fixtures/releases/bootstrap-source-files.txt` 與 `fixtures/releases/bootstrap-source-manifest.example.json` 保持 bootstrap example，不改寫為 v3.4.17 Manifest。

## 3. Equipment regression baseline 更新

測試現在以 Equipment Publish 後的實際規則為準：

| 情境 | 預期行為 |
|---|---|
| URL 無 `equipmentData` | 預設啟用 Dataset View |
| `equipmentData=1` | 相容模式，使用 Dataset View |
| `equipmentData=0` | 強制使用 legacy `EQUIP_DATA` |
| `equipmentData=0` | 不 fetch `equipment-index.json` |
| index HTTP failure | 安全回退至 legacy 786 筆 |
| index JSON parse failure | 安全回退至 legacy 786 筆 |
| 正式 Equipment deep link | 不主動加入 `equipmentData=1` |
| 舊式含 `equipmentData=1` deep link | 保持相容 |

兩組測試直接擷取並執行 `wiki.html` 目前的模式判定函式，因此可偵測測試預期與正式接線再次分歧。測試也確認 Monster、Craft、Cards 初始化仍存在，fallback 不產生未處理 rejection，且測試環境 Console Error 為 0。

結果：

- Equipment View Adapter：71/71 passed
- Equipment UI RC：72/72 passed

## 4. Source Inventory 模型

Inventory 根層欄位：

- `inventoryVersion`
- `repository`
- `branch`
- `domains`
- `ownerType`
- `files`
- `notes`

每個檔案記錄：

- `path`
- `domains`
- `role`
- `required`
- `ownerType`
- `extractionPurpose`
- `notes`

Inventory 僅描述「應檢查哪些來源」及其責任，不承擔某一次同步的版本身分。Full SHA、GameVersion、commit date、`retrievedAt` 與檔案 hash 應由 Source Manifest 記錄。

## 5. 15-file scope

1. `index.html`
2. `js/00-data.js`
3. `js/01-drops-config.js`
4. `js/02-stats-recompute.js`
5. `js/03-combat-core.js`
6. `js/04-combat-attack.js`
7. `js/05-kill-progression.js`
8. `js/06-status-allies.js`
9. `js/07-skills-cast.js`
10. `js/08-items-equip.js`
11. `js/10-ui-tabs.js`
12. `js/11-world-map.js`
13. `js/14-craft-pandora.js`
14. `js/15-cards.js`
15. `js/19-equipment-window.js`

全部 15 檔均標為 full audited inventory scope 的 required input。路徑必須是唯一、排序後的安全 POSIX 相對路徑。

## 6. Role 與 owner 分類

| Role | 數量 | 責任 |
|---|---:|---|
| `canonical_owner` | 2 | 正式 Domain 資料 owner |
| `classification_owner` | 1 | 正式分類規則 owner |
| `runtime_evidence` | 9 | 執行期公式、效果、流程與互動證據 |
| `parity_evidence` | 2 | Craft／Card 等跨 Domain 對照證據 |
| `entrypoint_evidence` | 1 | 載入順序與入口證據 |

關鍵責任：

- `js/00-data.js`：Monster、Map、Item、Equipment canonical owner。
- `js/01-drops-config.js`：Drop canonical owner。
- `js/10-ui-tabs.js`：Equipment classification owner。
- `js/11-world-map.js`：Map label、navigation 與 spawn runtime evidence；不是 Map identity owner。
- `js/14-craft-pandora.js`：Craft parity evidence；不是 Monster／Equipment canonical owner。
- `js/15-cards.js`：Card／Monster parity evidence。
- 其餘程式檔只作 runtime evidence，不因引用資料而升格為 canonical owner。

## 7. Schema、Validator 與測試

Schema 使用 JSON Schema Draft 2020-12，關閉未宣告欄位，並限制 role、owner type、Domain 與安全相對路徑格式。

Validator 除 Schema 外，另檢查：

- 正好包含指定的 15 個唯一檔案。
- 檔案與 Domain 排序固定。
- canonical owner 正好為 `js/00-data.js` 與 `js/01-drops-config.js`。
- Drop owner 與 Equipment classification owner 不得缺少。
- role 與 owner type 一致。
- 不含絕對路徑、本機路徑、mutable timestamp、GameVersion 或 commit SHA。
- UTF-8、LF、單一結尾換行與 canonical JSON bytes。

結果：

- Source Inventory Validator：passed，15 files、15 unique paths。
- Source Inventory tests：18/18 passed。
- Role counts：canonical 2、classification 1、runtime 9、parity 2、entrypoint 1。

## 8. Deterministic 與 byte stability

Inventory canonicalizer 會固定物件鍵、檔案順序與 Domain 順序。測試已證明輸入檔案或 Domain 重排後仍產生相同 canonical bytes，fixture 亦符合 UTF-8、LF 與單一結尾換行要求。

Source Inventory 不包含會隨同步批次改變的 timestamp、GameVersion 或 commit SHA，因此可作為長期穩定的來源範圍 fixture；批次身分仍由 Source Manifest 單獨記錄。

## 9. 完整 Regression 結果

- WAP Semantic Diff：45/45 passed
- Source Manifest：22/22 passed
- Source Inventory：18/18 passed
- Equipment fixtures：25/25 passed
- Equipment Dataset：Validator passed、30/30 passed
- Equipment View Payload：Validator passed、30/30 passed
- Equipment Repository：25/25 passed
- Equipment Shadow Comparison：32/32 passed
- Equipment View Adapter：71/71 passed
- Equipment UI RC：72/72 passed
- Monster Dataset：Validator passed、7/7 passed
- Legacy Mapping：Validator passed、30/30 passed
- Craft Dataset：Validator passed
- WikiDataCore：passed
- Monster UI Beta：21/21 passed
- Monster UI RC：15/15 passed

## 10. U2-B2 前置狀態

Regression baseline 與來源 Inventory 已穩定，可進入 U2-B2 的 candidate generation／fixture review，但下列問題必須在候選資料發布前處理：

- Equipment 新增候選需更新 allowlist 與 classification mapping；`wpn_giltas_wand` 的 subtype 仍 unresolved。
- `reqAvatar`、`strictAvatar`、`resNone` 等欄位需先確認 Contract／Schema／Generator 的承載方式。
- 新增 Equipment mechanic signals 需保留 evidence，不得直接虛構 Mechanic ID。
- `地獄奴隸` 對應 `de_train_hellslave` 或 `sanct_hellslave` 的 identity 衝突仍須人工裁決。
- 新 Map label 的 `SANCTUARY_MAP_NAMES` 擷取責任需明確加入候選生成流程。
- U2-B2 應輸出 ignored candidate，通過 Domain Validator 與 Semantic Diff 後再進 Human Review；不得直接覆寫正式 Dataset。

結論：建議進入 U2-B2，但僅限 candidate generation 與驗證，不代表可直接發布 v3.4.17 Dataset。
