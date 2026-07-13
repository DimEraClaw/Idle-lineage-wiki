# Monster Domain：Drop Data Contract

## 1. 定位與所有權

Drop 描述來源 Entity 到 Item 的取得關係。Drop 不擁有 Monster 或 Item 主資料，也不把掉落自由文字嵌入 Monster。`MOB_DROPS` 是 Base Drop authoritative candidate；實際擊殺流程與特殊表提供 Runtime／Conditional 規則。

## 2. 三層資料不可混用

| 層 | 定義 | 可否作 canonical base |
|---|---|---|
| Base Drop | 來源表直接宣告的 item、base probability、quantity candidate | 可以，需 Code evidence |
| Runtime Modified Drop | 模式、倍率、遺物、試煉、事件、條件與程式流程套用後結果 | 不覆寫 base；以 Mechanic／Modifier 表達 |
| Display Drop | Wiki／UI 顯示名稱、格式化 rate、地點文字與排序 | 不可；只作 view／legacy evidence |

任何 Dataset 或 UI 都必須標示所呈現的是 base、effective estimate 或 display snapshot。

## 3. DropTable

```json
{
  "dropTableId": "assigned-in-C2",
  "owner": { "entityType": "monster", "entityId": "orc" },
  "ownerType": "monster",
  "dropType": "base",
  "rollModel": "independent",
  "entries": [],
  "conditions": [],
  "runtimeModifiers": [],
  "verification": {},
  "version": {},
  "entityRef": { "entityType": "dropTable", "entityId": "assigned-in-C2" },
  "relations": []
}
```

### DropTable 欄位

| 欄位 | 必要 | 規則 |
|---|---:|---|
| `dropTableId` | 是 | C2 必須定案穩定 assignment；不得用 owner name、排序或 runtime hash |
| `owner` | 是 | DropOwner EntityRef；Base v1 主要為 MonsterRef |
| `ownerType` | 是 | monster、map、event、quest、system、unknown |
| `dropType` | 是 | base、conditional、boss、area_bonus、event、quest、card、special、unknown |
| `rollModel` | 是 | independent、weighted_pool、guaranteed、scripted、unknown |
| `entries` | 是 | DropEntryRef[] 或 owned entries，順序預設無語意 |
| `conditions` | 是 | ConditionRef[]；無條件為空陣列 |
| `runtimeModifiers` | 是 | ModifierRef[]，不存已套用後的假 base rate |
| `verification/version/entityRef/relations` | 是 | 共通模型 |

## 4. DropOwner

- `MOB_DROPS` owner name 必須先透過 resolved `drop_owner_to_monster_id` mapping 得到 MonsterRef。
- Mapping ambiguous／unresolved 時 owner target 為 null，保留 ownerNameText、sourceLocation 與狀態。
- Base v1 的 433 owner 目前皆可 resolved，但 generator 仍不得用名稱作正式 FK。
- Map／Event／Quest owner 只有對應 Entity 已存在才能 resolved。
- `bossOnly` 不由掉落稀有度推測；只由 owner Boss classification 或明示條件形成。

## 5. DropEntry

```json
{
  "dropEntryId": "assigned-in-C2",
  "dropTableRef": { "entityType": "dropTable", "entityId": "..." },
  "itemRef": { "entityType": "item", "entityId": "scroll_weapon" },
  "itemNameText": null,
  "probability": { "value": 1, "unit": "percent", "basis": 100 },
  "quantity": { "min": 1, "max": 1 },
  "dropType": "base",
  "bossOnly": false,
  "conditions": [],
  "runtimeModifiers": [],
  "verification": {},
  "version": {}
}
```

| 欄位 | 必要 | 規則 |
|---|---:|---|
| `dropEntryId` | 是 | 穩定 relation ID；C2 定案，不用 array index |
| `dropTableRef` | 是 | 必須指向 owner table |
| `itemRef` | 是 | existing ItemRef；無 target 時 null + unresolved |
| `itemNameText` | 是 | legacy fallback，resolved 時可 null；不可作 FK |
| `probability` | 是 | structured value/unit/basis；unknown 時 value null |
| `quantity` | 是 | structured min/max；未知不可猜 1，除非來源／runtime 契約明示 default |
| `dropType` | 是 | 與 table type一致或更具體 |
| `bossOnly` | 是 | boolean/null；未知為 null |
| `conditions` | 是 | ConditionRef[] |
| `runtimeModifiers` | 是 | ModifierRef[] |
| `verification/version` | 是 | 可附欄位級證據 |

