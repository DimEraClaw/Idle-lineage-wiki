# Equipment Stage E3-B：Deterministic Generator、正式 Dataset 與 Validator 報告

## 1. 階段結論

Equipment E3-B 已建立 deterministic generator、786 筆正式 Equipment Dataset、完整 diagnostics／unresolved outputs、Dataset validator 與 30 項自動測試。

本階段沒有建立 Repository、Search、Feature Flag 或 UI；沒有修改 WikiDataCore、HTML、CSS、JavaScript、Monster／Craft／Mapping Dataset 或 E3-A fixtures。

## 2. 新增檔案

- tools/generate_equipment_data.py
- tools/validate_equipment_data.py
- tools/test_equipment_data.py
- data/equipment/equipments.json
- data/equipment/diagnostics.json
- data/equipment/unresolved.json
- docs/EQUIPMENT_STAGE_E3B_REPORT.md

沒有新增非必要 manifest；版本資料直接來自 E3-A source fixture。

## 3. Generator CLI 與來源邊界

預設執行：python tools/generate_equipment_data.py

可指定來源與輸出：python tools/generate_equipment_data.py --source-root PROJECT_ROOT --output-dir OUTPUT_DIR

Generator 只讀：

- js/00-data.js#DB.items
- js/00-data.js#DB.sets
- js/10-ui-tabs.js#WEAPON_TAGS
- wiki.html#EQUIP_DATA
- data/monster/drop_tables.json
- data/craft/recipes.json
- fixtures/equipment/*

JavaScript source 只以 balanced literal extraction 在隔離 VM 中解析指定 object／constant；不執行遊戲檔、DOM、UI 初始化、player state、localStorage、存檔、網路或隨機流程。Generator 不修改任何來源。

Identity、group／type／slot 完全由 E3-A allowlist 與 ID-based classification fixture 固定；沒有使用中文名稱 regex。WEAPON_TAGS 是已核准的來源輸入，但本 baseline 的正式 classification outcome 已由 fixture 完整解析，不重新執行 UI 分類邏輯。

來源版本：

- Game version：v3.2.79
- Canonical DB.items source revision：3129429f6534a56d891dd846f0a2ae79c014f51e
- Dataset schema version：1.0.0

## 4. Equipment 統計

正式 equipments.json 恰好 786 筆，與 E3-A allowlist exact parity：

| Group | 數量 |
|---|---:|
| Weapon | 309 |
| Armor | 339 |
| Accessory | 138 |

排除 SkillBook 175、Doll 50、remains／set records 8、PlayerItemInstance 與 runtime item instance，沒有第 787 筆。

### 4.1 Equipment type

| Group | Type 統計 |
|---|---|
| Weapon | one_hand_sword 71、two_hand_sword 25、dagger 17、blunt 20、two_hand_blunt 18、spear 8、two_hand_spear 18、bow 20、crossbow 12、staff 31、claw 21、dual_blade 19、chain_sword 11、kiringku 11、other_weapon 7 |
| Armor | armor 86、helmet 57、cloak 43、gloves 38、boots 36、tshirt 10、greaves 12、shield 57 |
| Accessory | necklace 31、earring 39、belt 28、ring 40 |

### 4.2 Slot

| Slot | 數量 |
|---|---:|
| weapon | 303 |
| arrow | 6 |
| armor | 80 |
| helmet | 57 |
| cloak | 43 |
| gloves | 38 |
| boots | 36 |
| tshirt | 10 |
| greaves | 12 |
| shield | 57 |
| necklace | 31 |
| earring | 39 |
| belt | 28 |
| ring | 36 |
| pet_weapon | 4 |
| pet_armor | 6 |

每筆均符合 equipment.schema.json 的 20 個 top-level 欄位，entityRef.entityId 精確等於 equipmentId。

## 5. 欄位生成結果

### 5.1 Safe semantics

| 狀態 | 數量 |
|---|---:|
| noEnhance，不可強化 | 270 |
| explicit safe = 0，可強化 | 132 |
| explicit positive safe | 380 |
| 缺少 safe 且無 noEnhance | 4 |

缺少 safe 的四筆保持 enhanceable = null、safeLevel = null 與 unresolved；沒有轉成 0 或 false。maxEn 只在來源明示時輸出，沒有執行 runtime cap。

### 5.2 Class requirements

| 狀態 | 數量 |
|---|---:|
| req = all | 353 |
| explicit class subset | 429 |
| missing req | 4 |

req = all 展開為固定排序的八個 class key；missing req 保持 baseClasses = null，不當成 all。

### 5.3 Description

- Canonical description present：509
- Missing canonical description：277
- editorialNote：第一版全部為 null
- Wiki HTML／onclick 搬入 canonical description：0

### 5.4 baseStats

每筆固定包含契約核准的 22 個 stat path。來源明示數值標為 explicit／explicit_zero；非武器的 dmgS／dmgL 標為 not_applicable；其餘缺值保持 unresolved。沒有放入 proc、cooldown、PerEn、pet／summon、mode-dependent 或 PlayerItemInstance value。

## 6. Relations

所有正式關聯由 owner Dataset 依 ID 反向建立，沒有解析 Wiki onclick：

| Relation | Occurrence | 涵蓋 Equipment |
|---|---:|---:|
| Monster Drop | 1,533 | 572 |
| Craft result | 220 | 213 |
| Craft requirement | 103 | 74 |
| 合計 | 1,856 | — |

Monster relation 保留每個 DropEntry，使用 DropEntryRef → MonsterRef；同一 Equipment 的多筆掉落全部保留。Craft result／requirement 分開建立，target 使用正式 Recipe EntityRef。沒有複製 Monster、DropEntry 或 Recipe 主資料。

DB.sets 解析出 50 個 Equipment membership candidate；因 set_0～set_13 尚未核准為正式 EquipmentSet Entity ID，setRefs 保持空陣列並產生 unresolved set identity diagnostic。Generator 沒有執行 initSetTags()、沒有保存 mutated .set，也沒有把套裝效果塞進 description。

## 7. Diagnostics 與 unresolved

diagnostics.json 共 2,220 筆；unresolved.json 是其中 status = unresolved 的完整 deterministic subset，共 2,210 筆。

| Diagnostic code | 數量 |
|---|---:|
| equipment_class_requirement_unresolved | 4 |
| equipment_description_missing | 277 |
| equipment_mechanic_unresolved | 465 |
| equipment_price_conflict | 5 |
| equipment_relation_unresolved | 624 |
| equipment_safe_enhance_unresolved | 4 |
| equipment_set_identity_unresolved | 50 |
| equipment_source_precedence_conflict | 5 |
| equipment_weight_unverified | 786 |
| unresolved version | 0 |

equipment_relation_unresolved 表示 legacy Wiki source claims 含 HTML／名稱 target，尚未有對應 owner Dataset 可正式匯入；已由 Monster／Craft owner resolve 的關聯仍另外完整保留。

Mechanic diagnostic 由已盤點的 raw code signal fields 產生，但不虛構 Mechanic ID。Weight 只保存 legacy claim candidate，不進 Equipment Schema。所有 unresolved 不含假 target。

Dataset status 聚合結果：

| Status | 數量 |
|---|---:|
| partial | 777 |
| review_required | 5 |
| unresolved | 4 |
| complete | 0 |

## 8. 五筆 Price conflict

以下五筆 Dataset 均使用 DB.items.p = 10000 authoritative candidate：

- relic_strong_femur
- relic_mandra_spirit
- relic_scorpion_sting
- relic_ska_soul
- relic_shadow_stinger

每筆同時保留一個 equipment_price_conflict 與一個 equipment_source_precedence_conflict；兩側原值、source locations 與 review_required 均保留。來源優先序沒有讓 conflict 消失。

## 9. Validator

預設執行：python tools/validate_equipment_data.py

略過兩次生成檢查：python tools/validate_equipment_data.py --skip-deterministic

Validator 已檢查：

- JSON Schema、20-field ceiling 與 22 個 baseStats。
- 786 scope、ID 唯一、allowlist exact parity、三類排除。
- entityRef、自反 identity、group／type／slot／class vocabulary 與 classification fixture parity。
- canonical name／itemType、safe、req、description、price 與 provenance。
- 五筆 price conflict／precedence diagnostic。
- Monster DropEntry owner 與 Craft Recipe owner 的完整反向關聯 parity。
- unresolved subset 與 fake target。
- records／arrays／diagnostic summaries 排序。
- canonical UTF-8、LF、單一結尾 newline。
- 本機路徑、file URI、localhost 與 loopback 洩漏。
- 兩次生成 byte parity 與 checked-in output parity。

結果：Schema passed、Validator passed。

## 10. Tests 與回歸

Equipment Dataset tests：30／30 passed，完整涵蓋需求指定的 30 個案例。

其他回歸：

- Equipment fixture tests：25／25 passed。
- Monster validator：passed；Monster tests：7／7 passed。
- Legacy Mapping validator：passed；Mapping tests：30／30 passed。
- Craft validator：passed。
- WikiDataCore tests：passed。
- Monster UI RC：15／15 passed。
- Monster UI Beta：21／21 passed。

本階段沒有網站程式變更，因此沒有新增 UI、Button、Console 或 Network 行為需要瀏覽器驗收。

## 11. Deterministic、byte stability 與 SHA-256

三份正式 JSON 均為 canonical UTF-8、LF、固定 key order、固定 records／arrays order、單一結尾 newline，且不含 timestamp 或本機路徑。

相同輸入重跑兩次 byte-identical；輸入 fixture arrays 反序後輸出仍 byte-identical；checked-in JSON 與重新生成結果 byte-identical。

| File | SHA-256 |
|---|---|
| equipments.json | c1866e5bb912b9d48f17862e410ea625b4069cff713446f422fad5da280c873e |
| diagnostics.json | a599afd5f7f75f313af02cfc5d05f83de8a695f9c38f2deeee6b58d15f678d59 |
| unresolved.json | 6e910f9a5e87a3d754528e04104b6de57c24ed7d4dab6a2cb9ed39ae456f3b03 |

## 12. Git diff 與網站影響

E3-B 只新增三個 Python pipeline files、三份正式 Equipment JSON 與本報告。沒有修改 E3-A commit 內容或工作區中既有的其他未提交變更。

未修改：

- wiki.html、任何 HTML／CSS／JavaScript。
- Equipment UI、Monster UI、Craft UI。
- WikiDataCore、Repository、Search、Feature Flag。
- Monster、Craft、Mapping Dataset。

本階段未 commit、未 push。

## 13. E3-C 建議與阻擋

E3-B gate 已通過：786 identity、Schema、Validator、30 tests、deterministic、byte stability 與 checked-in parity 全部成立，可以進入 E3-C：Equipment Repository 與 shadow comparison。

E3-C 仍需注意：

1. Repository 只能讀 data/equipment/，不得回讀 Wiki 或遊戲 source。
2. 正式 Dataset 約 11 MB；shadow comparison 應量測載入與索引成本，但不得在 E3-C 順帶切換 UI。
3. 277 筆 description、4 筆 safe、4 筆 req 仍 unresolved。
4. 465 筆 mechanic candidates 尚無正式 Mechanic Entity。
5. 50 筆 legacy set memberships 尚無核准 EquipmentSet identity。
6. 624 筆 legacy source claims 仍等待 Quest／NPC／Shop／其他 owner Dataset。
7. 786 筆 weight claims 仍未驗證，不得加入正式 Equipment record。
8. E3-C shadow mismatch 必須定位到 ID／field／source，不得以中文名稱模糊修復。
9. E3-C 未達 identity、classification、search 與 relation parity 前，不得進入 E3-D UI 切換。
