# Equipment Stage E3-A：Schema 與 Dataset Foundation Fixtures 報告

## 1. 階段結論與範圍

本階段已建立 Equipment 第一版 Schema、固定 786 筆 Equipment identity 的 allowlist、分類 mapping、來源抽取 manifest fixture、unresolved／價格衝突／特殊案例 fixtures，以及 fixtures 專用 validator 與 tests。

本階段**沒有**建立正式 `data/equipment/equipments.json`、Dataset generator、Repository、WikiDataCore 接線或 UI；也沒有修改 HTML、CSS、JavaScript、Monster／Craft／Mapping Dataset。

## 2. 新增檔案

Schema：

- `schemas/equipment.schema.json`
- `schemas/equipment-source-fixture.schema.json`
- `schemas/equipment-classification-mapping.schema.json`
- `schemas/equipment-unresolved.schema.json`

固定 fixtures：

- `fixtures/equipment/equipment-allowlist.json`
- `fixtures/equipment/equipment-source-fixture.json`
- `fixtures/equipment/equipment-classification-mapping.json`
- `fixtures/equipment/equipment-unresolved.example.json`
- `fixtures/equipment/equipment-price-conflicts.json`
- `fixtures/equipment/equipment-special-cases.json`

驗證與報告：

- `tools/validate_equipment_fixtures.py`
- `tools/test_equipment_fixtures.py`
- `docs/EQUIPMENT_STAGE_E3A_REPORT.md`

## 3. Equipment Schema

`equipment.schema.json` 使用 JSON Schema Draft 2020-12、穩定 HTTPS `$id` 與 `schemaVersion = 1.0.0`。單筆 Equipment record 嚴格限制為 E2 契約核准的 20 個 top-level 欄位，並設定 `additionalProperties = false`。

Schema 固定以下邊界：

- `itemType` 只接受 `wpn`、`arm`、`acc`。
- `equipmentGroup` 只接受 `weapon`、`armor`、`accessory`。
- `equipmentType`、`slot`、八個 class key 與 `status` 使用核准 vocabulary。
- `baseStats` 只接受 22 個核准 stat path；公式參數、proc、cooldown、玩家裝備實例欄位不得混入。
- stat value 明確區分 `explicit`、`explicit_zero`、`derived_zero`、`not_applicable`、`unresolved`。
- `safeEnhance` 不把 `noEnhance`、`safe = 0` 與缺少 `safe` 視為同一狀態。
- `classRequirements` 不把 `req = all` 與缺少 `req` 視為同一狀態。
- 不包含未驗證的 `weight`，也不包含 `PlayerItemInstance` 欄位。
- `entityRef.entityType` 固定為 `equipment`；`entityId == equipmentId` 的動態同值規則留給 E3-B Dataset validator 強制執行。

本 Schema 只驗證單筆 Equipment record，不宣稱本階段已有正式 Dataset。

## 4. 786 allowlist

Allowlist 固定為 `wiki.html#EQUIP_DATA(category = equipment)` 與 `js/00-data.js#DB.items` 的 exact ID intersection，共 **786 筆**：

| Group | 數量 |
|---|---:|
| Weapon | 309 |
| Armor | 339 |
| Accessory | 138 |
| 合計 | 786 |

已明確排除：

- SkillBook：175
- Doll：50
- 席琳遺骸／set records：8

每筆固定 `equipmentId`、raw `sourceItemType`、預期 group／type／slot、相對 source location 與 status。驗證器要求 ID 唯一、數量不能成為 787、不能出現 `DB.items` 不存在的 target，且必須與目前 786 筆 Wiki Equipment identity 完全一致。

## 5. Classification mapping

分類 mapping 共 **786 筆**，每個 Equipment ID 恰有一個 resolved `equipmentGroup`／`equipmentType`／`slot` outcome；目前 **unresolved classification = 0**。

