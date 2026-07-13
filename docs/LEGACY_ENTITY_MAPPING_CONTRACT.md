# Legacy Entity Mapping 契約

## 1. 定位與邊界

本契約定義《放置天堂整合百科》如何把既有顯示文字、舊存檔 key、舊 URL 與外部整理來源安全地轉接至**現有正式 Entity ID**。Mapping 是 legacy／外部來源的相容層，不是 Entity 主資料，也不得成為 canonical lookup 的必要條件。

本階段只定義契約，不建立 mapping JSON、Schema、generator、validator、repository 或新 ID。不得由中文名稱、陣列位置、模糊比對或 hash 創造 monster、map、item 或 card identity。

### 1.1 核心原則

- canonical Entity 一律由所屬 Domain 的既有 ID 識別。
- `sourceValue` 永遠保留原文；normalized value 只能作候選搜尋 metadata。
- mapping 可解決 legacy key，不得反向讓 canonical Entity 依賴顯示名稱。
- 唯一且有證據的結果才能 `resolved`。
- `ambiguous`、`conflict`、`unresolved` 不得回傳第一個候選。
- 找不到正式 ID 時保留來源、候選、證據與狀態，不補造 ID。
- mapping 與 Entity、Relation 一樣受版本範圍與 semantic diff 規則約束。

## 2. Mapping record

概念模型：

```json
{
  "id": "mapping_drop_owner_game_0001",
  "mappingType": "drop_owner_to_monster_id",
  "sourceScope": "game:MOB_DROPS",
  "sourceValue": "顯示名稱",
  "normalizedValue": "顯示名稱",
  "target": {
    "entityType": "monster",
    "entityId": "existing_monster_id"
  },
  "candidates": [],
  "status": "resolved",
  "matchMethod": "exact_name",
  "sourceLocation": "js/01-drops-config.js",
  "evidence": [
    {
      "evidenceType": "code",
      "sourceLocation": "js/00-data.js#DB.mobs"
    }
  ],
  "versionScope": {
    "validFrom": null,
    "validTo": null
  },
  "replacementMappingId": null,
  "notes": []
}
```

### 2.1 必要欄位

| 欄位 | 規則 |
|---|---|
| `id` | 受版本控制的穩定 mapping ID；不得含 sourceValue 或陣列索引 |
| `mappingType` | 本契約允許的 mapping 類型 |
| `sourceScope` | 來源命名空間，例如 `game:MOB_DROPS`、`wiki:REGIONS_DATA`、`save:cardDex` |
| `sourceValue` | 原始值，必填且不得被正規化結果覆蓋 |
| `normalizedValue` | 可選搜尋 metadata；不得作 identity |
| `target` | resolved target EntityRef；狀態不允許時為 `null` |
| `candidates` | 候選 EntityRef 與各自 evidence；ambiguous／conflict 必填 |
| `status` | MappingStatus |
| `matchMethod` | MatchMethod |
| `sourceLocation` | 可定位來源；resolved 必填 |
| `evidence` | 支持 mapping 的證據；resolved 必須非空 |
| `versionScope` | 適用版本範圍；未知可為 null，不得偽造版本 |
| `replacementMappingId` | deprecated 時的替代 mapping；無替代時 notes 必須說明 |
| `notes` | unresolved 原因、人工判斷與相容限制 |

`target` 使用 WikiDataCore `EntityRef` 語意。跨 Domain 時可包含 `domain`；最低要求仍是 `entityType + entityId`。

## 3. Mapping 類型

