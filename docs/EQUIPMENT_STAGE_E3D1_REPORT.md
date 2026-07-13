# Equipment Stage E3-D1：Feature-flagged View Adapter 報告

## 1. 階段結論

E3-D1 已在預設關閉的 Feature Flag 下，讓既有 Equipment UI 可選擇以正式 `data/equipment/equipments.json` 顯示 786 件裝備。既有卡片、分類、篩選、排序與 Detail 結構未重做；View Adapter 只建立 canonical Dataset 到 legacy render shape 的唯讀投影。

未帶旗標時仍完全使用 `wiki.html#EQUIP_DATA`，不建立 Equipment Repository、不 fetch Equipment JSON。Dataset required load 失敗時也完整回退至 legacy 786 件裝備。沒有修改 CSS、Schema、Generator、Validator、Dataset、WikiDataCore 或其他 Domain。

## 2. 變更範圍

新增：

- `js/wiki-equipment-view-adapter.js`
- `tools/test_equipment_view_adapter.js`
- `docs/EQUIPMENT_STAGE_E3D1_REPORT.md`

最小修改：

- `js/wiki-equipment-data.js`
  - 新增 equipment-only load 與 diagnostics lazy load。
  - View 與既有 Shadow 共用同一 Repository 與 Equipment fetch。
- `wiki.html`
  - 新增 View Adapter script reference、Feature Flag、受控初始化、資料來源選擇、Deep Link 與 fallback 接線。
  - 既有 render functions 只加入 null-safe 顯示與 Dataset read model 支援。

## 3. Feature Flag 與 fallback

宣告：

```text
window.EQUIPMENT_DATA_VIEW_ENABLED = false
```

唯一啟用條件：

```text
wiki.html?equipmentData=1
```

其他值、空值與沒有 query 都不啟用。正常模式不 fetch `data/equipment/*.json`，Equipment UI 繼續使用 `EQUIP_DATA`。

Dataset 模式第一階段只 required fetch `equipments.json`。HTTP 404、JSON parse error、invalid envelope 或 duplicate ID 時，Adapter 不暴露半成品，UI 以完整 legacy 786 筆回退。Diagnostics 或 unresolved lazy load 失敗不會使已 ready 的 Dataset View 回退，也不會清除 canonical detail。

## 4. View Adapter mapping

Adapter 不修改 canonical Entity，只輸出 deep-copy read model：

| UI read field | Canonical source |
|---|---|
| `id` | `equipmentId` |
| `name` | `displayName` |
| `type` | `itemType` |
| `category` | 固定 `equipment` |
| `equipmentGroup` | `equipmentGroup` |
| `equipmentType` | `equipmentType` |
| `slot`／`slot_cn` | `slot` 與固定 label table |
| `rarity` | `rarity` |
| `price` | `price.amount` |
| `desc` | `description.canonicalText` |
| `stats` | `baseStats` 中 `explicit`／`explicit_zero` |
| `req` | `classRequirements.baseClasses` |
| `safe` | `safeEnhance.safeLevel`；明確不可強化投影為 legacy-compatible 0 |
| `relations`／`sources` | canonical `relations` 的 EntityRef 投影 |
| `entityRef` | canonical `entityRef` |

`unresolved` 不轉成 0、`all` 或空字串。277 筆缺 description、4 筆 safe unresolved、4 筆 class requirement unresolved 都顯示「資料尚未建立」。`explicit_zero` 與 `enhanceable=false` 是正式語意，不視為 unresolved。

## 5. Identity、分類與 Detail parity

- Equipment identity：786 / 786。
- Weapon：309。
- Armor：339。
- Accessory：138。
- displayName、group、type、slot 與已 resolved 的 22 個 base stat：無 blocking mismatch。
- 五筆 price source conflict 使用 Dataset source-precedence value，Detail 顯示「價格待確認」。
- Dataset `partial` 顯示「部分資料尚未建立」；`unresolved` 顯示「資料尚未建立」。
- legacy `EQUIP_DATA` 未被修改或移除。

## 6. Search migration decision

Dataset View 正式支援：

- 中文完整名稱與部分名稱。
- Equipment ID，大小寫不敏感。
- 中文 group／type／slot label。
- canonical description。

為避免 E3-D1 悄悄破壞既有玩家搜尋，View Adapter 暫時把同 ID legacy record 的 editorial／legacy source text 放入明確標記為 `compatibilityOnly.legacySearchText` 的搜尋投影。它不參與 identity、relation resolve、Detail canonical content 或正式資料回寫。E3-C 十個固定 fixture 均有結果；原有八個 expected search result-set differences 仍屬 non-blocking migration 差異。

## 7. Detail、Deep Link 與 Navigation

正式 Deep Link：