| Mapping method | 數量 | 用途 |
|---|---:|---|
| `raw_type_and_slot` | 477 | 非武器的 raw type／slot 可直接支持核准結果 |
| `legacy_subtype_mapping` | 309 | 武器 legacy subtype 加 canonical raw flags，逐 ID 固定核准結果 |
| `weapon_tags_id_mapping` | 0 | Vocabulary 已保留；本 baseline 不需以它作唯一 resolver |
| `explicit_id_mapping` | 0 | Vocabulary 已保留；本 baseline 沒有只靠人工 ID 例外才能解析的項目 |

規則禁止 display name regex 與中文名稱外鍵。Legacy subtype 只作輸入 evidence；正式 outcome 只使用核准 vocabulary。每筆保留 reason 與 source locations，衝突不得輸出兩個 resolved outcome。

## 6. 特殊案例 fixture

`equipment-special-cases.json` 固定 **21 個 case**：arrow、pet weapon、pet armor、armguard、雙手武器、offhand shield、ring、earring、bow、crossbow、claw、dual blade、chain sword、kiringku、`noEnhance`、`safe = 0`、缺少 `safe`、`req = all`、缺少 `req`、explicit slot、derived slot。

每個 case 都使用現有 Equipment ID，保存預期 classification、safe semantics、class semantics 與相對 evidence location；沒有虛構 ID 或資料值。

## 7. Price conflict fixture

已固定 Audit 確認的 **5 筆**價格衝突：

- `relic_strong_femur`
- `relic_mandra_spirit`
- `relic_scorpion_sting`
- `relic_ska_soul`
- `relic_shadow_stinger`

每筆保存 `DB.items.p` 與 Wiki projection 的原值、兩側 source locations、`authoritativeCandidate = DB.items.p`、`status = review_required` 與 `equipment_price_conflict` diagnostic。Fixture 不會默默改寫任一來源，也不會把 authoritative candidate 誤寫成「已人工確認的最終真值」。

## 8. Source extraction fixture

來源 fixture 固定以下六個來源：

| Source | Role | Extraction | Runtime mutation |
|---|---|---|---:|
| `js/00-data.js#DB.items` | canonical base | restricted object literal | 否 |
| `js/00-data.js#DB.sets` | deterministic enrichment | restricted object literal | 是 |
| `js/10-ui-tabs.js#WEAPON_TAGS` | deterministic enrichment | restricted constant literal | 是 |
| `wiki.html#EQUIP_DATA` | migration projection | restricted constant literal | 否 |
| `data/monster/drop_tables.json` | relation owner | JSON parse | 否 |
| `data/craft/recipes.json` | relation owner | JSON parse | 否 |

Fixture 記錄 source role、抽取方法、required、source revision、game version、owned fields、mutation policy 與 purity。Wiki 的 current working tree revision 無法由已提交內容唯一代表，因此保留 `sourceRevision = null`；沒有自行虛構 revision。

所有核准 extraction 都不得依賴 DOM、player state、localStorage、UI loop 或隨機狀態。跨 Domain Dataset 只作 relation owner，不能覆蓋 Equipment canonical 欄位。

## 9. Unresolved 狀態

`equipment-unresolved.example.json` 是 **9 筆代表性 baseline examples**，不是 786 筆正式 Dataset diagnostics。它覆蓋缺少 class requirement、缺少 safe、缺少 description、runtime mutation、price conflict、source precedence conflict、name／HTML relation、proc mechanic 與未驗證 weight。

目前可量化的 786 baseline 缺口：

- 缺少 `safe` 且沒有 `noEnhance` 可決定語意：4 筆。
- 缺少 `req`：4 筆。
- 缺少 canonical description：277 筆。
- 已知 price conflict：5 筆。
- classification unresolved：0 筆。

