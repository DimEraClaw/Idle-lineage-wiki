# Monster Domain：Monster Data Contract

## 1. 契約定位

本文件定義 Monster Domain 的 `Monster` Entity、欄位所有權、衍生資料、跨域關聯、驗證與 unresolved 行為。此契約是 Stage C2 Schema、generator 與 validator 的設計依據，不代表已建立正式 Dataset。

Monster 主資料的 authoritative candidate 是 `js/00-data.js` 的 `DB.mobs`。正式 identity 沿用既有 object key，不由名稱、排序或 mapping ID 建立。Legacy name mapping 只負責來源轉接，不參與 canonical Entity lookup。

## 2. Identity 與基本規則

### 2.1 Monster identity

```json
{
  "entityType": "monster",
  "entityId": "orc"
}
```

- `monsterId` 必須等於既有 `DB.mobs` key。
- `monsterId` 必須唯一、非空，且不得因顯示名稱改變。
- 現有非 ASCII ID 仍照原值保留，不得另造替代 ID。
- `displayName` 是 label，不是 identity。
- 同名怪物不得合併；若未來重名，以 monsterId 區分。
- MonsterVariant 關係只有在來源明示時才能建立，不從括號、顏色、雄雌或前綴推測。

## 3. Monster Entity

概念模型：

```json
{
  "monsterId": "orc",
  "displayName": "妖魔",
  "aliases": [],
  "description": null,
  "level": 2,
  "hp": 6,
  "mp": null,
  "stats": {
    "ac": 10,
    "mr": 0,
    "hit": 0,
    "er": null,
    "dr": null,
    "attackSpeed": 2,
    "damageDice": [2, 2],
    "damageBonus": 2,
    "experience": 5,
    "goldMin": 10,
    "goldMax": 30
  },
  "race": "妖魔",
  "size": "small",
  "element": "fire",
  "alignment": null,
  "isBoss": false,
  "bossTier": null,
  "isQuestTarget": null,
  "spawn": [],
  "maps": [],
  "drops": [],
  "cards": [],
  "quests": [],
  "craftRelations": [],
  "skillRelations": [],
  "equipmentRelations": [],
  "mechanics": [],
  "interactions": [],
  "verification": {},
  "version": {},
  "entityRef": { "entityType": "monster", "entityId": "orc" },
  "relations": []
}
```

範例只說明結構；不得把示例中的 unresolved 值轉成遊戲事實。

## 4. 欄位契約

### 4.1 Identity 與文字

| 欄位 | 型別 | 必要 | 分類 | 規則 |
|---|---|---:|---|---|
| `monsterId` | string | 是 | canonical | 既有 `DB.mobs` key；不可 unresolved |
| `displayName` | string | 是 | canonical label | 來自 `n`；不可作 FK |
| `aliases` | string[] | 是 | metadata | 僅收錄 verified alias；預設空陣列 |
| `description` | string/null | 是 | editorial | 無來源時 null，不由 UI 文字反推 |
| `entityRef` | EntityRef | 是 | canonical | 必須精確回指同一 monsterId |

### 4.2 基礎能力

| 欄位 | 必要 | canonical／derived | unresolved 規則 |
|---|---:|---|---|
| `level` | 是 | canonical base | 必須是來源有限數值 |
| `hp` | 是 | canonical base max HP | 不使用 Wiki 衝突值覆蓋；衝突進 Research |
| `mp` | 是 | canonical nullable | 現況未找到通用來源，固定 null + Unknown verification |
| `stats.ac` | 是 | canonical base | 有來源，不可省略 |
| `stats.mr` | 是 | canonical base | 有來源，不可省略 |
| `stats.hit` | 是 | canonical base | 有來源，不可省略 |
| `stats.er` | 是 | canonical nullable | 缺欄不可自動等於 0 |
| `stats.dr` | 是 | canonical nullable | 缺欄不可自動等於 0 |
| `stats.attackSpeed` | 是 | canonical base | 保留來源單位，Schema 前須定義數值範圍 |
| `stats.damageDice` | 是 | canonical parameters | 保存骰數／骰面，不存 UI damage string |
| `stats.damageBonus` | 是 | canonical parameter | 對應既有 base bonus |
| `stats.experience` | 是 | canonical base | runtime modifier 另存 Mechanics |
| `stats.goldMin/Max` | 是 | canonical base | 必須滿足 min ≤ max |

`currentHp`、runtime UID、出生時間、狀態、技能 CD、實際傷害、顯示傷害區間均不得進 Monster canonical Entity。它們分別屬 Player/Runtime State 或 DerivedValue。

### 4.3 分類與旗標

| 欄位 | 必要 | 規則 |
|---|---:|---|
| `race` | 是 | 保留來源值；未建立 System enum 前不得猜測合併 |
| `size` | 是 | 由既有 `s` 的已驗證轉換產生；語意未定時為 unresolved/null，不以字母猜完整名稱 |
| `element` | 是 | 使用來源 element code；unknown 明示，不由 emoji 推測 |
| `alignment` | 是 | 有來源才填；目前可 null |
| `isBoss` | 是 | 僅 `boss: true` 為 true；缺 flag 依 generator 契約轉 false，須保存 Code evidence |
| `bossTier` | 是 | 沒有正式 tier 來源時 null；不可從 HP／名稱排名 |
| `isQuestTarget` | 是 | Quest relations 完成前可 null；不得因名稱出現在任務文字就設 true |

### 4.4 Relation summaries

以下欄位皆為 relation summary，不擁有 target 主資料：

