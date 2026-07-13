# Equipment Stage E2：最小資料契約

## 1. 契約定位與固定範圍

本契約只定義第一版 Equipment Dataset 的責任邊界，不是 Schema 或實作規格。第一版固定收錄 **786 筆** `wiki.html#EQUIP_DATA` 中 `category = equipment`、且可用相同 ID 對回 `js/00-data.js#DB.items` 的裝備。

不收錄 175 本 SkillBook、50 個 Doll、8 筆席琳遺骸／set records、PlayerItemInstance、強化後數值、Analytics 或 Build Planner。不得為湊齊 1,019 筆而把其他 specialization 塞入 Equipment。

## 2. Entity ownership

| Entity／資料 | Owner | Equipment Dataset 的責任 |
|---|---|---|
| Item | Item Domain | 擁有可持有物品的共用 identity、名稱與共通 economy metadata；Equipment 與同 ID Item 一對一 specialization |
| Equipment | Equipment Domain | 擁有可穿戴裝備的 canonical base definition、分類、base stats 與 refs |
| SkillBook | Item／SkillBook specialization | 透過 SkillRef 指向 Skill；不進本 Dataset |
| Doll | Doll specialization | 獨立 Domain；raw `type=acc` 不構成飾品 identity |
| EquipmentSet | EquipmentSet owner | 擁有 set identity、成員、門檻與套裝效果；Equipment 只保留 `setRefs` summary |
| PlayerItemInstance | Save／Player State | 擁有 `en`、`bless`、`anc`、`attr`、`seteff`、uid、lock 等實例狀態；完全不進 base Equipment |
| Mechanic／Formula | Knowledge Domain／Mechanics Layer | 擁有強化、proc、免疫、狀態、觸發、套裝門檻與公式；Equipment 只引用 `mechanicRefs` |
| Interaction | Interaction Domain | 擁有裝備間或裝備與 Skill 的相容、疊加、覆蓋、互斥結論；Equipment 不保存結論副本 |

## 3. Equipment Entity：20 個 top-level 欄位

概念形狀如下；這不是 JSON Dataset：

```json
{
  "equipmentId": "wpn_example",
  "displayName": "顯示名稱",
  "itemType": "wpn",
  "equipmentGroup": "weapon",
  "equipmentType": "one_hand_sword",
  "slot": "weapon",
  "classRequirements": {},
  "rarity": "common",
  "baseStats": {},
  "safeEnhance": {},
  "price": {},
  "description": {},
  "skillRefs": [],
  "setRefs": [],
  "mechanicRefs": [],
  "relations": [],
  "verification": {},
  "version": {},
  "status": "partial",
  "entityRef": { "entityType": "equipment", "entityId": "wpn_example" }
}
```

### 3.1 逐欄契約

