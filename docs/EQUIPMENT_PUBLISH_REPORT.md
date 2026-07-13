# Equipment Publish Report

## 1. 發布結論

Equipment Dataset View 已改為正式預設資料來源。使用者不需要再附加 `equipmentData=1`；既有帶有 `equipmentData=1` 的連結仍可正常使用。

正式模式規則：

| URL 狀態 | Equipment 資料來源 |
|---|---|
| 無 `equipmentData` | Dataset（正式預設） |
| `equipmentData=1` | Dataset（舊 URL 相容） |
| `equipmentData=0` | legacy `EQUIP_DATA`（強制 fallback） |

新開啟的 Equipment Detail URL 不再主動加入多餘的 `equipmentData=1`，但既有連結與 Monster relation 內的相容參數不受影響。

## 2. 修改範圍

本階段只修改／新增：

- `wiki.html`
- `docs/EQUIPMENT_PUBLISH_REPORT.md`

沒有修改 JSON、Dataset、Schema、generator、validator、Repository、View Adapter、CSS、Monster、Craft 或 WikiDataCore。

## 3. Legacy fallback

Legacy fallback 完整保留：

```text
Equipment 預設啟動
  → 載入 equipment-index.json
  → 成功：使用 Dataset View
  → HTTP 404／parse error／invalid envelope：使用 legacy EQUIP_DATA
```

實際瀏覽器注入 `equipment-index.json` HTTP 404 後確認：

- `data-equipment-data-mode=fallback`
- `data-equipment-data-ready=false`
- `data-equipment-data-source=legacy`
- Equipment cards：786
- Craft Tab 仍可操作
- Console Error：0

`equipmentData=0` 亦可在沒有載入 Dataset View 的情況下強制使用 786 筆 legacy Equipment。

## 4. 保留的 Dataset 行為

發布接線沒有改動下列行為：

- Initial payload 仍只要求 `equipment-index.json`。
- Detail 仍由 16 個 hash shard lazy load。
- diagnostics／unresolved 仍在 Detail 開啟後 lazy load。
- Repository 的 shard promise dedupe、Entity cache 與 Detail cache 保留。
- Detail shard 或 diagnostics 局部失敗不會使 Equipment index 失效。
- canonical owner 仍是 `data/equipment/equipments.json`。

19 份 runtime 必要檔（index、diagnostics、unresolved、16 個 Detail shard）實際 HTTP 狀態全部為 200。

## 5. 正式預設驗收

驗收 URL：

```text
wiki.html?tab=equip&equipment=acc_116
```

未提供 `equipmentData` 時：

- mode：`dataset`
- ready：`true`
- source：`dataset`
- Equipment：786
- Deep Link：傳送控制戒指 Detail 正常開啟
- 初始 payload：868,090 bytes
- Console Error：0

相容 URL `equipmentData=1` 同樣回傳 Dataset 786 筆。`equipmentData=0` 則回傳 legacy 786 筆，且不還原 Dataset-only Detail。

## 6. Deep Link 與歷史導覽

無 `equipmentData` 的正式 Deep Link 已驗證：

- 直接開啟 Detail：通過
- Reload：保留 Detail
- 關閉 Detail：只移除 `equipment` query
- Back：還原 Detail
- Forward：回到關閉狀態
- URL 不會被強制加回 `equipmentData=1`

## 7. 跨模組瀏覽器驗收

實際點擊並驗證：

| 功能 | 結果 |
|---|---|
| Equipment | Dataset ready；786 cards |
| Monster | ready；正式 Monster Tab 正常 |
| Craft | Tab 切換與資料載入正常 |
| Cards | Tab 切換正常 |
| 遊戲首頁 `index.html` | 正常開啟；標題「放置天堂 - 蛇神降世」 |
| Console | Error 0 |
| 正常 Dataset Network | 必要檔 HTTP 200，無 404 |

## 8. 自動測試與資料驗證

| 驗證 | 結果 |
|---|---|
| Equipment Publish contract | 5 / 5 passed |
| Equipment Repository | 25 / 25 passed |
| Equipment Shadow Comparison | 32 / 32 passed；blocking mismatch 0 |
| Equipment View Payload validator | passed；byte-stable；786 / 786 Detail coverage |
| Equipment canonical validator | passed；Schema／byte-stable |
| Monster UI RC | 15 / 15 passed |
| Monster UI Beta | 21 / 21 passed |
| Craft validator | passed |
| WikiDataCore | passed |
| `git diff --check` | passed |

既有 `test_equipment_ui_rc.js` 內含「發布前預設關閉」的靜態斷言，發布後該斷言已被正式模式取代；依本階段限制未修改測試檔。Repository、payload、fallback 與瀏覽器 runtime 驗證均已獨立通過。

## 9. Legacy 移除建議

目前不建議移除 legacy `EQUIP_DATA`。

理由：

- 它仍是 `equipment-index.json` 部署失敗時的唯一完整 fallback。
- `equipmentData=0` 是本次正式發布承諾的緊急回退入口。
- 仍有 624 筆 legacy source relation 尚未建立正式 Entity relation；雖不應把它們轉成猜測資料，但保留 legacy 有助於相容與查錯。
- 應先累積正式發布後的 Network／fallback 觀測紀錄，再另立階段評估移除。

建議至少在確認 Dataset 長期部署穩定、所有必要檔均有版本化依賴紀錄、legacy-only 關聯完成處理，且另有可逆回退方案後，再考慮移除。

## 10. Git 狀態

本階段未 commit、未 push。
