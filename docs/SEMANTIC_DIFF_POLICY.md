# Release Hub Semantic Diff Policy

## 1. 目的

Semantic diff 將 normalized Dataset snapshots 的差異轉成 Entity 層候選變更，再經人工 review 形成玩家可見 ChangeRecord。它不比較 raw source text，也不直接以 Git diff、檔案數或增刪行數產生更新。

本文件定義跨 Domain 共通規則與 Domain policy placeholder。尚未完成 audit 的欄位明確標為 unresolved，不以猜測填值。

## 2. 四層差異

```text
source/raw diff
  → normalized structural diff
  → semantic entity diff
  → reviewed player-visible ChangeRecord
```

| 層 | 用途 | 可否直接發布 |
|---|---|---|
| raw diff | 工程追蹤來源 bytes／程式變化 | 不可 |
| normalized diff | 消除格式、排序與生成噪音 | 不可 |
| entity diff | 以 stable ID 描述欄位／Relation 差異 | 仍需 review |
| ChangeRecord | 經 Evidence 與玩家影響確認 | 可以 |

## 3. 比較前提

- before／after 都必須有 source manifest、normalized snapshot identity、SchemaVersion 與 Dataset status。
- 只比較同一 Dataset identity 且有明確 schema compatibility 的 snapshots。
- Entity matching 只用 stable ID／明確 alias mapping，不用中文名稱。
- Schema major 不同時先 migration 到共同可比較形狀；不可直接產生玩家 diff。
- 任一 snapshot failed／hash mismatch 時停止比較。

## 4. 共通 normalization

### 4.1 Object key order

- JSON object key 排序一律無語意。
- 比較器以 key identity 比較，不比較序列化位置。
- canonical output 可排序，但排序變化不產生 ChangeRecord。

### 4.2 Set-like arrays

只有 Domain contract 明確定義為 set 的 collection 才可忽略順序。

- 先以 stable element identity 排序或建立 map。
- 重複 element 是 validation issue，不應被 set normalization 靜默吞掉。
- 只有 display text 的 element 不得自行以文字去重。

### 4.3 Ordered arrays

下列類型通常有序，但仍須由 Domain policy 定案：

- Quest steps。
- Recipe requirements（若處理／顯示順序有機制意義）。
- Combat／proc priority。
- Dialogue／timeline。
- Release ChangeRecord display order（只影響呈現，不改 ChangeRecord identity）。

有序 collection 的 reorder 是否玩家可見，依欄位語意判斷；不可一律當 changed。

### 4.4 Derived fields

- 可由相同 authoritative inputs 與相同 Formula 重算的欄位不作 primary diff。
- input 或 Formula 改變時，ChangeRecord 指向來源欄位／Mechanic；derived delta 可作 impact summary。
- derived field 與重算值不一致是 `data_corrected`／validation issue，不是自動 balanced。

### 4.5 Display-only fields

- 純排版、顏色、icon path、空白、排序 hint 不產生遊戲變更。
- 玩家可見名稱／描述即使不影響機制，仍可能產生 `renamed` 或 `data_corrected`。
- 是否 display-only 必須逐 Domain、逐欄位定義；名稱不能一律忽略。

## 5. Null／missing／unknown／unresolved

四者不可正規化成同一值：

| 狀態 | 語意 |
|---|---|
| missing | 欄位不存在；可能是 Schema／migration 問題 |
| null | 契約允許的明示空值 |
| unknown | 已知概念存在，但目前沒有可得值 |
| unresolved | 有原始資訊或候選，但尚未完成正式 ID／Evidence 驗證 |

狀態轉換需保留：

- unresolved → resolved：通常是 Wiki 資料完成，可能為 `data_corrected` 或 coverage update，不代表遊戲改版。
- known → unknown／missing：可能是 regression，預設 review_required。
- null ↔ missing：只有 Schema 明確等價時才能忽略。
- conflicting unresolved 不得自動選一個候選。

## 6. Numeric changes

- 數值比較同時檢查 value、unit、scale、rounding、min/max、probability basis。
- 浮點容差必須逐欄位定義；沒有 policy 時精確比較並標 review_required。
- `1`、`1.0` 是否相同取決於 Schema type 與單位，不由序列化形式決定。
- 百分比 `1` 與 ratio `0.01` 不得因顯示相同而合併。
- Formula／運算順序改變使用 `mechanic_changed`；純數值平衡通常使用 `balanced`。