| 欄位 | 類型 | 必填 | Owner／分類 | Authoritative source | Fallback | null | Field provenance／unresolved |
|---|---|---:|---|---|---|---:|---|
| `equipmentId` | string | 是 | Equipment／canonical identity | `DB.items` key | 無 | 否 | 不可 unresolved；不以名稱生成 |
| `displayName` | string | 是 | Item／canonical label projection | `DB.items.n` | Wiki `name` 只可比對 | 否 | 衝突即 blocking diagnostic，不自動採 Wiki |
| `itemType` | `wpn\|arm\|acc` | 是 | Item／canonical raw vocabulary | `DB.items.type` | 無 | 否 | 其他 raw type 不進第一版 |
| `equipmentGroup` | enum | 是 | Equipment／derived | `itemType`＋核准 mapping | Wiki projection 作 parity evidence | 否 | `weapon\|armor\|accessory`；不確定即 unresolved |
| `equipmentType` | enum/null | 是 | Equipment／derived | 核准 classification mapping | `WEAPON_TAGS`／Wiki 作候選 evidence | 是 | 不能用中文名稱 regex 猜測；null 需 diagnostic |
| `slot` | enum/null | 是 | Equipment／canonical or derived | 明示 `DB.items.slot`；武器使用核准 mapping | Wiki `slot` 作 parity evidence | 是 | 缺值不可直接採 UI default；例外逐 ID mapping |
| `classRequirements` | object | 是 | Equipment＋Mechanic／mixed | `DB.items.req`＋核准 rule refs | 無 | 否 | 內部值可 null；缺 `req` 不等於全職業 |
| `rarity` | enum/null | 是 | Item／derived metadata | `legend`、`relic` 等明示 flags | Wiki `rarity` 作 parity evidence | 是 | mapping 未定或 flags 衝突即 unresolved |
| `baseStats` | object | 是 | Equipment／canonical base scalar projection | `DB.items` whitelist fields | Wiki `stats` 只作 parity | 否 | 每個 stat path 都需 provenance；未知用 null，不概括成 0 |
| `safeEnhance` | object | 是 | Equipment＋Mechanic／mixed | `safe`、`noEnhance`、`maxEn` 與核准 cap rule | Wiki 只作 conflict evidence | 否 | 缺 `safe` 為 null／unresolved；規則見第 5 節 |
| `price` | object | 是 | Item／economy metadata projection | `DB.items.p` | Wiki 只作 migration evidence | 否 | 5 筆衝突必須 diagnostic；不靜默覆蓋 |
| `description` | object | 是 | Item＋Editorial／mixed | `DB.items.d` | 經核准 Wiki editorial 純文字 | 否 | 內部文字可 null；缺文字不是空字串事實 |
| `skillRefs` | EntityRef[] | 是 | Skill owner／relation summary | 已驗證 Skill／code relation | 無 | 否 | 未有正式 target 不造 ref，另列 unresolved relation |
| `setRefs` | EntityRef[] | 是 | EquipmentSet owner／relation summary | `DB.sets`＋純資料 `initSetTags` 等價轉換 | Wiki set prose 不作 fallback | 否 | 未建正式 Set ID 時為空 summary＋diagnostic |
| `mechanicRefs` | EntityRef[] | 是 | Mechanics owner／relation summary | 核准 Mechanic records | code evidence 只形成候選 | 否 | 缺 Mechanic 不表示沒有機制 |
| `relations` | RelationRef[] | 是 | 各 relation owner／summary | owner Dataset | Wiki `sources` 只作 migration evidence | 否 | target 未解不得造 EntityRef |
| `verification` | object | 是 | Research／metadata | field provenance 聚合 | 無 | 否 | Entity status 不得掩蓋 field conflict |
| `version` | object | 是 | Release／metadata | source revision、game version、schema version | unknown 為 null | 否 | 未知範圍不等於全版本 |
| `status` | enum | 是 | Dataset／metadata | diagnostics 聚合 | 無 | 否 | `complete\|partial\|unresolved\|review_required`；E3 baseline 不得預設 complete |
| `entityRef` | EntityRef | 是 | Equipment／derived identity | equipmentId | 無 | 否 | 必須精確回指同一 ID |

陣列只有在契約明確證明「已知沒有關聯」或「summary 由 owner Dataset 重建後為空」時才可用空陣列；尚未盤點不等於無關聯，必須由 `status`、verification 與 diagnostics 表達。

## 4. 受控 vocabulary

### 4.1 Class

固定 Class key：`royal`、`knight`、`elf`、`mage`、`dark`、`dragon`、`illusion`、`warrior`。

`classRequirements` 形狀：

```text
baseClasses: ClassKey[] | null
ruleRefs: EntityRef[]
status: resolved | partial | unresolved
```

- `req` 明列逗號清單：只接受上述 key，去除空白後依固定 vocabulary 排序。
- `req: "all"`：明確展開八個 Class；這是來源明示，不是 missing default。
- 缺 `req`：`baseClasses = null` 並產生 `equipment_class_requirement_unresolved`。
- `darkEquipOk`、`illusionEquipOk`、`dragonEquipOk`、`warriorEquipOk`、`royalEquipOk`、`loadUpAllows`、Mastery、雙持與副手例外是 Rule／Mechanic；不得偷偷改寫 `baseClasses`。
- `w2h`、bow、shield、armguard、offhand、等級開槽等限制屬 slot／equip Mechanic；第一版可保存 base requirement 加 unresolved ruleRefs。

### 4.2 Group、type 與 slot

`equipmentGroup`：`weapon`、`armor`、`accessory`。

正式 `equipmentType` vocabulary：

- Weapon：`one_hand_sword`、`two_hand_sword`、`dagger`、`blunt`、`two_hand_blunt`、`spear`、`two_hand_spear`、`bow`、`crossbow`、`staff`、`claw`、`dual_blade`、`chain_sword`、`kiringku`、`other_weapon`。
- Armor：`armor`、`helmet`、`cloak`、`gloves`、`boots`、`tshirt`、`greaves`、`shield`。
- Accessory：`necklace`、`earring`、`belt`、`ring`。

