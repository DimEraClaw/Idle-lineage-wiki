# Equipment UI Release Candidate 驗收報告

## 1. 結論

Equipment Dataset View 已完成 Release Candidate 驗收。正式資料檢視仍維持預設關閉，只能以 `equipmentData=1` 啟用；本階段沒有把它改成預設入口，也沒有移除 legacy fallback。

RC 驗收結果：

- Equipment：786 筆（武器 309、防具 339、飾品 138）。
- Initial index、16 個 Detail shard、diagnostics、unresolved 與 canonical Dataset 均可部署。
- 搜尋、27 種 `equipmentType` 篩選、排序、Detail、Deep Link、Reload、Back／Forward、關閉 Detail 與 Monster 關聯跳轉通過。
- Index 失敗可回退至 786 筆 legacy Equipment；Detail 與 diagnostics 失敗均局部隔離。
- 實際瀏覽器 Console Error：0；正常模式 Network 404：0。
- 建議下一個最小步驟為獨立的「預設啟用」發布變更；本階段不直接啟用。

## 2. 本階段變更

新增：

- `tools/test_equipment_ui_rc.js`
- `docs/EQUIPMENT_UI_RC_REPORT.md`

最小修改：

- `wiki.html`
  - Equipment index 非同步等待期間先建立 legacy UI，使其他百科與既有 Equipment 仍可使用。
  - Dataset ready 後以既有 `initEquipWiki()` 重繪，不改既有 UI 結構。
  - diagnostics 載入失敗時顯示「資料狀態暫時無法載入」。
  - Dataset 缺少說明時顯示「尚無說明」。

未修改 `js/wiki-equipment-data.js`、`js/wiki-equipment-view-adapter.js`、CSS、Schema、generator、validator、任何 JSON、canonical Dataset、WikiDataCore 或其他 Domain。

## 3. Dataset 身分與依賴

### 3.1 Canonical owner

- 正式 owner：`data/equipment/equipments.json`
- Dataset pipeline commit：`ce70a06bc7ee3ef418d296346cf74fd45fb3901f`
- Commit：`feat(equipment): add generated equipment dataset pipeline`

### 3.2 View transport projection

- 初始必要檔：`data/equipment/equipment-index.json`
- Detail 必要檔：`data/equipment/equipment-details-0.json` 至 `equipment-details-f.json`，共 16 個 shard。
- View payload commit：`c23133109e3e1ad294077f016c785b7de3ef62ff`
- Commit：`feat(equipment): add optimized equipment view payload`
- `equipment-index.json`：868,090 bytes。
- 16 個 shard：786 / 786 canonical Entity coverage。
- View index 與 shard 是 canonical Dataset 的 deterministic transport projection，不是新的 authoritative owner。

### 3.3 Lazy metadata

- `data/equipment/diagnostics.json`：1,264,445 bytes，Detail 開啟後按需載入。
- `data/equipment/unresolved.json`：1,257,555 bytes，optional；失敗時由 diagnostics 的 unresolved subset 降級。
- 初始載入不要求 `equipments.json`、diagnostics、unresolved 或任何 Detail shard。
- legacy `EQUIP_DATA` 保留為 index 失敗時的 fallback。

## 4. 部署路徑驗收

所有 runtime path 均為相對路徑，沒有 `/data/...` 根路徑、磁碟機路徑、`file://`、`localhost` 或 `127.0.0.1` 寫入資料檔。

驗證情境：

- 網站根路徑：通過。
- 專案子路徑 `/project/Idle-lineage-wiki/wiki.html`：通過。
- `equipmentData=1` 與 Equipment Deep Link 在子路徑下可保留並還原。
- Index、canonical、diagnostics、unresolved 與 16 個 shard：HTTP 200。
- 正常模式 Console Error：0；Network 404：0。

## 5. 固定 RC Fixtures

| 情境 | Equipment ID | 名稱 | Detail shard |
|---|---|---|---|
| Weapon | `relic_amp_staff` | 安普長老的拐杖 | `equipment-details-7.json` |
| Armor | `amr_baphomet` | 巴風特盔甲 | `equipment-details-e.json` |
| Accessory | `acc_116` | 傳送控制戒指 | `equipment-details-d.json` |
| Price review | `relic_mandra_spirit` | 曼陀羅之靈 | `equipment-details-4.json` |
| Safe unresolved | `wpn_22` | 銀箭 | `equipment-details-c.json` |
| Requirement unresolved | `wpn_22` | 銀箭 | `equipment-details-c.json` |
| Description missing | `acc_118` | 守護戒指 | `equipment-details-0.json` |
| Monster relation | `acc_118` | 守護戒指 | `equipment-details-0.json` |
| Craft relation | `acc_134` | 勇敢皮帶 | `equipment-details-0.json` |

## 6. 搜尋、篩選與排序

- Equipment ID 搜尋：大小寫不敏感，`ACC_116` 可找到 `acc_116`。
- 中文完整與部分名稱搜尋：通過。
- 10 個既有 Shadow search fixtures：全部有結果。
- Group：Weapon 309、Armor 339、Accessory 138。
- 27 個 `equipmentType` 的固定數量逐一比對通過；實際 UI 單手劍篩選為 71 筆。
- 名稱排序 deterministic。
- 價格排序由高至低且 deterministic。
- 實際瀏覽器搜尋 `傳送控制戒指` 與 `acc_116` 均只留下 1 張卡片。

