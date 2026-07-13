# Equipment Stage E3-D2：Initial Payload Optimization 報告

## 1. 階段結論

E3-D2 已把 Feature-flagged Equipment Dataset View 的 initial required payload 從完整 `equipments.json` 改為 `equipment-index.json`，並把完整 canonical Equipment Entity 依穩定 hash 分成 16 個 lazy Detail shard。

- E3-D1 initial payload：11,067,281 bytes。
- E3-D2 initial payload：868,090 bytes。
- Initial bytes 減少 10,199,191 bytes，降幅 92.16%。
- 初始不再 required fetch `equipments.json`、`diagnostics.json`、`unresolved.json` 或 Detail shard。
- Detail 只載入對應 shard；同頁相同 shard 以 promise＋Entity cache 去重。
- canonical `equipments.json`、Schema 與生成語意未修改。
- Feature Flag 仍預設關閉，legacy `EQUIP_DATA` fallback 保留。

## 2. 唯讀欄位大小分析

量測對象為 11,067,281-byte checked-in `equipments.json`。欄位數據以相同 UTF-8 JSON scalar/object 內容，逐筆計算 `key + colon + value + separator`；pretty-print indentation／換行另列，避免把空白錯算成特定欄位。

| 欄位 | Content bytes | 原檔占比 |
|---|---:|---:|
| `verification` | 4,575,018 | 41.34% |
| `baseStats` | 1,358,324 | 12.27% |
| `relations` | 386,253 | 3.49% |
| `version` | 119,472 | 1.08% |
| `classRequirements` | 87,809 | 0.79% |
| `description` | 84,034 | 0.76% |
| `safeEnhance` | 78,390 | 0.71% |
| `price` | 57,909 | 0.52% |
| `entityRef` | 52,866 | 0.48% |
| `displayName` | 26,093 | 0.24% |
| `equipmentId` | 24,570 | 0.22% |
| `equipmentType` | 20,576 | 0.19% |
| `equipmentGroup` | 20,511 | 0.19% |
| `status` | 14,986 | 0.14% |
| `rarity` | 14,239 | 0.13% |
| `mechanicRefs` | 14,148 | 0.13% |
| `itemType` | 13,362 | 0.12% |
| `slot` | 12,430 | 0.11% |
| `skillRefs` | 11,790 | 0.11% |
| `setRefs` | 10,218 | 0.09% |
| Pretty-print／envelope／結構空白差額 | 4,084,283 | 36.90% |

欄位 content 合計 6,982,998 bytes；compact whole document 約 6,984,629 bytes。原檔以固定 two-space pretty JSON 保存，因此有較高結構成本，但 canonical byte format 不在本階段修改。

### 2.1 卡片／搜尋必要欄位

- identity／label：`equipmentId`、`displayName`、`entityRef`。
- classification：`itemType`、`equipmentGroup`、`equipmentType`、`slot`、`rarity`。
- card／sort：`price.amount`、resolved `baseStats`、`safeEnhance` summary、`classRequirements.baseClasses`。
- search：canonical description、正式與中文 group／type／slot label；compatibility-only legacy text 繼續由既有 `EQUIP_DATA` 在記憶體建立，不複製進 payload。
- state／routing：`status`、`detailLocator`。

### 2.2 只在 Detail 需要

- 完整 22-field `baseStats` provenance shape。
- `relations`、`verification`、`version`。
- `skillRefs`、`setRefs`、`mechanicRefs`。
- 完整 `safeEnhance`、`classRequirements`、`price`、`description` objects。

### 2.3 可 deterministic 重建

- `detailLocator`：`sha256(equipmentId)[0]`。
- summary resolved stats：canonical `baseStats.valueState ∈ {explicit, explicit_zero}` 的投影。
- 中文分類 label：固定 code table，不進正式 identity。
- compatibility search text：同 ID legacy record 的明確 migration projection，不進 EntityRef。

### 2.4 不得從 canonical Dataset 移除

全部 20 個 canonical top-level fields 均保留於 `equipments.json` 與 Detail shards。View index 是非 authoritative deterministic read model，不能取代 Equipment owner。

## 3. Payload 架構與選擇原因

採用兩層 payload：

1. 單一 `equipment-index.json`，786 筆 deterministic summary。
2. 16 個 `equipment-details-[0-f].json`，保存完整 canonical Entity。

Detail bucket：

```text
sha256(UTF-8 equipmentId)[0]
```

選擇 16 個 hash shard，而非 group shard：