| mappingType | source | target | 允許用途 |
|---|---|---|---|
| `monster_name_to_id` | `DB.mobs[].n` | MonsterRef | 建立 canonical 名稱索引的稽核基線 |
| `drop_owner_to_monster_id` | `MOB_DROPS` owner | MonsterRef | 將 name-owned drop table 轉成 ID relation |
| `wiki_monster_to_monster_id` | Wiki monster name | MonsterRef | 匯入 Wiki legacy snapshot |
| `craft_monster_to_monster_id` | `monsterNameText` | MonsterRef | Craft source record 轉接 |
| `map_label_to_map_id` | 導航 map label | MapRef | 顯示 label 轉既有 `DB.maps` key |
| `wiki_location_to_map_id` | Wiki location text | MapRef | Wiki location 轉接；無唯一結果則 unresolved |
| `legacy_card_key_to_monster_id` | `CARD_MOB_INFO`／cardDex name key | MonsterRef | 卡片主體與舊存檔相容 |
| `legacy_card_key_to_card_candidate` | legacy card name／runtime item key | 未來 CardRef candidate | 只保留候選；Card ID 未定案時不得 resolved |
| `item_name_to_item_id` | Wiki／legacy item name | ItemRef | legacy item 顯示名稱轉既有 item ID |
| `alias_to_entity_id` | 經人工驗證的舊名／別名 | typed EntityRef | 搜尋、舊 URL 與歷史資料轉接 |

不同 `sourceScope` 的相同文字是不同 mapping record，不可因 sourceValue 相同而合併來源證據。

## 4. Mapping 狀態

| status | 精確語意 |
|---|---|
| `resolved` | target 存在、類型相容、來源範圍明確、比對唯一，且有 sourceLocation 與 evidence。`exact_name` 還要求目標集合名稱唯一 |
| `unresolved` | 有原始值但證據不足、沒有安全候選，或正式目標 identity 尚未建立 |
| `ambiguous` | 至少兩個合理候選且無證據能唯一選定；不得自動選第一筆 |
| `missing_target` | mapping 指向或引用一個預期既有 ID，但該 Entity 在適用版本不存在 |
| `deprecated` | mapping 不再供新資料使用，但為歷史資料、舊 URL 或版本查詢保留；不代表可刪除 |
| `conflict` | 兩個以上來源對同一 scope/sourceValue 提供互斥 resolved claim；保留所有候選與來源，不依優先序靜默覆蓋 |
| `compatibility_only` | 只允許舊存檔、舊 URL 或 migration 使用；不得輸出成 canonical EntityRef 或新資料的正式關聯 |

### 4.1 狀態轉換

- `unresolved`／`ambiguous`／`conflict` 只有新增可定位證據後才能改為 `resolved`。
- `resolved` target 消失時應成為 `missing_target` 或受版本限定的 `deprecated`，不可刪除紀錄。
- `compatibility_only` 可解析舊 key，但 canonical Dataset 不得保存該 mapping ID 作外鍵。
- 狀態變更屬 semantic change，必須由版本控制記錄。

## 5. Match method

| matchMethod | 規則 |
|---|---|
| `exact_id` | source 本身就是現有正式 ID，且 target 存在 |
| `exact_name` | sourceValue 與 canonical label 完全相等，且目標集合只有一筆該名稱 |
| `verified_alias` | alias 已由人工證據明確連到單一 target |
| `normalized_display` | 只經本契約安全顯示正規化後唯一相等；需保存原值、規則與 collision check |
| `manual_mapping` | 由人工依來源證據指定，不可只依肉眼相似 |
| `historical_mapping` | 由歷史快照／舊版本證明，必須有 versionScope |
| `unresolved` | 尚無安全 match method |

禁止以模糊比對、編輯距離、拼音、相似字串、刪除語意詞或「第一個搜尋結果」建立 resolved mapping。

## 6. 正規化政策

正規化有兩個模式：

- **search normalization**：只增加搜尋召回率，結果仍是 candidates。
- **mapping normalization**：只有下表標記「條件允許」且 collision check 通過時，才能使用 `normalized_display`；仍需證據。