## 7. Detail、Deep Link 與 Relation

- 正式 URL：`wiki.html?equipmentData=1&tab=equip&equipment=<equipmentId>`。
- Weapon、Armor、Accessory 三個不同 shard 的 Detail 均可顯示 canonical identity。
- 直接 Deep Link、Reload、Back、Forward、關閉 Detail 均通過。
- 關閉只移除 `equipment` query，不移除 `equipmentData=1`。
- 不存在的 ID 顯示「找不到 Equipment ID」，不猜測名稱或映射。
- Monster relation 只使用正式 Monster Entity ID；`acc_118` 可跳到 `monster=dk`，並顯示死亡騎士 Detail。
- Craft relation 顯示正式 Recipe ID，但因尚無正式 Craft navigation contract，不建立假 URL。
- 624 筆 legacy source unresolved 保持 unresolved，不轉成猜測連結。

## 8. 玩家可見語意

- 缺少 description：顯示「尚無說明」。
- Safe unresolved：顯示「資料尚未建立」，不顯示 `0`。
- Class requirement unresolved：顯示「資料尚未建立」，不顯示「全職業」。
- 5 筆 price conflict：顯示「價格待確認」，保留 source-precedence 選出的 canonical amount。
- `partial`：顯示「部分資料尚未建立」。
- diagnostics 無法載入：canonical Detail 保留，另顯示「資料狀態暫時無法載入」。
- 未建立的 mechanic、interaction 或 legacy relation 沒有被補造。
- 玩家 UI 沒有 Alpha、Beta 或 Shadow 階段名稱。

## 9. 慢速與高延遲驗收

實際瀏覽器以測試伺服器注入約 1.5 秒 index 延遲、0.8 秒 Detail 延遲與 0.6 秒 diagnostics 延遲：

| 指標 | 結果 |
|---|---:|
| Index fetch | 1,514.6 ms |
| Index parse | 5.7 ms |
| Index build | 11.8 ms |
| Index ready | 1,537.5 ms |
| 786 cards render | 30.4 ms |
| 不同 shard Detail fetch | 807.1 ms |
| Detail parse | 4.4 ms |
| Diagnostics lazy load | 642.9 ms |
| Detail cache count | 2 |
| 同 Equipment reopen cache hit | 1 |

Index 等待期間先保留 legacy Equipment UI；Craft、Monster 與其他既有分頁不依賴 Equipment index 才能初始化。Detail 載入期間顯示 loading 訊息，不出現空白 modal。

## 10. Failure Injection

| 故障 | 預期／結果 |
|---|---|
| Index HTTP 404 | 回退 legacy、786 cards、其他 Tab 可操作 |
| Index JSON parse error | 回退 legacy、786 cards |
| Invalid index envelope | fail closed 並回退 legacy |
| Detail HTTP 404 | 只顯示「詳細資料載入失敗」，index 與搜尋保留 |
| Detail JSON parse error | 局部失敗，786 cards 保留 |
| Detail bucket mismatch | 拒絕 shard，局部失敗 |
| Diagnostics HTTP 404 | canonical Detail 保留並顯示暫時無法載入 |
| Diagnostics JSON parse error | canonical Detail 保留並顯示暫時無法載入 |
| Unresolved HTTP 404 | diagnostics 仍 ready，使用 unresolved subset |

自動測試另確認：某一 Detail shard 失敗時，不同 shard 的 Equipment Detail 仍可成功載入。

## 11. Responsive 與瀏覽器 Baseline

- 390 × 844：786 cards 可用，Deep Link modal 顯示，`scrollWidth=390`，無水平溢位。
- Equipment 卡片點擊、搜尋欄、單手劍篩選、價格排序、關閉 Detail、Craft Tab 與 Monster relation 均實際操作。
- 預設模式不含 `equipmentData=1`：`mode=disabled`、786 legacy cards，沒有 Dataset View 強制載入。
- 正常與慢速模式 Console Error：0。

## 12. 自動測試與回歸

| 驗證 | 結果 |
|---|---|
| Equipment UI RC | 66 / 66 passed |
| Equipment View Adapter | 64 / 64 passed |
| Equipment Repository | 25 / 25 passed |
| Equipment Shadow Comparison | 32 / 32 passed；blocking mismatch 0 |
| Equipment View Payload | 30 / 30 passed；byte-stable |
| Equipment canonical Dataset | 30 / 30 passed；Schema／validator／byte-stable |
| Equipment Fixtures | 25 / 25 passed；Schema／validator／byte-stable |
| Monster Dataset | 7 / 7 passed；Schema／validator／deterministic |
| Legacy Entity Mapping | 30 / 30 passed；blocking count 0 |
| Craft validator | passed |
| WikiDataCore | passed |
| Monster UI RC | 15 / 15 passed |
| Monster UI Beta | 21 / 21 passed |
| JavaScript syntax | passed |
| `git diff --check` | passed |

## 13. 發布建議

本 RC 沒有剩餘的技術阻擋問題，建議進入下一個最小發布步驟：以獨立變更把 Equipment Dataset View 設為預設啟用，同時保留 legacy fallback 與可觀測 diagnostics。正式啟用時應再次執行本報告的 66 個 RC 測試、完整回歸、GitHub Pages 子路徑 HTTP 驗證與 Console／Network 驗收。

本階段未 commit、未 push。
