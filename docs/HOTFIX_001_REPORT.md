# Hotfix-001：Equipment Dataset Initialization Fix

## 結論

**Ready for Deployment。**
Hotfix 已解除 Sprint 1 唯一部署阻擋。Equipment Dataset View 現在依據實際載入結果、View Adapter ready 狀態與非空 Dataset 判定初始化成功，不再依賴固定的 786 或 825 筆數。

## 1. 修改檔案

- `wiki.html`
- `docs/HOTFIX_001_REPORT.md`

沒有修改 `js/wiki-equipment-data.js`，也沒有修改 Monster、CSS、Generator、Validator、Schema、Dataset、Mapping、View Payload、Search 行為或其他功能。

## 2. 修改原因

Sprint 1 已將 Equipment Dataset 更新至 825 筆，Repository 與 View Adapter 也能成功載入全部資料，但 `wiki.html#initEquipmentDataViewIfEnabled()` 仍以 `count !== 786` 判定失敗。因此實際狀態雖為 `ready: true`、`source: dataset`、`count: 825`，頁面仍錯誤進入 legacy fallback，造成新增 39 件裝備無法搜尋、Detail Deep Link 失敗，Dataset View 也沒有正式啟用。

## 3. 修正方式

初始化成功條件由固定筆數檢查改為：

1. `equipmentViewAdapter.load()` 必須成功。
2. `equipmentViewAdapter.getState().ready` 必須為 `true`。
3. `equipmentViewAdapter.getState().count` 必須大於 0。

任何一項不成立時仍維持既有 fail-closed 行為，清空 Dataset read models 並安全 fallback 到 legacy。Repository、View Adapter、Detail shard、diagnostics、cache 與 fallback 架構均未改動。

## 4. 為何不再依賴固定筆數

Dataset 的實際筆數會隨上游版本變動。固定比對 786 或 825 會讓下一次合法同步再次被誤判失敗。新的條件使用既有載入契約所提供的成功布林值與 ready metadata，並要求 Dataset 非空；因此能拒絕載入失敗或空資料，同時允許經過既有 Schema、Validator 與 Dataset pipeline 驗證的新版本自然啟用。

此 Hotfix 沒有降低 Dataset 驗證責任：筆數、Schema、ID 與外鍵完整性仍由現有 Generator／Validator／測試負責；`wiki.html` 只判斷已驗證 View Payload 是否成功載入。

## 5. Browser 驗收

使用本機靜態伺服器實際開啟 Wiki 驗收，結果如下：

| 項目 | 結果 |
| --- | --- |
| Equipment Dataset View | passed；`equipmentDataMode=dataset`、`equipmentDataReady=true` |
| Equipment 顯示總數 | passed；825 |
| 39 件新增 Equipment 搜尋 | passed；39/39 |
| Equipment Detail | passed；`wpn_giltas_sword` 顯示「吉爾塔斯之劍」與完整屬性 |
| Monster Relation | passed；正式連結指向 `sanct_giltas` |
| Equipment Deep Link | passed；重新開啟可還原 Detail |
| Reload | passed；Reload 後仍顯示同一 Equipment Detail |
| Back | passed；從 Monster Relation 返回後還原 Equipment Detail |
| Forward | passed；再次前進後還原吉爾塔斯 Monster Detail |
| Monster Dataset | passed；469 Monster、217 Map、441 DropTable |
| Monster Detail | passed；吉爾塔斯 Detail 正常 |

驗收使用 cache-busting query 排除瀏覽器先前保存的舊 `wiki.html`，確認測試的是本次 Hotfix 內容。

## 6. Regression

| 測試 | 結果 |
| --- | --- |
| Equipment Repository | 25/25 passed |
| Equipment Shadow | 32/32 passed |
| Equipment View Adapter | 71/71 passed |
| Equipment UI RC | 72/72 passed |
| Monster UI RC | 15/15 passed |
| Monster UI Beta | 21/21 passed |
| Craft validator | passed |
| WikiDataCore | passed |
| `git diff --check -- wiki.html` | passed；無 whitespace error |

## 7. Console

- Browser Console Error：0。
- WikiDataCore captured console errors：0。
- Dataset 初始化後 diagnostics 顯示 `ready: true`、`source: dataset`、`count: 825`。

## 8. Network

實際 HTTP 驗證 `data/equipment/` 內 20 份 JSON 與 `data/monster/` 內 4 份 JSON：

- HTTP 200：24/24。
- 非 200：0。
- 新增 404：0。

涵蓋 Equipment index、16 個 Detail shards、canonical Dataset、diagnostics、unresolved，以及 Monster、Map、DropTable、unresolved Dataset。

## 9. Deployment Readiness

Sprint 1 的唯一已確認阻擋已解除。Dataset View、39 件新增裝備、Deep Link、Monster Relation、歷史導覽、Monster 469 筆基線、Console、Network 與指定回歸測試均通過。

**Ready for Deployment。**