- group shard 會形成約 1.9–4.8 MB 的不均勻 payload，單一 Detail 成本過高。
- 每件一檔會建立 786 個檔案與大量 request／部署負擔。
- 16 shard 平均 691,839 bytes、最大 824,570 bytes，請求與檔案數保持低複雜度。
- hash 規則不依中文名稱、group、來源順序或陣列位置，版本化且穩定。

## 4. 新增與修改檔案

新增：

- `schemas/equipment-view-index.schema.json`
- `tools/generate_equipment_view_payload.py`
- `tools/validate_equipment_view_payload.py`
- `tools/test_equipment_view_payload.py`
- `data/equipment/equipment-index.json`
- `data/equipment/equipment-details-0.json` 至 `equipment-details-f.json`
- `docs/EQUIPMENT_STAGE_E3D2_REPORT.md`

最小修改：

- `js/wiki-equipment-data.js`
- `js/wiki-equipment-view-adapter.js`
- `tools/test_equipment_view_adapter.js`
- `wiki.html`

沒有修改 CSS、canonical generator／validator／Schema、WikiDataCore 或其他 Domain。

## 5. Index 與 Detail 結構

### 5.1 Index

Index 每筆固定 15 fields：

- `equipmentId`、`displayName`、`itemType`
- `equipmentGroup`、`equipmentType`、`slot`、`rarity`
- compact `price`、`description`、`classRequirements`、`safeEnhance`
- resolved-only compact `baseStats`
- `status`、`entityRef`、`detailLocator`

Index 明確不包含 `verification`、`relations`、`version` 或完整 unresolved stat payload。

### 5.2 Detail

每個 shard envelope 包含 `dataset`、`schemaVersion`、`viewPayloadVersion`、`bucket`、`records`。`records` 是原 canonical Entity 的完整 semantic copy，依 `equipmentId` 排序。16 shard 合計 786 筆，無 orphan、missing 或 duplicate。

## 6. Dataset ownership 邊界

- Authoritative owner：`data/equipment/equipments.json`。
- View index／Detail shard：只由 canonical Dataset deterministic 生成的 transport projection。
- View payload 不提供新的 Evidence，不修正 unresolved，不擁有 relation。
- Detail validator 要求每筆 object 與 canonical Entity deep equality。
- Generator 只讀 canonical Dataset，不讀 DOM、不執行遊戲程式、不修改 canonical file。

## 7. 載入流程與 cache

### 7.1 正常模式

沒有 `equipmentData=1`：不建立 Repository、不 fetch Equipment payload，UI 使用 legacy `EQUIP_DATA` 786 筆。

### 7.2 Dataset initial

```text
equipmentData=1
  → required equipment-index.json
  → validate envelope/version
  → build 786 summary indexes/read models
  → render existing cards/search/filter/sort
```

Initial 不 required：canonical `equipments.json`、diagnostics、unresolved、任何 Detail shard。

### 7.3 Detail

```text
open equipmentId
  → summary.detailLocator
  → validate safe relative locator
  → fetch one hash shard
  → validate envelope/version/bucket/ownership
  → cache shard Entities
  → render canonical Detail
  → diagnostics + unresolved lazy load in parallel
```

同 locator 共用一個 promise；已載入 Entity 由 Adapter／Repository cache 回傳。Back／Forward 在同頁再次開啟時命中 cache。

Shadow 模式仍可要求完整 canonical Dataset；若 View 與 Shadow 同時開啟，Index 與 canonical responsibilities 分離，canonical `equipments.json` 最多 fetch 一次。

## 8. Fallback

- Index 404、parse error、invalid envelope/version 或 duplicate ID：完整回退 legacy 786 cards。
- Detail 404、parse error、invalid bucket/version 或 coverage：只顯示「詳細資料載入失敗」。Index、搜尋、分類與卡片保持可用，不顯示 summary 假 Detail，不整頁回退。
- Diagnostics failure：canonical Detail 與 View 保持可用；diagnostics state 標記失敗。
- Optional unresolved 失敗：從 diagnostics unresolved subset 建立既有 fallback。
- 所有失敗回傳 state/null，不產生 unhandled rejection；Browser Console Error 0。

## 9. Search 與 Detail parity

Search 保持 E3-D1 行為：中文完整／部分名稱、Equipment ID、中文／正式 group／type／slot、canonical description、compatibility-only legacy text。E3-C 十個固定 fixture 全部有結果且 deterministic，結果數：1、1、1、332、339、42、58、26、55、34。

Detail shard 與 canonical 786 / 786 deep equality，因此名稱、分類、rarity、price、22 stats、safe、class requirement、description、Monster relation、Craft relation、status 與 verification 保持 E3-D1 語意。