```text
wiki.html?equipmentData=1&tab=equip&equipment=<equipmentId>
```

支援：

- 直接開啟與 reload 還原 Detail。
- 開啟 Detail 時加入 URL state。
- 關閉 Detail 移除 `equipment` query。
- Back／Forward 還原 Detail 開關狀態。
- 不存在的 ID 顯示「找不到裝備」與原 Equipment ID，不猜測名稱或替代 Entity。

Monster relation 只以 canonical EntityRef 建立：

```text
?equipmentData=1&tab=monster&monster=<monsterId>
```

Relation HTML 不含 `onclick`。Craft relation 若沒有正式穩定 recipe navigation contract，只顯示 Entity ID，不虛構 URL。

## 8. Lazy load 與效能

Dataset View 初始只載入 `equipments.json`：11,067,281 bytes。`diagnostics.json` 與 `unresolved.json` 不在初始 View critical path，第一次開啟 Detail 才 lazy load；同一頁面只建立一個 diagnostics promise。

本機 Browser 樣本：

- Equipment-only ready 後卡片：786。
- 初次 786 張卡片 render：約 58 ms（單次樣本，不是跨裝置承諾）。
- Detail 前 `diagnosticsReady=false`；Detail 後 `diagnosticsReady=true`。
- `equipmentData=1&equipmentShadow=1`：View ready、Shadow ready、blocking mismatch 0；Repository 重用 Equipment core load，不重複 fetch `equipments.json`。

## 9. 自動化測試

新增 View Adapter tests：58 / 58 passed，覆蓋：

- initial equipment-only fetch、786 與 309／339／138。
- read model mapping、deep-copy isolation、canonical／legacy 不變。
- 中文名稱、ID、group、type、slot、description 與十個固定搜尋 fixture。
- null／explicit zero／不可強化語意。
- 五筆 price conflict。
- Monster／Craft relation navigation policy 與無 inline onclick。
- diagnostics lazy load、optional unresolved fallback、View／Shadow fetch reuse。
- equipment 404、parse error、invalid envelope、duplicate ID。
- Feature Flag、Deep Link、popstate 與 unresolved player text。

既有回歸：

- Equipment Repository：25 / 25 passed。
- Equipment Shadow Comparison：32 / 32 passed，blocking mismatch 0。
- Equipment Dataset：validator／Schema／byte-stability passed，tests 30 / 30。
- Equipment fixtures：validator／Schema passed，tests 25 / 25。
- Monster Dataset：validator／Schema passed，tests 7 / 7。
- Legacy Mapping：validator passed、blocking 0，tests 30 / 30。
- Craft validator：passed。
- WikiDataCore tests：passed。
- Monster UI RC：15 / 15。
- Monster UI Beta：21 / 21。
- 新增 JavaScript `node --check`：passed。
- `git diff --check`：passed。

## 10. Browser acceptance

本機靜態伺服器實測：

| 情境 | 結果 |
|---|---|
| 正常模式 `?tab=equip` | legacy、786 cards、未啟用 Dataset |
| Dataset `?equipmentData=1&tab=equip` | Dataset ready、786 cards、309／339／138 |
| 搜尋 `acc_116` | 1 筆「傳送控制戒指」 |
| Detail | 正常顯示 canonical fields；首次開啟 lazy load diagnostics |
| Deep Link／reload | `acc_116` Detail 正常還原 |
| 不存在 ID | 顯示「找不到裝備」，不猜測 |
| Back／Forward | 正常關閉／還原 Detail |
| View + Shadow | 兩者 ready；blocking mismatch 0 |
| 390 × 844 | 786 cards、Detail 正常、無水平溢位 |
| Console | Error 0 |
| 必要本機資源 | HTTP 200；正常模式無 Dataset request |

Required-load 404、parse error 與 invalid envelope 的完整 legacy fallback 由自動化注入測試驗證；沒有為測試改動或搬移 checked-in Dataset。

## 11. 既有 UI 資料來源是否改變

預設沒有改變。只有明確帶 `equipmentData=1` 時，既有 Equipment UI 的 `equipment` category 讀取 Adapter read models。Doll、SkillBook、Set、Craft、Monster、Cards、首頁與其他功能仍走原本來源與接線。

## 12. 下一步建議

建議進入 E3-D2 前先維持 Feature Flag 關閉，做小範圍 Release Candidate 驗證與 payload 策略評估。11.07 MB 的 initial Equipment JSON 是目前最大風險；應先規劃傳輸壓縮／分片或索引 payload，而不是直接預設啟用或移除 `EQUIP_DATA`。

另外應在後續階段定案 compatibility-only legacy search 的退場條件，以及 624 件 legacy source unresolved 的玩家呈現策略。不得用中文名稱補造 relation。

本階段沒有 commit、push、rebase 或 amend。