## 7. Rename、removal、tombstone

### 7.1 Rename

- stable ID 相同、canonical name 改變：候選 `renamed`。
- ID 也改變時，必須有官方／Code／人工 mapping Evidence 才能視為 rename。
- 只憑名稱相似不得連結；保持 removed + added candidates 或 unresolved identity conflict。

### 7.2 Removal

- Entity 從 authoritative after snapshot 消失，不立即發布 `removed`。
- 先排除 extractor coverage、filter、Schema migration、source file scope 與生成失敗。
- 確認真正移除後保留 tombstone：舊 EntityRef、最後版本、removal Release、replacementRef（若有）。
- 歷史 Release 仍須解析舊 EntityRef 到 tombstone／歷史頁。

### 7.3 Split／merge

- 一個 Entity 分裂為多個或多個合併為一個，不能靠名字自動判定。
- 必須記錄 predecessor／successor EntityRefs、mapping Evidence 與資料遷移。
- 這類變更預設 review_required，可能產生 removed、added、renamed 或 mechanic_changed 的組合。

## 8. Entity ID change

- ID 是 identity；變更預設視為 removed + added。
- 只有存在正式 alias／migration mapping，才可在 Wiki 層保持連續 identity。
- mapping 本身需版本、Evidence 與 validation，不能只放在 UI redirect。
- 大規模 ID 改變可能要求 WikiVersion major／SchemaVersion major。

## 9. ChangeRecord 分類

| 情況 | 候選 changeType |
|---|---|
| 新 stable Entity | `added` |
| 一般玩家可見欄位改變 | `changed` |
| 數值／成本／機率／冷卻強度調整 | `balanced` |
| 原遊戲錯誤修復 | `fixed` |
| 經確認移除 | `removed` |
| 同一 identity 名稱改變 | `renamed` |
| Formula／觸發／優先序改變 | `mechanic_changed` |
| Wiki 先前資料或 mapping 修正 | `data_corrected` |
| 意義、identity 或 Evidence 不足 | `unresolved` |

自動 diff 只能提出候選類型。`fixed`、`balanced`、`mechanic_changed` 特別需要 Code／Official／Test Evidence 與人工 review。

## 10. Technical-only diff

下列差異不建立玩家 ChangeRecord：

- 格式化、換行、object key order。
- set-like collection reorder。
- 註解、工程 log、cache token，除非其權威值代表真實資料變化。
- generator 版本／generatedAt 變化但 normalized payload 相同。
- source files 改變但相關 normalized Entities 完全相同。
- Wiki refactor、測試、diagnostic 文案及內部索引重建。

technical-only diff 仍應保留工程 audit record：source manifest before/after、raw diff identity、normalized comparison result 與 reviewer，不顯示在玩家統計。

## 11. Domain policy template

每個 Domain 在可進入 Stage C 前必須填完：

```text
Domain:
Owner Dataset:
Stable entity types / IDs:
Authoritative source fields:
Display-only fields:
Derived fields and formula refs:
Ordered collections:
Unordered collections:
Numeric units / tolerances:
Blocking unresolved cases:
Rename / removal / tombstone rules:
Allowed ChangeRecord mappings:
Required Evidence:
Baseline fixture:
Policy status: complete | partial | unresolved
```

## 12. Equipment policy placeholder

- Owner Dataset：未正式實作；架構 owner 為 Equipment。
- Stable IDs：現有 `wpn_*`、`arm_*`、`acc_*` 等候選，完整 coverage 尚未 audit。
- Authoritative fields：unresolved；需區分遊戲 `DB.items`、Wiki `EQUIP_DATA` 與人工補充。
- Display-only：icon／layout 候選；name、description 不可先行忽略。
- Derived：顯示 stats 是否原始或推導尚未逐欄位盤點。
- Ordered／unordered collections：unresolved。
- Blocking：duplicate ID、slot mapping、unit、source ownership、EntityRef 未解。
- ChangeRecord：added、changed、balanced、removed、renamed、data_corrected、unresolved；mechanic effect 需 Mechanic Evidence。
- Policy status：`unresolved`。