| 規則 | 搜尋 | 正式 mapping | 限制 |
|---|---|---|---|
| trim | 可 | 條件允許 | 不改 sourceValue |
| Unicode NFC | 可 | 條件允許 | 優先 NFC；NFKC 需記錄規則 |
| 全形／半形 | 可 | 條件允許 | 只處理字形寬度，不改語意 |
| 連續空白壓成單一空白 | 可 | 條件允許 | 不可刪除詞間必要分隔 |
| 括號樣式 `（）`／`()`／`【】` | 可 | 條件允許 | 只換括號字形，不刪內容 |
| 標點差異 | 可 | 不自動 | 可能區分變體或技能／物品種類 |
| HTML entity decode | 可 | 條件允許 | 必須是標準、無歧義解碼 |
| 大小寫 | 可 | 僅已定義 case-insensitive ID／label | 中文無影響；ID 預設 case-sensitive |
| 前後裝飾符號 | 可 | 不自動 | emoji、星號可能是狀態或稀有度 |
| 羅馬數字／阿拉伯數字 | 可 | 不自動 | 樓層、代數與型號可能改變 identity |
| 繁簡轉換 | 可作 candidates | 禁止自動 | 必須 verified_alias／manual_mapping |
| 刪除括號內容 | 不建議 | 禁止 | 常代表怪物變體、顏色、性別或版本 |
| 刪除前綴／後綴 | 不建議 | 禁止 | 常代表區域、Boss、變體或 item 類型 |

任何規則造成兩個原值落入同一 normalized value 時，必須報 `unsafe_name_normalization`，不得 resolved。

## 7. Mapping identity 決策

正式採用 **B：受版本控制的 mapping ID**。

格式：

```text
mapping_<mappingTypeToken>_<sourceScopeToken>_<variant>
```

規則：

- token 使用契約列舉的 ASCII slug，不含 sourceValue。
- `variant` 是受版本控制的穩定 ASCII token；不得由陣列索引、排序或名稱 hash 自動成為正式 ID。
- 新 mapping ID 一經發布不得因 sourceValue 改名而重用給另一筆 mapping。
- sourceScope + sourceValue + versionScope 另設唯一性驗證，不取代 `id`。

方案比較：

| 方案 | 判定 |
|---|---|
| A. table key + sourceValue | 不採用；中文與名稱變更會污染 identity，且不利版本差異 |
| B. 受版本控制 ID | 採用；可審查、可 deprecated、可保留 replacement，不依賴名稱 |
| C. deterministic hash | 只允許作 runtime cache key；不透明、碰撞與 canonicalization 變更風險使其不適合作正式 ID |

## 8. Monster、Map 與 Item 的解析規則

### 8.1 Monster

1. 先以 exact ID 驗證 canonical input。
2. legacy name 只能在 `DB.mobs[].n` 全集合唯一時使用 `exact_name`。
3. 未來出現重名時，原 exact-name mapping 自動失去唯一性，validator 必須報 ambiguous；不得保留「先出現者」。
4. 無 map pool、無 drop table 不是 mapping failure；只要 monster ID 存在仍可 resolved。

### 8.2 Map／Region

- 本階段 Map ID 僅指現有 `DB.maps` key。
- `MAP_REGIONS` navigation group、`CARD_REGIONS.key`、Wiki `REGIONS_DATA.key` 是不同 identity 空間。
- navigation entry 的 `v` 若不在 `DB.maps`，在本契約下是 `missing_target` candidate；可能是 town/navigation destination，但不得冒充 MapRef。
- Wiki location 可能是 map label、樓層集合、分區描述或既有 map key；只有唯一 target 才 resolved。
- 本階段不建立通用 Region ID。

### 8.3 Item

- item target 必須是現有 `DB.items` ID。
- exact-name 只在完整適用 item 集合中名稱唯一時 resolved。
- 看似 ID 的 Wiki 顯示字串若 target 不存在，仍是 unresolved；不得把字串本身當 target。
- runtime 動態 item 必須在其建立程式與載入順序可驗證後，才能以 `exact_id`／`manual_mapping` 連結。

## 9. Card 與存檔相容契約

下列 identity 必須分離：

| 現況 | identity 性質 |
|---|---|
| `player.cardDex[monsterName]` | 玩家存檔 legacy key |
| `CARD_MOB_INFO[monsterName]` | runtime 卡片主體索引 key |
| `card_<tier>_<monsterName>` | runtime item ID，含名稱且不適合作未來 canonical Card ID |
| Monster ID | 現有 canonical Monster identity |
| 未來 Card ID | 尚未定案，不得在 B0 建立 |

規劃規則：

