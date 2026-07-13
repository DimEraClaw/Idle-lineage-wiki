# Equipment Stage E2：來源優先序

## 1. 目的

本文件定義 786 筆第一版 Equipment 如何合併來源。優先序是逐欄、逐 claim 的規則，不是「整份檔案誰永遠正確」。所有輸出都必須能回到 source revision、game version、symbol/path 與 extraction method。

## 2. 來源代號

| 代號 | 來源 | 合法責任 |
|---|---|---|
| A | `DB.items` base declaration | identity、raw canonical fields、base scalar、flags |
| B | deterministic runtime mutation | 可純資料重現的 normalization／derived enrichment；不得執行 UI／玩家狀態 |
| C | Wiki `EQUIP_DATA` projection | parity fixture、legacy classification、editorial／migration evidence |
| D | Monster Drop Dataset | Drop relation owner |
| E | Craft Dataset | Recipe relation owner |
| F | 未來 Quest／NPC／Skill／Set Dataset | 各 Domain relation owner |
| G | Editorial text | 核准的非 canonical 說明 |
| H | Research／Evidence | claim、conflict、verification；未核准 Finding 不回寫 canonical |

## 3. 共通合併演算法

1. 先以 A 的 object key 建立 786 筆 identity allowlist；C 只驗證 parity，不能擴大 scope。
2. 每個 field path 依本文件 matrix 選 owner，不以整筆 object merge。
3. B 只有在 mutation 被列為 deterministic、輸入封閉、規則版本化且可用純函式重現時才可套用。
4. C 不得覆蓋 A 的 numeric／boolean／ID；差異形成 Evidence 與 diagnostic。
5. D／E／F 只產生 RelationRef 或 summary，不把 target Entity 複製進 Equipment。
6. G 只能進 editorial 欄位。
7. H 不直接改值；核准後仍須依 owner 流程更新 source 或建立有 provenance 的 override contract。
8. missing 不自動等於 0、false 或空集合；只有欄位契約明定的 default 可轉換，並標 `derived_default`。
9. 同優先層互相衝突時不採第一筆，產生 `equipment_source_precedence_conflict`。

## 4. 逐欄 precedence matrix

| 欄位／claim | 優先序 | 規則 |
|---|---|---|
| `equipmentId` | A | 必須是 `DB.items` key；C 只檢查 1:1 parity |
| `displayName` | A > C | C 只在完全相等時作 parity；差異不自動 rename |
| `itemType` | A | 只接受 `wpn/arm/acc` allowlist |
| `equipmentGroup` | A＋核准 mapping > C | C 是預期輸出 fixture，不是 owner |
| `equipmentType` | 核准 mapping(B) > C > H | `WEAPON_TAGS` 可作輸入；名稱 regex 結果不可直接進 generator |
| `slot` | A explicit > 核准 mapping(B) > C | 缺值／特殊 arrow、pet、armguard 走例外 fixture；不採中文 label |
| `classRequirements.baseClasses` | A | `req:all` 明示展開；missing unresolved |
| `classRequirements.ruleRefs` | F(Mechanic) > code Evidence(H) | runtime function 先形成 Evidence，Mechanic ID 未建立前不造 ref |
| `rarity` | A flags > 核准 mapping(B) > C | Wiki label 不覆蓋 flags |
| `baseStats.*` | A > C | C 只驗證值；合法 derived 0 必須有 code default Evidence |
| `safeEnhance.enhanceable` | A `noEnhance` > code Rule(B) | 缺 flag 不直接 false／true |
| `safeEnhance.safeLevel` | A `safe` | C 補 0 不可 fallback |
| `safeEnhance.maxLevel` | A `maxEn` > versioned cap Rule(B) | 與 safeLevel 分離 |
| `price.amount` | A `p` > H | C 差異只建立 price conflict |
| `description.canonicalText` | A `d` | missing 為 null；不由 tooltip HTML 回填 |
| `description.editorialNote` | G > C editorial fragment | 必須純文字、審核且有 provenance |
| `skillRefs` | F Skill > code Evidence(H) | 不從名稱猜 Skill ID |
| `setRefs` | F Set > `DB.sets` pure derivation(B) | `initSetTags` 的 `.set` 只是 transient enrichment |
| `mechanicRefs` | F Mechanic > H | code 欄位只形成候選，不自行造 Mechanic ID |
| Drop relations | D | 由 ItemRef 反查；C source HTML 不參與正式 edge |
| Recipe relations | E | 由 result／requirement ID 反查 |
| Quest／NPC／Set relations | F | target 未建時 unresolved |
| Release relations | F Release | 由 ChangeRecord／EntityRef owner 提供 |
| Interaction relations | F Interaction | 遵循 Interaction Contract |
| Research relations | H | 只引用正式 Research／Evidence records |
| `verification` | H＋各 field provenance | Entity-level 聚合不得覆蓋 field conflict |
| `version` | source manifest／Release metadata | gameVersion 與 sourceRevision 分開 |
| `status` | diagnostics aggregation | unresolved 不因 identity 存在而變 complete |
| `entityRef` | derived from equipmentId | 必須 deterministic |
| weight claim | H only | 第一版不輸出；C／名稱式 ITEM_WEIGHTS 只作 evidence |