Relation／Mechanic／Interaction 的完整 unresolved 數量尚未由正式 generator 產生，本階段不得把 9 筆 examples 當成完整診斷總數。所有 unresolved records 不含猜測 target；`missing`、`not_applicable`、`explicit_zero`、`derived_zero`、`unresolved`、`conflict`、`unverified_claim` 分開保存。

## 10. Validator 與 tests

`validate_equipment_fixtures.py` 已驗證：

- 四份 Schema 與 Schema probe。
- 20-field ceiling 與 `additionalProperties = false`。
- allowlist 786、ID 唯一、scope 排除、DB target 與 Wiki identity parity。
- group／type／slot vocabulary 與 classification 一對一覆蓋。
- 21 個特殊案例及 safe／class 缺值語意。
- 五筆價格衝突的 ID、兩側原值、狀態與 diagnostic。
- source extraction 不使用 DOM、player state、localStorage 或本機絕對路徑。
- unresolved 不含虛構 target。
- 六份 fixtures 為 canonical JSON、UTF-8、LF、單一結尾 newline。
- 四份 Schema 與六份 fixtures 都產生可重現 SHA-256。

`test_equipment_fixtures.py` 共 **25／25 passed**，涵蓋需求列出的 valid baseline、數量、duplicate、三類 scope 排除、missing target、三種 vocabulary、classification 唯一性、禁止 name regex、價格 fixture、zero／missing／not-applicable、class semantics、DOM／player state、路徑安全、key reorder、SHA-256、UTF-8／LF、特殊案例、unresolved fake target 與 20-field ceiling。

Validator 結果：Schema passed、validator passed、byte-stable passed。

## 11. 既有功能回歸

本階段未修改網站程式；仍執行既有自動測試確認沒有資料流程回歸：

- Equipment fixtures：25／25 passed。
- Monster validator：passed；Monster tests：7／7 passed。
- Legacy Mapping validator：passed；tests：30／30 passed。
- Craft validator：passed。
- WikiDataCore tests：passed。
- Monster UI RC：15／15 passed，並包含既有 Beta 21／21 passed。

因沒有修改 HTML、CSS、JavaScript 或 UI，本階段不新增瀏覽器互動驗收範圍。

## 12. E3-B 進入條件與必要不變量

E3-A 的 foundation 已滿足 E2 列出的 E3-B 前置條件，**建議可以進入 E3-B Generator／Dataset／Dataset Validator**，但 E3-B 必須維持以下不變量：

1. Generator 只讀 source fixture 核准的來源與純抽取路徑，不執行完整遊戲、DOM、UI、player state 或 localStorage。
2. Dataset identity 必須與 allowlist exact 786 一致；不得加入 SkillBook、Doll、remains 或第 787 筆資料。
3. 每個 ID 只能套用一個 classification outcome；不得用中文名稱或 display-name regex 推導正式 key。
4. `DB.items` 是 canonical base candidate；Wiki 只作 migration／parity evidence，不能覆蓋 numeric canonical 欄位。
5. 缺值不得自動轉為 0、false、空集合或 all；`noEnhance`、`safe = 0`、缺 `safe`、`req = all`、缺 `req` 必須保持不同語意。
6. 五筆 price conflict 必須保留 review diagnostic，不得因 precedence 靜默消失。
7. 每個輸出欄位都要有可序列化 provenance；無法驗證的 relation、mechanic、weight 或版本資料保持 null／unresolved。
8. Monster Drop 與 Craft Recipe 只提供 relation summary；Equipment generator 不得反向改寫 owner Dataset。
9. 正式 Dataset 必須排序固定、canonical UTF-8／LF／單一 newline；兩次生成 byte-identical，並與 checked-in candidate byte-identical。
10. E3-B Dataset validator 必須額外強制 `entityRef.entityId == equipmentId`、跨 EntityRef、完整 diagnostics、version/provenance 與 checked-in output parity。

E3-B 仍不得順帶開始 Repository、WikiDataCore、Search、Feature Flag 或 Equipment UI。