1. 舊 cardDex name key 先以 `legacy_card_key_to_monster_id` 唯一解析至 MonsterRef。
2. 未來 Card subject 可引用 MonsterRef，但 Monster 與 Card 仍不是同一 Entity。
3. 三階卡片可規劃為 CardVariant 或 Item specialization；須由 Card 契約決定，B0 不定案。
4. 舊存檔讀取時只能透過 `compatibility_only` mapping 遷移；原 key 與值在失敗時保留。
5. 新存檔是否保存 Card ID／Monster ID，待 Card 與 Save 契約共同決定。
6. 名稱變更時以 mapping replacement／historical mapping 保持舊 key 可解析，不搬移後直接刪除舊 key。
7. ambiguous、conflict、missing target 時將舊值放入可恢復 quarantine／unresolved bucket，不丟棄、不合併到第一候選。
8. 靜態 Card Dataset 不得包含玩家分數、tier 進度、背包張數或 localStorage 值。

`legacy_card_key_to_card_candidate` 在 Card identity 尚未建立前全部保持 unresolved；不得以 runtime card item ID假裝未來 Card ID。

## 10. 未來 validator 規則

- target Entity 必須存在且 target type 與 mappingType 相容。
- mappingType、status、matchMethod 必須是合法 enum。
- `id`、sourceScope、sourceValue 不得為空。
- 同 sourceScope + sourceValue + overlapping versionScope 不得有兩個 resolved target。
- ambiguous 必須有至少兩個不同 candidates。
- conflict 必須保留互斥 candidates 與各自 evidence。
- resolved 必須有唯一 target、sourceLocation 與至少一筆 evidence。
- deprecated 必須有 replacementMappingId 或 notes 理由。
- compatibility_only 不得輸出為 canonical Dataset relation。
- 正規化前必須檢查 collision。
- alias graph 不得有 cycle。
- versionScope 的 from/to 順序與重疊必須合法。
- legacy key 未解析不得被靜默丟棄。

Diagnostics：

- `duplicate_mapping`
- `ambiguous_mapping`
- `missing_mapping_target`
- `conflicting_mapping`
- `unsafe_name_normalization`
- `alias_cycle`
- `stale_mapping`
- `unsupported_mapping_type`
- `unresolved_legacy_key`
- `compatibility_mapping_required`

## 11. WikiDataCore `mappings` repository 規劃

Repository 只負責 mapping records，不操作 DOM、不修改 Domain Dataset。

共通 API：

- `getById(id)`
- `getAll(options?)`
- `has(id)`
- `search(query, options?)`
- `getStatus(id)`
- `getValidationErrors(id?)`

專用 API：

- `resolve(mappingType, sourceValue, options)`
- `getCandidates(mappingType, sourceValue, options?)`
- `getByTarget(entityRef)`
- `getAliases(entityRef)`
- `getLegacyKeys(entityRef)`
- `getUnresolved(mappingType?)`
- `getConflicts()`

行為契約：

- `resolve` 只有在 scope／version 條件下恰有一筆 `status=resolved` 時回傳 EntityRef。
- ambiguous、conflict、unresolved、missing_target、compatibility_only 不回傳 canonical EntityRef。
- 相容遷移必須顯式傳入 `allowCompatibility: true`，且回傳結果附 compatibility metadata。
- mapping failure 預設回 structured result，不使整個 Monster Dataset 載入失敗；只有契約標記 `required relation` 時由呼叫端升級為驗證錯誤。
- canonical repository 的 `getById`／relation lookup 不得呼叫 mappings repository 才能成立。
- 搜尋可以使用 alias 與 normalizedValue，但搜尋命中不等於 resolved mapping。

## 12. Semantic diff 與版本規則

- record 排序、JSON formatting、normalizedValue cache 改變不是玩家可見 semantic change。
- target、status、mappingType、versionScope、replacement 或 evidence 結論改變是 semantic change。
- label 改名但 Entity ID 不變時，保留 historical／compatibility mapping；不得建立新 Entity。
- mapping conflict 必須成為審查項目，不直接產生玩家更新內容。

## 13. B0 結論

Mapping 是受版本控制、可驗證、失敗安全的 compatibility layer。正式方案使用穩定 mapping ID，sourceValue 永遠只是來源資料；canonical Entity lookup 與新 Dataset 關聯均維持 ID-first。