## 5. 已知 runtime mutation 分類

| Mutation | 分類 | 第一版處理 |
|---|---|---|
| `initSetTags()`：由 `DB.sets` 寫 item `.set` | deterministic derived enrichment | **必須以純資料等價步驟重現 relation**；輸出 `setRefs`，不保存 mutated `.set` |
| `WEAPON_TAGS` 補武器分類 | deterministic derived enrichment | **E3-A 建版本化 mapping fixture**；只用明示 ID mapping／flags，名稱 regex 項轉例外或 unresolved |
| 缺 `comboRate` 時依鋼爪／雙刀補 33／25／0 | deterministic derived enrichment | 不進 baseStats；保存 Code Evidence，未來引用 proc MechanicRef |
| 批次加入 `ignHardSkin` 與死亡之指 delete 例外 | deterministic derived enrichment | 不進 baseStats；以 Mechanic candidate／Evidence 保存，必須保留例外 |
| `initGachaWeights()`、商店／材料／Boss／relic／個別 ID 權重覆寫 | deterministic derived enrichment，依賴多 Domain | 不進第一版；屬 Pandora／economy Mechanic，不能覆蓋 price |
| `ITEM_WEIGHTS` 依中文名稱建立重量表 | unresolved mutation／legacy enrichment | 不進第一版；需 ID owner、單位與版本 Evidence |
| `filterClassicEffLabels()`／`classicMode` 特效停用 | mode-dependent | base 不變；只存 MechanicRef／Evidence |
| `checkCanEquip()`、Mastery、load-up、職業例外、雙持 | player-state-dependent／rule-dependent | 不改 baseClasses；保存 ruleRefs／unresolved restriction |
| `equipItem()` 的 offhand、ring/ear level slots、詛咒換裝 | player-state-dependent | 完全不進 base slot；屬 Mechanic／PlayerItemInstance |
| `en`、`bless`、`anc`、`attr`、`seteff` 與 recompute | player-state-dependent | 完全不進 base Equipment |
| `buildItemDescHTML()`、tooltip label、classic hide | UI-only | 不進 Dataset；不以產出 HTML 當 canonical description |
| runtime 新增 pride items | canonical normalization for Item，但 scope outside Equipment | 不進 786 allowlist |

### 5.1 Generator 邊界決策

E3 Generator 必須重現：

- 786 ID allowlist 與 A source extraction。
- 明示、版本化的 group／type／slot classification mapping。
- `DB.sets` 到 set relation candidate 的純資料轉換。
- `req:all` 展開、固定排序與契約明定的 base scalar additive default。
- source provenance、5 筆 price diagnostic 與 unresolved diagnostics。

只保存為 MechanicRef／Evidence：combo、hard-skin、proc、免疫、強化公式、class runtime exception、mode behavior、set threshold effects。

完全不得進 base Dataset：玩家裝備實例、recomputed effective stats、UI HTML、DOM state、localStorage、隨機結果、Pandora runtime weight、未驗證 weight claim。

## 6. 衝突處理

Conflict record 至少保留 field path、所有 source claims、revision、gameVersion、extraction method、EvidenceRef、目前 owner decision 與 unresolved reason。不得改 source snapshot來消除衝突。

- A vs C numeric conflict：採 A candidate，C 保存 migration evidence，status 至少 `review_required`。
- A base vs B enrichment：兩者分欄；B 不得假裝是原始 base value。
- owner Dataset relation vs C HTML：採 owner Relation；HTML 只驗證 migration coverage。
- H Finding vs canonical：未核准不回寫；核准後仍需可追溯的正式 override／source update。
- 缺 source：保留 null／unresolved；不可用 UI convenience default。

## 7. Semantic diff 邊界

- primary diff 比較 authoritative base fields、正式 classification mapping、Relation owner edges、verification／version states。
- derived summary reorder、HTML 格式、label color、tooltip 文字排列是 technical／editorial diff。
- mapping rule改變導致 type／slot 變更，先判定是遊戲變更或 `data_corrected`，不得自動 balanced。
- price、base stat、safe、class requirement 的 numeric／set change 是 semantic candidate；仍需 Evidence 與人工 review。
- runtime Mechanic 變化由 Mechanic owner產生 `mechanic_changed` candidate，Equipment 只顯示反向 relation。

## 8. 阻擋條件

E3-B 不得開始，直到 E3-A 能證明：786 identity 固定、classification mapping 覆蓋完整、特殊 slot 明列、source extraction 不執行 UI、5 筆 price conflict fixture 存在、field provenance 可序列化、unresolved 不被預設值吞掉。