## 6. Probability

```json
{
  "value": 0.5,
  "unit": "percent",
  "basis": 100
}
```

- `MOB_DROPS` rate 單位是 percent，runtime 判定為 effectiveRate / 100。
- Card drop 程式使用 0～1 probability；不能直接放入 percent value。
- 建議 unit enum：percent、probability、weight、guaranteed、unknown。
- value 必須有限且符合 unit 範圍。
- 100 percent 在 independent roll model 表示該 entry 必中，不表示整張表只選一項。
- weight 必須配合 pool 與總權重，不能顯示成百分比。
- 不可將 runtime multiplier 後的值寫回 base probability。

## 7. Conditional、Boss 與 Runtime Modifier

### Conditional Drop

Condition 至少能描述：mode、class、map、event、quest state、required item、time、room state、trial、source revision；無正式 Entity 時保留 unresolved source。

### Boss Only

- Boss 自身 table 可由 Monster.isBoss 提供 owner context。
- `bossOnly=true` 只有明示「僅 Boss」條件才使用。
- 同 item 只出現在 Boss table 不足以推論 item 本身是 Boss-only。

### Runtime Modifier

Modifier 應引用 Mechanic，並包含 operation、value、scope、conditions、order 與 verification。例：倍率、強制 100%、數量加倍、模式 suppression。不得只保存一個無上下文 effective rate。

## 8. ItemRef 與 unresolved item

- ItemRef 使用既有 Item ID。
- 主 `MOB_DROPS` 3,655 entries 目前 item target 全部可解析。
- Wiki 的 18 個 `item_pride_*` sourceValue 沒有正式 Item target，保持 unresolved；不得將字串直接升級成 item ID。
- Item classification（Equipment、Material、QuestItem、SkillBook）由 Item／對應 Domain 擁有，Drop 只引用 ItemRef。

## 9. Verification

DropTable、Entry、Probability、Condition 與 Modifier分別使用共通 Verification model：

- Base table entry 通常為 Code。
- 決定性抽取 record 可另標 Generated，但保留 Code input evidence。
- Wiki display snapshot 可為 Generated／Community／Unknown，不能覆蓋 Code base。
- Runtime rule 必須定位執行路徑。
- 無法確認 roll model、quantity 或 condition 時為 Unknown。

## 10. Relations

Drop 關聯至少包含：

- Monster→DropTable。
- DropTable→DropEntry。
- DropEntry→Item。
- DropTable/Entry→Map／Event／Quest condition。
- Drop/Modifier→Mechanic。
- Drop claim→Research／Evidence。
- Release→changed DropTable／DropEntry。

全部使用 EntityRef／RelationRef，不使用名稱 fallback 作正式 target。

## 11. Canonical、derived 與 display

Canonical：DropTable identity、owner ref、base entries、base probability unit/value、base quantity、明示 conditions、roll model、verification/version。

Derived：effective probability、Boss context、反向「哪些怪物掉落此物」、按 Map 聚合的掉落列表、顯示百分比。

Display-only：itemName、monsterName、locationTexts、排序、格式化 `%`、Wiki 補充描述。

## 12. Unresolved policy

- owner、item、condition target、probability unit、quantity、roll model 任何一項無法證實均保留 unresolved，不猜測。
- unresolved entry 不必使整批 Dataset failed；required owner/item relation 缺失時該 table 或 Dataset 至少 partial／review_required。
- 同一 table 相同 item 重複時不得靜默合併；先保留 source occurrences 並由 validator 依 roll semantics 判斷。
- Base 與 display rate 衝突時保留兩份 evidence，不自動選 Wiki 或程式。
- 缺 drop table 不代表「確認不掉落」；需用 `unknown` 與明示 empty table區分。

## 13. Semantic diff

- 比較 canonical DropTable／DropEntry identity，不比較 display order。
- rate、unit、rollModel、quantity、condition、owner、item target 改變是 semantic change。
- formatting、排序、名稱 label 改變不應產生 Drop balance change。
- Runtime Modifier 改變應分類 mechanic_changed／balanced，不能只報 base rate changed。

## 14. Stage C2 前置問題

- DropTable／DropEntry 穩定 ID assignment。
- 同 owner 多 table 與多層 table 的 identity。
- quantity 缺省語意。
- 特殊／區域／任務／卡片掉落的抽取邊界。
- Runtime Modifier operation 與 execution order enum。
- 18 個 pride item unresolved fixtures。
