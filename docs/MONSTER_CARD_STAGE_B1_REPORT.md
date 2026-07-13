# Monster／Card Stage B1 實作報告

## 1. 範圍

Stage B1 建立 machine-readable Legacy Mapping pipeline，只處理 legacy／name-based source 到既有 Entity ID 的安全轉接。未建立 Monster、Map、Region、Card 或 Item 新 ID，未建立 Monster／Card 正式 Dataset，也未接入 WikiDataCore 或 UI。

## 2. 新增檔案

- `schemas/legacy-entity-mapping.schema.json`
- `data/mappings/legacy-entity-mappings.json`
- `data/mappings/unresolved-legacy-mappings.json`
- `tools/generate_legacy_entity_mappings.py`
- `tools/validate_legacy_entity_mappings.py`
- `tools/test_legacy_entity_mappings.py`
- `docs/MONSTER_CARD_STAGE_B1_REPORT.md`

採用 `data/mappings/` 是因 mapping 是跨 Domain compatibility data，不屬 `data/craft/`、Monster 或 Card 主資料。

## 3. Schema

- JSON Schema Draft 2020-12。
- `$id`：`https://dim-era-claw.github.io/idle-lineage-wiki/schemas/legacy-entity-mapping.schema.json`。
- `schemaVersion`：`1.0.0`。
- Dataset 與所有 record／EntityRef／Evidence／VersionScope 均禁止 `additionalProperties`。
- 列舉完整覆蓋契約的 mappingType、status 與 matchMethod。
- Schema 條件保證 resolved／compatibility_only 有 target 與 evidence；unresolved／missing_target 無 target；ambiguous 至少兩個 candidates。

## 4. Generator

Generator 完全離線讀取：

- `js/00-data.js`
- `js/01-drops-config.js`
- `js/11-world-map.js`
- `js/15-cards.js`
- `wiki.html`
- `data/craft/drops.json`

Python 以本機 Node runtime 在隔離 context 中解析既有 JavaScript 常數，不執行網路請求、不操作 DOM、不修改來源。Generator 不做模糊比對、編輯距離、繁簡轉換、刪括號或刪前後綴。

輸出：

- resolved／compatibility file：3,085 records。
- unresolved／missing-target file：566 records。
- 合計：3,651 records。

## 5. Mapping ID assignment strategy

格式為 `mapping_<mappingTypeToken>_<sourceScopeToken>_<variant>`。

- mappingType 與 sourceScope 使用程式內固定 ASCII token table。
- resolved mapping 優先使用既有 target ID 作受控 variant。
- 唯一非 ASCII monster ID `侏儒` 使用明示、受版本控制的 `monster_dwarf_legacy` assignment。
- unresolved 傲慢之塔位置使用 `pride_floor_###`／`pride_range_###_###` 規則。
- 其他 location、Craft unresolved 與 pride item 使用明示 assignment 或受控 ASCII pattern。
- Card candidate 使用已解析 Monster ID 作 variant，但 target 仍為 null；這不建立 Card ID。
- 不使用 source order、陣列 index、中文 sourceValue 或 runtime hash。

因此來源或輸入重排不會重編 mapping ID。

## 6. Baseline counts

| mapping | resolved | compatibility_only | unresolved | missing_target |
|---|---:|---:|---:|---:|
| Monster canonical name | 460 | 0 | 0 | 0 |
| Drop owner | 433 | 0 | 0 | 0 |
| Wiki monster | 408 | 0 | 0 | 0 |
| Craft monster | 365 | 0 | 1 | 0 |
| Card legacy monster | 0 | 409 | 0 | 0 |
| Navigation map label | 100 | 0 | 0 | 18 |
| Wiki location | 83 | 0 | 120 | 0 |
| Wiki item name | 827 | 0 | 18 | 0 |
| Legacy card candidate | 0 | 0 | 409 | 0 |

全 Dataset status：2,676 resolved、409 compatibility_only、548 unresolved、18 missing_target。Ambiguous 與 conflict 均為 0。

## 7. Unresolved policy

- `精靈墓穴怪物` 保留 sourceValue、sourceLocation、原因，target 為 null。
- 18 個 pride item name 保持 unresolved，沒有建立 pride item ID。
- 120 個 Wiki location 保持 unresolved，沒有建立 Region／MapGroup ID。
- 409 個 Card candidates 保持 unresolved，notes 只保存已解析 Monster candidate，不建立 Card ID。
- 18 個 navigation values 不在 `DB.maps`，標記 missing_target，不把 destination key 假裝 Map Entity。
- unresolved 不使整份 Mapping Dataset failed；未來 required relation 由下游標記 partial／review_required。

## 8. Validator

Validator 執行：

- JSON Schema 與 enum。
- ID 格式、唯一性與固定排序。
- sourceScope/sourceValue resolved target conflict。
- target existence 與 mappingType target type。
- status／target／candidate／evidence 條件。
- normalized collision、alias cycle、replacement existence。
- 本機絕對路徑與 canonical UTF-8/LF bytes。
- 受控 baseline counts；不會自動更新 baseline。

實際 mapping validation：通過，0 blocking diagnostics。

## 9. Tests

`tools/test_legacy_entity_mappings.py` 共 30 tests，覆蓋需求列出的 30 個案例：全部通過。

包含 duplicate／conflict／ambiguous／missing target／evidence／normalization／alias cycle／replacement／target type 等負向測試，以及 input reorder、file reorder、SHA-256、UTF-8/LF、unresolved 與所有 baseline count 測試。

## 10. Deterministic output

- JSON key 固定排序。
- Records 依 mappingType、sourceScope、sourceValue、id 固定排序。
- UTF-8、LF、單一結尾 newline。
- 相同輸入重跑 bytes 與 SHA-256 一致。
- resolved output SHA-256：`00a29beaaea6645fa1063103c8b5e708e21e92b3c14482f882812121a8830715`。
- unresolved output SHA-256：`8e2bdf660e39a91cc2529dc474585c3d5c12cc81a345714495ed983bbda1150f`。
- 輸出不含本機絕對路徑。

## 11. WikiDataCore 未來接入

本階段未修改 WikiDataCore。輸出已可供未來 `mappings` repository 使用，支援規劃中的 `resolve`、`getCandidates`、`getByTarget`、`getLegacyKeys`、`getUnresolved`、`getConflicts`。

Canonical Entity lookup 不依賴 mappings repository；mapping 只作 compatibility layer。compatibility_only 必須明確 opt-in，ambiguous／conflict 不得回第一筆。

## 12. 回歸與邊界確認

執行項目：

- Mapping validator：通過。
- Mapping tests：30／30 通過。
- Source Manifest tests：22／22 通過。
- Craft validator：通過；279 recipes、47 NPCs、471 items，cycle check passed。
- WikiDataCore tests：通過；5 次 fetch、0 console errors。
- `git diff --check`：通過。

沒有修改 HTML、CSS、JavaScript、`wiki.html`、Craft JSON、存檔格式、Card identity、Drop owner、WikiDataCore 或 Source Manifest 工具。

## 13. 下一階段判斷

可以進入 Monster／Map／Drop 資料契約階段。下一階段應引用本 mapping Dataset，但不得讓 canonical Monster／Map lookup 依賴 legacy mapping；120 個 location、18 個 missing navigation target 與 conditional drop 邊界仍須保持 unresolved／review_required。