正式 `slot` vocabulary：`weapon`、`arrow`、`armor`、`helmet`、`cloak`、`gloves`、`boots`、`tshirt`、`greaves`、`shield`、`necklace`、`earring`、`belt`、`ring`、`pet_weapon`、`pet_armor`。

- raw `type` 保留在 `itemType`，不能取代細分類。
- legacy `subtype` 只作 source key／migration mapping，不輸出為正式欄位。
- `WEAPON_TAGS` 只作 deterministic mapping input；映射結果與例外必須進版本控制 fixture。
- 中文 tag／label 只能作 evidence，不作輸出 ID。
- 名稱 regex 在遊戲 UI 可用，不得在 Generator 中自動分類；需改為明示例外 mapping，否則 unresolved。
- `offwpn`、`ring1..4`、`ear1..2` 是 PlayerItemInstance 的實際裝備位置，不是 base slot。
- arrow、pet equipment 與 armguard 等特殊項目須在 E3-A fixture 明列，不得被 `other_weapon` 或 `shield` 靜默吞掉語意。

## 5. safeEnhance

```text
enhanceable: boolean | null
safeLevel: integer | null
maxLevel: integer | null
ruleRefs: EntityRef[]
status: resolved | partial | unresolved
```

規則：

1. `noEnhance: true` → `enhanceable=false`、`safeLevel=null`、`maxLevel=null`；null 在此表示不適用，不是未知，provenance 必須標明。
2. `noEnhance` 未明示且類型進入強化系統時，才可由可定位 code rule推導 `enhanceable=true`；否則為 null。
3. `safe` 明示數值才進 `safeLevel`；`safe: 0` 表示可強化但沒有安全階段，不等於不可強化。
4. 缺 `safe` 不得套用 `d.safe || 0` 的 UI／runtime convenience default；輸出 null 並 unresolved。
5. `maxEn` 是個別上限；缺 `maxEn` 時可由版本化 `ENHANCE_CAP` RuleRef 推導 `maxLevel`，必須標 `derived`。
6. 最大強化限制與安全值分離；PlayerItemInstance.en 永不進此欄。
7. Wiki 補出的 0 只形成 migration evidence，不能覆蓋缺失的 base source。

## 6. baseStats 邊界

`baseStats` 固定只接受下列 22 個 path。每個值以 `value: number|null`、`unit`、`conceptRef: EntityRef|null` 表達；Concept 尚未建 ID 時不得虛構，使用 null 與 provenance unresolved reason。

| 欄位 | static base scalar | 單位 | 缺 source 規則 |
|---|---:|---|---|
| `dmgS`、`dmgL` | 是，武器 base dice/size damage input | game damage point | 非武器為不適用 null；武器缺值 unresolved |
| `hit`、`dmgBonus` | 是 | game point | code 明確以 0 作 additive identity 時可輸出 derived 0，須記 default provenance |
| `ac` | 是，保留 raw 正值語意 | raw AC point | code 明確 default-zero 才可 derived 0 |
| `mr`、`er`、`dr` | 是 | game point；ER 精確玩家單位待 Concept 驗證 | 缺值只在已證明 additive identity 時為 derived 0，否則 null |
| `mhp`、`mmp` | 是 | HP／MP point | 同上 |
| `extraMp` | 是，固定「額外魔法點數」 | magic point | 不得誤寫成最大 MP；缺值依 code additive default |
| `mdmg` | 是，固定魔法傷害 | magic damage point | 缺值依 code additive default |
| `str`、`dex`、`con`、`int`、`wis`、`cha` | 是 | attribute point | 缺值依 code additive default |
| `resFire`、`resWater`、`resWind`、`resEarth` | 是 | resistance percentage point | 缺值依 code additive default |

Source missing、explicit zero、derived additive identity zero、not applicable 與 unresolved 必須由 field provenance 區分；semantic diff 不可把它們視為同一來源狀態。

不得進 `baseStats`：`*PerEn`、`*From*`、`lv*Div`、proc、cooldown、pet／summon modifiers、mode-dependent value、PlayerItemInstance value。靜態 scalar 描述 base definition；公式參數進 Formula；觸發、免疫、條件與套用順序進 Mechanic；兩 Entity 的疊加／覆蓋進 Interaction。

## 7. price、weight 與 description

### 7.1 price

`price` 是 **Item owner 的 canonical economy metadata**，Equipment 第一版只保存版本化 projection：

```text
amount: number | null
currencyRef: EntityRef | null
priceType: base_item_price
```