## 13. Skill policy placeholder

- Owner Dataset：Skill；尚無正式 Dataset。
- Stable IDs：現有 `sk_*` 等候選，skillbook item 不等於 Skill ID。
- Authoritative fields：技能 DB、施放邏輯、消耗與說明可能分散多檔，尚未定案。
- Display-only：icon／文案與真實 effect 必須分開。
- Derived：傷害、命中、消耗可能依 Formula 推導。
- Ordered collections：effect／trigger priority 可能有序，unresolved。
- Blocking：skillbook mapping、同名技能、職業／版本 scope、程式與描述不一致。
- ChangeRecord：balanced、mechanic_changed、data_corrected 需 Evidence。
- Policy status：`unresolved`。

## 14. Monster policy placeholder

- Owner Dataset：Monster；尚無正式 Dataset。
- Stable IDs：目前大量來源以中文 monsterNameText，正式 monster ID coverage 未完成。
- Authoritative fields：monster DB、spawn、combat logic、drop config 分散。
- Display-only：sprite／音效 path 通常 technical，但玩家可見資產改變是否發布需另定。
- Derived：戰鬥衍生 stats 與難度不可直接當原始欄位。
- Ordered collections：skill priority／AI sequence 可能有序。
- Unordered collections：regions／drops 可能 set-like，但 drop rate 與條件屬 Relation metadata。
- Blocking：name-only identity、variant、region ID、drop relation owner。
- Policy status：`unresolved`。

## 15. Recipe policy placeholder

- Owner Dataset：Recipe／Craft。
- Stable IDs：Craft Phase 1 已有 `recipe_<npc>_<result>_<variant>` 契約。
- Authoritative fields：目前 generator 來源為 Wiki `wiki.html`，與原作者 `js/14-craft-pandora.js` 權威關係 unresolved。
- Display-only：description／special note 是否玩家 diff 需人工 review。
- Derived：配方樹、材料總計、gold total 不作 primary diff。
- Ordered collections：requirements 目前 generator 依 itemId 排序，語意視為 set-like candidate；在多步消耗順序有機制意義前不可定案。
- Numeric：result quantity、requirement quantity、currency amount 都具語意。
- Blocking：source ownership、同成品多 Recipe、yield、cycle、unresolved items/NPC。
- ChangeRecord：balanced、changed、added、removed、data_corrected、unresolved。
- Policy status：`partial`；結構可比較，source linkage 未完成。

## 16. NPC policy placeholder

- Owner Dataset：NPC；尚無統一正式 Dataset。
- Stable IDs：Craft NPC 已有 `npc_*`，全站 coverage 未完成。
- Authoritative fields：位置、功能、商店、Quest、Recipe 分散。
- Display-only：description 可能只影響 Wiki；name change 可為 renamed。
- Ordered collections：UI sortOrder 是 display-only candidate，不等於遊戲變更。
- Unordered collections：provided recipes／quests 應由 Relations 反查，不複製比較。
- Blocking：同名不同 NPC、regionId unresolved、owner duplication。
- Policy status：`unresolved`。

## 17. Quest policy placeholder

- Owner Dataset：Quest；尚無正式 Dataset。
- Stable IDs：需盤點。
- Authoritative fields：quest state、steps、requirements、rewards 與 NPC source 分散。
- Ordered collections：Quest steps 有序。
- Unordered collections：rewards 是否有 choice/order semantics 尚未定案。
- Derived：可完成狀態、總需求不作 primary diff。
- Blocking：quest ID、step identity、one-time/branch semantics、reward EntityRef。
- Policy status：`unresolved`。

## 18. Card policy placeholder

- Owner Dataset：Card；尚無正式 Dataset。
- Stable IDs：需盤點 card／cardSet identity。
- Authoritative fields：卡片資料與集合效果目前內嵌程式。
- Display-only：圖像／silhouette／排序候選。
- Ordered collections：set requirement order 通常 display-only，但尚未驗證。
- Unordered collections：cards in set 可能 set-like；duplicate／count requirement 需保留。
- Blocking：Monster mapping、CardSet identity、effect／Mechanic mapping。
- Policy status：`unresolved`。

