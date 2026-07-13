# Monster Domain：Map Data Contract

## 1. 定位

Map 描述遊戲中可由既有 key 識別的地圖／生成池載體。Map 不等於 Region、Navigation Group、CardSet 或 Wiki 顯示分組。本階段不建立 Region Entity 或 Region ID。

## 2. Map identity

- `mapId` 必須沿用 `DB.maps` key。
- mapId 不由中文 label、樓層文字、navigation value、CardSet key 或陣列位置生成。
- `MAP_REGIONS[].maps[].v` 只有同時存在於 `DB.maps` 時才能成為 MapRef。
- 18 個不在 `DB.maps` 的 `town_*` navigation values 保持 missing_target，不補造 Map。
- Wiki location 只有經 mapping Dataset resolved 才能引用 MapRef。

## 3. Map Entity

```json
{
  "mapId": "silver_knight",
  "displayName": "銀騎士村周邊",
  "aliases": [],
  "description": null,
  "mapType": "field",
  "floor": null,
  "parentMap": null,
  "childMaps": [],
  "navigation": [],
  "navigationGroups": [],
  "region": null,
  "spawnPools": [],
  "monsterPool": [],
  "bossPool": [],
  "availability": "unknown",
  "verification": {},
  "version": {},
  "entityRef": { "entityType": "map", "entityId": "silver_knight" },
  "relations": []
}
```

## 4. 欄位規則

| 欄位 | 必要 | 分類 | 規則 |
|---|---:|---|---|
| `mapId` | 是 | canonical | `DB.maps` key，不可 unresolved |
| `displayName` | 是 | canonical label | resolved navigation label 優先；找不到時不得由 key 美化猜名，可 null/Unknown |
| `aliases` | 是 | metadata | verified aliases only |
| `description` | 是 | editorial | 無來源為 null |
| `mapType` | 是 | canonical nullable/unknown | 建議 enum：field、dungeon、floor、boss_room、town、siege、hidden、event、instance、unknown |
| `floor` | 是 | structured metadata | 只有來源明示單一樓層才填；範圍不是單一 floor |
| `parentMap` | 是 | relation | MapRef/null；不從名稱層級推測 |
| `childMaps` | 是 | derived relation summary | 由 parent relations 反向產生 |
| `navigation` | 是 | relation summary | NavigationEntryRef[] |
| `navigationGroups` | 是 | metadata relation | NavigationGroupRef[]，不等於 RegionRef |
| `region` | 是 | unresolved placeholder | 本階段固定 null；不得建立 Region ID |
| `spawnPools` | 是 | relation summary | SpawnPoolRef[] |
| `monsterPool` | 是 | derived | 非 Boss 候選 MonsterRef[] |
| `bossPool` | 是 | derived | Boss 候選 MonsterRef[] |
| `availability` | 是 | canonical/derived | open、conditional、hidden、unavailable、unknown；須有證據 |
| `verification/version/entityRef/relations` | 是 | metadata | 共通模型 |

## 5. Navigation model

### NavigationGroup

NavigationGroup 是 UI／入口組織 metadata，擁有 group key、label、entries 與 display order。它：

- 不擁有 Monster pool。
- 不代表地理 Region。
- 不可被 CardSet key 或 Wiki Region key取代。
- 可包含尚非 `DB.maps` 的 destination；該 destination 不是 MapRef。

### NavigationEntry

至少包含：

- `navigationId`：未來 Schema 定義的穩定 metadata ID，不得用陣列 index。
- `label`：顯示文字。
- `destinationType`：map、town、entry、external、unknown。
- `mapRef`：只有 resolved `DB.maps` target 才填。
- `legacyValue`：保留原 `v`。
- verification 與 version。

本契約不在 C1 建立 navigationId 或 town identity。

## 6. Floor、parent 與 child

- 單一 floor 只有來源能唯一證實才使用整數或 structured floor code。
- `2~10 樓` 是範圍 label，不是 floor 2，也不自動對應一個 Map。
- parent/child 必須由明確 mapping／source rule建立，不從 `pride_` 字串或中文名稱直接推導正式 Relation。
- 樓層集合若需要 Entity，應在未來評估 MapGroup，而非假裝 Region。

## 7. Spawn Pool

`DB.maps[mapId]` 是基礎候選 pool，不是完整實際 spawn probability。建議模型：

```json
{
  "spawnPoolId": "existing-or-assigned-in-C2",
  "mapRef": { "entityType": "map", "entityId": "silver_knight" },
  "entries": [],
  "poolType": "base",
  "selectionRule": "runtime_defined",
  "conditions": [],
  "verification": {}
}
```

- `MonsterPool`：非 Boss candidates。
- `BossPool`：`isBoss=true` candidates。
- 同一 Monster 可出現在多 Map。
- array 中存在 ID 只表示候選成員，不代表均等權重或必定生成。
- 純 Boss map、任務條件、攻城、裂痕、追蹤、冷卻、機率與房間狀態由 Spawn／Mechanics records 表達。
- runtime instance UID、current HP、出生時間不進 Map Dataset。

## 8. Region boundary

Region 是 System Domain 的上層地理 Entity candidate，目前 identity 未定案。C1 固定規則：

- `region` 為 null／unresolved。
- `MAP_REGIONS` 17 組是 NavigationGroup，不升級為 Region。
- `CARD_REGIONS` 16 組是 CardSet，不升級為 Region。
- Wiki `REGIONS_DATA` 16 組是 legacy display grouping，不升級為 Region。
- 未來 Region 契約可用 RegionRef 關聯 Map，但不得改寫 mapId。

## 9. Canonical 與 derived

Canonical：mapId、經驗證 displayName、mapType、floor、availability、version、verification。

Relation-owned：parentMap、SpawnPool、NavigationEntry、未來 RegionRef。

Derived：childMaps、monsterPool、bossPool、Monster count、是否含 Boss、CardSet membership summaries。

## 10. Verification 與 unresolved

沿用 Monster Contract 的 Verification model。Map label 可是 Code／Generated；Wiki-only location 保持 Unknown。Navigation missing target 不使整個 Map Dataset失敗，但 navigation Dataset 應 partial／review_required。

不得猜測 Map、Region、parent、floor、availability 或 navigation destination type。找不到 target 時保留 legacyValue、label、sourceLocation、candidates 與 unresolved/missing_target。

## 11. Semantic diff

- mapId matching 不依賴 label。
- spawn pool membership 改變是 relation semantic change。
- navigation order 通常是 display metadata；只有契約明定有遊戲語意時才發布。
- label formatting、空白與括號字形不應產生 Map add/remove。
- Region unresolved 狀態改為 resolved 是 relation change，不是 Map identity change。

## 12. Stage C2 前置問題

- Map Schema 是否把 NavigationGroup／NavigationEntry 分離成獨立 metadata definitions。
- 18 個 town navigation values 的 destination type。
- `DB.maps` array 是否允許重複 Monster ID，以及重複的語意。
- SpawnPool ID 的受版本控制 assignment 規則。
- 純 Boss map 與 conditional spawn 的抽取邊界。