`DB.items.p` 是目前 authoritative candidate。Audit 的 5 筆 Wiki 衝突產生 `equipment_price_conflict`，保留兩側 Evidence；不得用 Wiki 的 0／1 覆蓋 10,000。Currency Entity 尚未正式建立時不得虛構 ref，可用 null＋unresolved metadata；數值仍可保存。

### 7.2 weight

第一版 **不收錄 weight**，因此不增加第 21 個欄位。現有 Wiki number 與 `ITEM_WEIGHTS` 名稱式表只能形成 `equipment_weight_unverified` research claim；名稱式表不能證明 canonical owner。未來確認 Item owner、ID mapping、單位及版本後再加 Schema 版本。

### 7.3 description

```text
canonicalText: string | null
editorialNote: string | null
```

- `canonicalText` 優先來自 `DB.items.d`，保留 code-authored game description 身分，不冒充 Official。
- `editorialNote` 只接受核准純文字；不能改寫 canonical numeric/mechanic claim。
- 技能書動態 HTML 不在 Equipment scope。
- onclick、drop/craft/quest 文字、推導特效摘要與程式研究結論不得混入 canonicalText。
- 程式解析結論進 Evidence／Mechanic／Research；關聯進 Relations。
- E2 只定義邊界，HTML 清理與 migration 在 E3-A fixture 實作。

## 8. Relations 與 Interaction

第一版可引用 Monster Drop、Recipe、Quest、NPC、Skill、EquipmentSet、Release、Mechanic、Interaction、Research。全部使用 EntityRef／RelationRef；Equipment 不複製 target 主資料。

- Drop owner 由 `data/monster/drop_tables.json` 提供 ItemRef，Equipment 只建立可重建的反向 summary。
- Craft owner 由 `data/craft/recipes.json` 的 result／requirement ID 提供反向 relation。
- Quest／NPC／Skill／Set 尚無正式 target ID 時保留 unresolved relation diagnostic。
- `wiki.html#EQUIP_DATA.sources` 是 migration evidence，不是 relation owner。
- Equipment Interaction 必須引用 `docs/EQUIPMENT_INTERACTION_CONTRACT.md` 的 Interaction Entity；缺 Interaction 不代表 compatible、independent 或 stacks。

## 9. Verification、field provenance 與 diagnostics

`verification.fields` 以 JSON path 為 key，每筆至少能表達：

```text
sourceFile
symbolPath
sourceRevision
gameVersion
extractionMethod
classification: canonical | derived | editorial | relation_summary
evidenceRefs
conflict
unresolvedReason
```

Entity-level verification 只聚合 `Official`、`Code`、`Generated`、`Community`、`Research`、`Test`、`Unknown`，不能覆蓋欄位 Evidence。Generated 只證明轉換可重現，不證明來源語意正確。

診斷 vocabulary：

```text
equipment_field_unresolved
equipment_runtime_mutation_unresolved
equipment_type_unresolved
equipment_slot_unresolved
equipment_class_requirement_unresolved
equipment_safe_enhance_unresolved
equipment_price_conflict
equipment_description_missing
equipment_relation_unresolved
equipment_mechanic_unresolved
equipment_weight_unverified
equipment_source_precedence_conflict
```

Unresolved 不阻止生成 786 筆 identity；但有任一 required field unresolved 或 precedence conflict 時，Entity／Dataset 不得標 `complete`。

## 10. 驗收結論

1. 第一版是 786 筆 Equipment。
2. SkillBook、Doll、EquipmentSet／遺骸各由其 specialization owner 管理。
3. canonical base field 以 `DB.items` 優先；Wiki 只作 parity、editorial fallback 或 migration evidence。
4. runtime mutation 只透過核准的純資料步驟重現；不執行完整 UI。
5. 缺 `safe` 不等於 0；不可強化與 safe 0 分離。
6. 缺 `req` 不等於全職業。
7. legacy subtype 只作 mapping，正式輸出只用 equipmentType vocabulary。
8. 22 個已盤點 static scalar 可進 baseStats；公式／proc／實例值不進。
9. 5 筆 price conflict 保留 Evidence 與 diagnostic，採 `DB.items.p` candidate。
10. weight 不進第一版。
11. sources HTML 只作 migration evidence，Relations 從 owner Dataset 重建。
12. Interaction 以 InteractionRef 掛接，不把結論塞進 Equipment。
13. E2 不修改網站。
14. E3 第一個最小實作是 Schema 前的 source extraction fixture、classification mapping 與 unresolved fixture。