- price review-required：5。
- safe unresolved：4。
- class requirement unresolved：4。
- description missing：277。
- Monster Drop relations：1,533。
- Craft Result：220。
- Craft Requirement：103。

## 10. Deterministic 與 Validator

Generator／validator 保證：

- UTF-8、LF、固定 key／record 排序、單一結尾 newline。
- 無 timestamp、本機路徑、`file://`、localhost。
- 兩次生成、input reverse 與 checked-in output byte-identical。
- Index Schema、786 count、identity、classification 與 summary parity。
- 786 Detail coverage、單一 locator、safe relative path、hash bucket parity。
- Detail canonical semantic parity與 Equipment Schema validation。
- duplicate、orphan、missing、invalid locator、local path leak 均拒絕。
- canonical Dataset 與 legacy `EQUIP_DATA` 不被生成流程修改。

Validator：passed；byteStable=true；17 個 output SHA-256 固定並由 validator 回報。

## 11. 自動化與回歸

新增／更新：

- View Payload tests：30 / 30 passed。
- View Adapter tests：64 / 64 passed。

既有回歸：

- Equipment Repository：25 / 25。
- Equipment Shadow：32 / 32，blocking mismatch 0。
- Canonical Equipment：validator／Schema／byte stability passed；30 / 30。
- Equipment fixtures：validator／Schema passed；25 / 25。
- Monster Dataset：validator／Schema passed；7 / 7。
- Legacy Mapping：validator passed、blocking 0；30 / 30。
- Craft validator：passed。
- WikiDataCore：passed。
- Monster UI RC：15 / 15。
- Monster UI Beta：21 / 21。
- 新增／修改 JS `node --check`：passed。
- `git diff --check`：passed。

## 12. Browser acceptance 與效能

本機靜態伺服器、Codex in-app Browser 單次樣本；不是跨裝置效能保證。

| 指標 | E3-D1 | E3-D2 |
|---|---:|---:|
| Initial required Equipment bytes | 11,067,281 | 868,090 |
| Initial reduction | — | 92.16% |
| Initial required files | full Equipment 1 | Index 1 |
| Initial diagnostics／unresolved | 不 required | 不 required |
| Index fetch | — | 約 8–19 ms |
| Index parse | — | 約 5.9–11.3 ms |
| Index build | — | 約 13–16.9 ms |
| Index ready | full payload baseline 未獨立保存 | 約 37.1–54.8 ms |
| 786 card render | 約 58 ms | 約 31.3–43.3 ms |
| Detail shard size | 不適用 | 540,550–824,570 bytes；平均 691,839 |
| First Detail fetch | 不適用 | 約 15.1–328.2 ms |
| First Detail parse | 不適用 | 約 4.6–5.4 ms |
| Same-page cache hit | 不適用 | verified；第二次不 fetch shard |

Detail 16 shard 合計 11,069,429 bytes，只在使用者逐步開啟不同 hash bucket 時下載，不是 initial payload。

Browser 功能驗收：

- Dataset initial：786 cards、309／339／138。
- ID 與中文搜尋正常。
- Detail／reload Deep Link 正常。
- Back／Forward 正常；同頁 reopen cache hit 1。
- Detail 後 diagnostics lazy ready。
- 預設模式：legacy、786 cards、Dataset disabled。
- 390 × 844：786 cards、Detail 正常、無水平溢位。
- Console Error：0。
- Index、抽樣 Detail、canonical、diagnostics、unresolved：HTTP 200。

## 13. 尚未處理限制

- Index 868 KB 已大幅下降，但仍包含 509 筆 canonical descriptions 與 card stats；未做 HTTP compression／service worker／binary encoding。
- 開啟第一個 Detail 時 diagnostics 仍為 1.26 MB 並行 lazy load；未做 per-Entity diagnostics index。
- 16 shard 總量略高於 canonical，來自 16 個 envelope／pretty structure；換取單次 Detail 低傳輸。
- compatibility-only legacy search 仍依賴內嵌 `EQUIP_DATA`；本階段沒有移除 fallback 或改變退場政策。
- payload version 固定為 1.0.0；未建立跨版本 migration framework。

## 14. RC 建議

建議可以進入 Equipment UI RC 的受控驗收，但仍不建議立即移除 Feature Flag 或 legacy fallback。

RC 應重點驗證：

1. GitHub Pages 實際 CDN／compression 下的 Index 與 shard latency。
2. 低速行動網路首次 Detail 加上 diagnostics 的體感。
3. Detail shard／diagnostics 失敗注入下的玩家訊息。
4. compatibility-only search 與 624 件 legacy relation unresolved 的後續政策。

本階段未 commit、未 push。