| 欄位 | 指向 | 所有權／來源 |
|---|---|---|
| `spawn` | SpawnRef[] | Monster/Map relation Dataset |
| `maps` | MapRef[] | 由有效 Spawn 反向產生 |
| `drops` | DropTableRef[] | Drop Dataset |
| `cards` | CardRef[] | Card Domain；Card ID 未定時空陣列或 unresolved relation |
| `quests` | QuestRef[] | Quest Domain |
| `craftRelations` | Recipe/Item relation refs | Craft Domain |
| `skillRelations` | SkillRef[] | Skill Domain |
| `equipmentRelations` | EquipmentRef[] | Equipment Domain |
| `mechanics` | MechanicRef[] | Mechanics Domain |
| `interactions` | InteractionRef[] | Interaction Domain |
| `relations` | RelationRef[] | 共通 relation graph |

這些 summaries 必須可由 canonical Relation records 決定性重建；不得人工維護第二份內容。Target unresolved 時 Relation 保留 `target: null`、legacy source 與狀態，Monster Entity 不塞入名稱 fallback。

## 5. Canonical、derived 與 metadata 分類

### Canonical

- monsterId、displayName。
- level、hp、nullable mp。
- base combat stats 與明示分類旗標。
- race、element、已驗證 size/alignment。
- entityRef、version scope、欄位 verification。

### Derived

- maps、drops、cards、quests 等 relation summaries。
- damage range／格式化 dice string。
- 是否出現在多地圖、掉落數量、卡片集合數量。
- effective stats、effective drop、runtime HP、spawn availability。

### Editorial／metadata

- aliases、description。
- source labels、display order、search tokens。
- verification、version、research references。

## 6. 必填與 unresolved

每筆 Monster 必須有：`monsterId`、`displayName`、`level`、`hp`、完整 `stats` object、`race`、`size`、`element`、`alignment`、`isBoss`、`bossTier`、`isQuestTarget`、所有 relation arrays、`verification`、`version`、`entityRef`、`relations`。

必填不等於必須 resolved。`mp`、`er`、`dr`、size semantic、alignment、bossTier、isQuestTarget 可使用 null／Unknown verification。Identity、displayName、level、hp、AC、MR、hit 與 entityRef 不可缺失；來源異常時該 Monster record 應 validation failure 或 review_required，不得補值。

## 7. Verification model

Monster 與每個可獨立驗證欄位都可附：

```json
{
  "verificationStatus": "Code",
  "source": "js/00-data.js#DB.mobs.orc.hp",
  "evidence": [],
  "verifiedBy": "generator",
  "verifiedVersion": null,
  "confidence": "high"
}
```

VerificationStatus 使用共通列舉：`Official`、`Code`、`Generated`、`Community`、`Research`、`Test`、`Unknown`。詳見本文件第 10 節。

## 8. Version model

`version` 至少能表達：

- `sourceRevision`：來源 revision，未知為 null。
- `gameVersion`：遊戲版本，未知為 null。
- `schemaVersion`：Monster Schema version。
- `validFrom`／`validTo`：歷史有效範圍，未知為 null。
- `generatedAt` 不得參與 semantic identity 或 deterministic output。

## 9. Entity relations

Monster 可透過 EntityRef／RelationRef 關聯：Craft、Equipment、Quest、Skill、Release、Interaction、Research、Card、Map、Drop 與 Mechanics。Relation record 至少包含 relation type、from、to、status、verification、version；禁止以 target displayName 作關聯鍵。

## 10. 共通 Verification 契約

| 狀態 | 語意 |
|---|---|
| `Official` | 可定位官方來源直接支持 |
| `Code` | 可定位遊戲程式／資料表直接支持 |
| `Generated` | 由已版本化、決定性 generator 從已驗證輸入產生；不自動高於來源證據 |
| `Community` | 社群來源，需保留出處，不可假裝官方／程式事實 |
| `Research` | 經研究流程形成的 finding，需 Evidence／confidence |
| `Test` | 可重現測試支持 |
| `Unknown` | 缺證據、來源衝突或尚未解析 |

`confidence` 建議為 `high`、`medium`、`low`、`unknown`。Status 不取代 evidence；Generated 只描述產生方式，不能把 Unknown input 升級為已驗證。

## 11. Unresolved policy

- 不猜 Monster、Map、Drop、Region、Card、Quest、Item 或 Skill。
- 找不到 target 時保留 legacy sourceValue、sourceLocation、candidates 與原因；target 為 null。
- 關聯 unresolved 不使 Monster identity 消失，但 Dataset status 依 required relation 判為 partial／review_required。
- HP 等來源衝突不得採第一筆；保留 Conflict／Research reference。
- 缺欄不等於 0、false、empty semantic value；只有契約明定的 flag default 可轉換。
- Region 未建立正式 ID，Monster 不得有猜測 regionRef。

## 12. Semantic diff

- monsterId 是 matching key；displayName 只會產生 renamed／label change，不建立新 Entity。
- canonical stats、classification、boss flag 與 version scope 改變是 semantic change。
- relation array 排序、description 格式、derived display string 改變不是 Monster base stat change。
- relation semantic diff 應在 Relation owner Dataset 執行，再反映至 Monster view。

## 13. Stage C2 前置條件

- 決定 `s`→size 的安全轉換或保留 raw code。
- 明定缺省 ER／DR、MP 與 boolean flag 的轉換語意。
- 確認 Monster Schema 是否保存 raw source fields 作 trace metadata。
- 將 42 個 Wiki HP 衝突列為 fixtures／diagnostics，不覆蓋 `DB.mobs`。
- 與 Map、Drop Contract 對齊 EntityRef、Verification、Version 與 Relation model。