## 19. System policy placeholder

- Owner Dataset：System。
- Entity：Class、Stat、StatusEffect、Currency、Region、GameVersion 等。
- Stable IDs 與 authoritative files 尚未統一。
- Formula／Mechanic 不應被壓成 display text。
- 枚舉排序通常 technical；數值表、上限、單位與 unlock order 具語意。
- Blocking：共享定義重複、version scope、GameVersion identity、region mapping。
- Policy status：`unresolved`。

## 20. Dataset priority 與 bootstrap status

### P0：第一個玩家可見 baseline 的核心範圍

- Equipment
- Skill
- Craft
- Monster
- Card

P0 決定 Release Hub 是否能宣稱「核心百科已同步」。任一 P0 Dataset 不是 `up_to_date`，整站 bootstrap status 不得是 `up_to_date`。

### P1：後續必要領域

- Quest
- NPC
- Region
- System

P1 必須個別顯示 status；在其尚未列入某個 Release 的 required scope 前，不阻止該 scope 發布，但不得暗示這些百科已完成同步。

### P2：研究與進階關聯

- Mechanics
- Research
- Interactions

P2 可漸進建立，未完成時顯示 unknown／partial／review_required，不影響既有 P0 Entity 的事實展示；若 P0 ChangeRecord 主張 mechanic_changed，所需 Mechanic／Evidence 仍是該筆發布的 blocking dependency。

### Status 判定

- Dataset status 只由自身 source manifest、normalized snapshot、SchemaVersion、validator、semantic policy 與 review 結果決定，不繼承整站或其他 Dataset。
- 有 generator 但輸入未綁 immutable revision：最高 `review_required`。
- 有 deterministic generator、validator、完整 source linkage、complete policy、review 完成且無 blocking issue：才可 `up_to_date`。
- 沒有 generator 的 Dataset 原則上不得自動 `up_to_date`；只有另行核准的 deterministic manual snapshot protocol、完整 manifest、validator 與雙人 review 都完成時，才可人工標記，並保留 Evidence。
- 已知只同步部分 Entity／欄位：`partial`，不得以建立 baseline 為由提升。
- 尚未完成 inventory、owner 或來源判定：`unknown`。
- 自動流程完成但玩家意義待確認：`review_required`。
- 生成、hash、Schema 或 blocking validation 失敗：`failed`。

依 Stage A 現況，Craft 因 generator input 未綁原作者 immutable revision，最多為 `review_required`；Equipment、Skill、Monster、Card 尚無完整 generator／validator／policy，應依實際 inventory 標為 `partial` 或 `unknown`，不能直接標 `up_to_date`。

## 21. Review workflow

每次 diff 必須保存：

1. before／after source manifest identity。
2. before／after normalized snapshot identity。
3. SchemaVersion 與 migration path。
4. raw diff 工程位置。
5. normalization rules version。
6. entity diff candidates。
7. unresolved／conflicts。
8. reviewer、Evidence 與分類決策。
9. accepted ChangeRecord IDs 或 technical-only 理由。

沒有 review 的 entity diff 不可進 Release。review 不得修改 source snapshot；修正 extractor／policy 後重新生成候選。

## 22. Validation gates

- 同一輸入與 policy 產生 deterministic entity diff。
- 格式／排序-only fixture 產生零 semantic changes。
- stable ID matching 不使用 display name。
- unresolved identity 不自動合併。
- removed Entity 有 tombstone policy。
- numeric unit／tolerance 明確。
- ChangeRecord count 等於 review accepted candidates，不等於 raw diff 數量。
- 各 Domain policy 未 complete 時，對應 Dataset 不得為 up_to_date。

## 23. Stage C 阻擋問題

- Equipment、Skill、Monster、NPC、Quest、Card、System policies 仍 unresolved。
- Recipe 只有 partial policy，原作者 source linkage 尚未完成。
- normalization policy 的 machine-readable version／identity 未定案。
- tombstone storage 與 historical navigation 未設計。
- before/after published snapshots 尚不存在。

因此 Stage C 可先實作 Source Manifest／bootstrap fixtures 的最小契約，但不能宣稱跨 Domain semantic diff 已完成。
