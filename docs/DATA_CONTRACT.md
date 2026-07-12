# 製作與配方百科資料契約

## 1. 契約狀態與適用範圍

本文件是「製作與配方百科 Phase 1」的正式資料契約，自 Phase 1A.5 起生效。Phase 1B 的資料生成、驗證、索引與後續 UI 接線都必須遵守本文件。

本契約適用於：

- `recipes.json`
- `items.json`
- `npcs.json`
- `drops.json`
- 製作百科資料索引
- 配方樹與成本計算
- unresolved item、NPC、skill、monster 與 source 狀態

通用規則：

- 正式關聯一律使用既有、可驗證且穩定的 ID。
- 中文名稱只作顯示，不作 ID、外鍵、mapping key 或 fallback 關聯。
- 不使用陣列索引建立 ID。
- 不因排序改變 ID。
- 不從中文名稱推測 item、NPC、skill、monster 或 region ID。
- 無法驗證時必須保留既有 ID 並明確標記 unresolved，不得虛構資料。

## 2. 正式 item ID 契約

### 2.1 決策

正式 item ID 直接沿用現有遊戲資料 ID，例如：

```text
wpn_*, acc_*, arm_*, mat_*, bk_*, mem_*, pet_*, item_*, new_item_*
```

不得增加第二層 `item_` 包裝。因此：

```text
正確：wpn_redflame_sword
錯誤：item_wpn_redflame_sword

正確：acc_ring_magic
錯誤：item_acc_ring_magic

正確：mat_unicorn_horn
錯誤：item_mat_unicorn_horn
```

### 2.2 欄位規則

- `id`：必填，使用現有資料 ID。
- `sourceId`：可選，只在資料來自另一個來源、需要追蹤原始 ID 時使用。
- `name`：顯示欄位，不參與關聯。
- 同一資料集合中的 item ID 必須唯一。
- `CRAFT_DATA`、`ITEMS_DB`、`EQUIP_DATA`、`DROPS_DB` 的關聯以既有 ID 完全相等比對。
- 不以名稱模糊比對修復缺失 ID。

## 3. 正式 recipe ID 契約

recipe ID 固定格式：

```text
recipe_<完整 npcId>_<完整 resultId>_<variant>
```

範例：

```text
recipe_npc_finn_hlm_silver_01
recipe_npc_falin_hlm_silver_01
```

規則：

- 每份配方必須有獨立 ID。
- NPC ID 與 result ID 必須完整保留，不移除既有前綴。
- 同 NPC、同成品目前只有一份配方時，variant 固定為 `01`。
- 未來同 NPC、同成品若出現第二份配方，variant 必須由受版本控制的 mapping 明確指定。
- 禁止依陣列位置或排序自動產生 variant。
- 重複 recipe ID 時驗證失敗，不得自動改名。
- 跨 NPC 的同成品配方全部保留，不得合併或只保留第一筆。

## 4. 正式資料模型

以下採 JSON Schema 風格描述。`null` 表示契約明確允許空值，不代表欄位可以省略。

### 4.1 Recipe

```json
{
  "id": "recipe_npc_finn_hlm_silver_01",
  "npcId": "npc_finn",
  "result": {
    "itemId": "hlm_silver",
    "quantity": 1
  },
  "requirements": [
    {
      "itemId": "mat_example",
      "quantity": 5
    }
  ],
  "currencyCost": {
    "currency": "gold",
    "amount": 1000
  },
  "description": null,
  "isSpecial": false,
  "specialNote": null
}
```

欄位契約：

- `id: string`：正式 recipe ID。
- `npcId: string`：指向 Npc；允許指向 unresolved NPC stub。
- `result.itemId: string`：指向 Item；允許指向 unresolved item stub。
- `result.quantity: integer`：單次製作產量，必須大於 0。
- `requirements: Requirement[]`：單次製作消耗；不得包含 `gold`。
- `requirements[].itemId: string`：指向 Item；允許指向 unresolved item stub。
- `requirements[].quantity: integer`：單次消耗量，必須大於 0。
- `currencyCost: CurrencyCost`：單次製作費用；無費用時仍使用 amount `0`。
- `description: string | null`。
- `isSpecial: boolean`。
- `specialNote: string | null`；`isSpecial=true` 時應有內容。

### 4.2 Item

一般 item：

```json
{
  "id": "acc_ring_magic",
  "sourceId": null,
  "name": "魔法戒指",
  "itemType": "equipment",
  "entityRef": {
    "entityType": "equipment",
    "entityId": "acc_ring_magic"
  },
  "linkStatus": "resolved",
  "dataStatus": "complete"
}
```

unresolved item stub：

```json
{
  "id": "item_pride_dom_11",
  "sourceId": null,
  "name": null,
  "itemType": "unknown",
  "entityRef": null,
  "linkStatus": "unresolved",
  "dataStatus": "stub"
}
```

欄位契約：

- `id: string`：既有遊戲資料 ID，必須唯一。
- `sourceId: string | null`：可選追蹤欄位；不需要時為 null 或省略。
- `name: string | null`：stub 允許 null。
- `itemType: "equipment" | "skillbook" | "material" | "misc" | "unknown"`。
- `entityRef: EntityRef | null`。
- `linkStatus: "resolved" | "unresolved"`。
- `dataStatus: "complete" | "stub"`。

### 4.3 Npc

一般 NPC：

```json
{
  "id": "npc_finn",
  "name": "NPC 顯示名稱",
  "locationText": "既有地點文字",
  "regionId": null,
  "description": null,
  "linkStatus": "unresolved",
  "dataStatus": "complete"
}
```

unresolved NPC stub：

```json
{
  "id": "npc_mystic_mage",
  "name": null,
  "locationText": null,
  "regionId": null,
  "description": null,
  "linkStatus": "unresolved",
  "dataStatus": "stub"
}
```

欄位契約：

- `id: string`：既有 NPC ID，必須唯一。
- `name: string | null`。
- `locationText: string | null`：只作顯示，不生成 region ID。
- `regionId: string | null`：只有可驗證時才填入。
- `description: string | null`。
- `linkStatus: "resolved" | "unresolved"`。
- `dataStatus: "complete" | "stub"`。

### 4.4 EntityRef

```json
{
  "entityType": "equipment",
  "entityId": "acc_ring_magic"
}
```

- `entityType: "equipment" | "skill" | "monster" | "npc" | "region"`。
- `entityId: string`：必須能在對應 entity 資料集中驗證。
- 不能驗證時，Item 或其他擁有者的 `entityRef` 必須為 null，`linkStatus` 必須為 unresolved。

### 4.5 CurrencyCost

```json
{
  "currency": "gold",
  "amount": 50000
}
```

- Phase 1 固定採用可擴充的 `currencyCost`，不使用 `goldCost`。
- `currency` 在 Phase 1 固定為 `gold`。
- `amount` 必須是大於或等於 0 的有限數值。
- `gold` 不建立 Item，不進入 requirements、items.json、來源查詢或怪物掉落關聯。

### 4.6 SourceRecord

有 legacy 掉落記錄、但 monster entity 尚未連結：

```json
{
  "itemId": "mat_unicorn_horn",
  "sourceStatus": "unresolved",
  "sources": [
    {
      "sourceType": "monster_drop",
      "monsterId": null,
      "monsterNameText": "既有怪物名稱",
      "rate": 1.2,
      "locationTexts": ["既有地點文字"]
    }
  ]
}
```

沒有可驗證來源資料：

```json
{
  "itemId": "mat_unknown_example",
  "sourceStatus": "unknown",
  "sources": []
}
```

欄位契約：

- `itemId: string`：指向 Item。
- `sourceStatus: "verified" | "unresolved" | "unknown"`。
- `sources: Source[]`。
- `sourceType: "monster_drop" | "shop" | "quest" | "craft" | "exchange" | null`。
- `monsterId: string | null`。
- `monsterNameText: string | null`：legacy 顯示文字，不是關聯鍵。
- `rate: number | null`：沿用舊資料的百分比數值單位。
- `locationTexts: string[]`：顯示文字，不建立 region 關聯。

狀態語意：

- `verified`：來源類型及其正式 entity 關聯皆已驗證。
- `unresolved`：存在 legacy 來源記錄，但至少一個正式 entity 關聯尚未驗證。
- `unknown`：目前沒有可驗證來源記錄。

## 5. gold 轉換契約

舊資料：

```json
{"id": "gold", "cnt": 50000}
```

轉換後：

```json
{
  "currencyCost": {
    "currency": "gold",
    "amount": 50000
  }
}
```

規則：

- 從 `requirements` 移除 `gold`。
- 無 gold requirement 時，`currencyCost.amount` 為 `0`。
- 同一配方出現兩筆或以上 gold requirement 時驗證失敗，不可默默相加。
- gold 不進入 items.json、材料數量、來源查詢或怪物掉落資料。

## 6. yield、材料與成本公式

定義：

- `recipe.result.quantity`：單次製作產量。
- `requirements[].quantity`：單次製作消耗量。
- `currencyCost.amount`：單次製作費用。

若需要 `targetQuantity` 個成品：

```text
craftCount = ceil(targetQuantity / recipe.result.quantity)
requiredMaterial = requirement.quantity * craftCount
requiredGold = recipe.currencyCost.amount * craftCount
actualOutput = recipe.result.quantity * craftCount
surplus = actualOutput - targetQuantity
```

規則：

- 中間材料可製作時，以該中間材料的需求量作為新的 `targetQuantity`，遞迴套用相同公式。
- 每次遞迴必須有 cycle guard。
- 不得假設 yield 永遠為 1。
- 不作小數分攤；製作次數一律向上取整。
- 配方樹必須顯示目標數量、需要製作次數、實際產出數量，以及可能的多餘數量。
- 同一 result 有多份 Recipe 時，呼叫端必須選定 recipe ID，不能由索引任意取第一筆。

目前 4 筆非 1 yield 驗收案例：

| NPC ID | result ID | 單次產量 |
| --- | --- | ---: |
| `npc_narupa` | `wpn_30` | 10 |
| `npc_narupa` | `wpn_5` | 100 |
| `npc_elf` | `new_item_169` | 20 |
| `npc_elf` | `new_item_170` | 20 |

## 7. unresolved item 與 NPC 契約

### 7.1 Item stub

缺少 `ITEMS_DB` 記錄時允許建立 unresolved stub，不使整批生成失敗。此規則適用於已知的 9 個缺 item 成品、18 個缺 item requirement，以及未來同類缺失。

UI 契約：

- 優先顯示 `name`。
- `name=null` 時顯示原始 `id`。
- 同時顯示「資料尚未收錄」。
- 不提供百科跳轉。
- 不自行補造中文名稱。

### 7.2 NPC stub

`npc_mystic_mage` 缺少 `NPC_INFO` 時允許建立 unresolved NPC stub，不隱藏其配方。

UI 契約：

- 顯示 NPC ID。
- 顯示「NPC 資料尚未收錄」。
- 不自行補名稱、地點或 region ID。

## 8. NPC 完整性、排序與搜尋契約

- `NPC_INFO` 與 `CRAFT_RECIPES` 是資料來源。
- `NPC_ORDER` 只作既有 UI 排序 metadata，不是完整性來源。
- 先依 `NPC_ORDER` 顯示其中存在配方的 NPC。
- 有配方但不在 `NPC_ORDER` 的 NPC 必須保留並追加在後。
- 追加 NPC 依 NPC ID 做穩定升冪排序。
- 缺少 `NPC_INFO` 的 NPC 以 stub 顯示，不得隱藏。
- 搜尋必須掃描所有有配方的 NPC，不得只掃描 `NPC_ORDER`。

18 個漏列 NPC 驗收集合：

```text
npc_bamut, npc_bartel, npc_david, npc_flame_aide, npc_flame_shadow,
npc_flame_smith, npc_herbert, npc_ibelbin, npc_imp, npc_kororanz,
npc_kupu, npc_lentis, npc_lumiel, npc_moliya, npc_mystic_mage,
npc_norse, npc_sebas, npc_tas
```

## 9. 技能書契約

目前 14 個技能書只有技能書 item ID，沒有可驗證的 skill entity ID。Phase 1 固定規則：

- 保留技能書 Item。
- `itemType: "skillbook"`。
- `entityRef: null`。
- `linkStatus: "unresolved"`。
- UI 顯示「技能資料關聯尚未建立」。
- 不將 `bk_*` 或 `mem_*` 假設為 `skill_*`。
- 不以中文名稱猜測 skill ID。
- 若裝備百科可依技能書 item ID 顯示物品，可保留「查看技能書物品」；不得宣稱已連到獨立 skill entity。

Phase 1 不宣稱完成技能實體跳轉。

## 10. 來源資料契約

- 現有 `DROPS_DB` 的 `mob` 轉為 `monsterNameText`。
- 現有 `maps` 轉為 `locationTexts`。
- `monsterId` 固定為 null，直到有可靠 ID mapping。
- 不從中文怪物名稱生成 monster ID。
- 有 legacy drop record 時，`sourceType` 可為 `monster_drop`，但 `sourceStatus` 必須為 `unresolved`，不能宣稱 entity link 已完整 resolved。
- 沒有 `DROPS_DB` 資料時使用 `sourceStatus: "unknown"`、空 sources，不推測為 shop、quest、craft 或 exchange。
- 缺少來源時 UI 固定顯示：「尚未在目前資料中找到可驗證的取得來源。」

## 11. 正式索引契約

不得再使用 `resultId -> 單一 recipe`。正式索引至少包含：

```text
recipesById: Map<recipeId, Recipe>
recipesByNpcId: Map<npcId, Recipe[]>
recipesByResultId: Map<itemId, Recipe[]>
recipesByRequirementId: Map<itemId, Recipe[]>
itemsById: Map<itemId, Item>
npcsById: Map<npcId, Npc>
sourcesByItemId: Map<itemId, SourceRecord>
```

規則：

- `recipesByResultId` 即使只有一份配方也必須保存陣列。
- 所有跨 NPC 同成品配方必須存在於陣列中。
- 陣列採決定性排序，建議依 recipe ID 升冪；排序不參與 ID 生成。
- 配方樹與成本計算必須以選定的 recipe ID 展開。

## 12. Phase 1B 驗證規則

驗證器至少必須檢查：

- recipe ID 唯一。
- item ID 唯一。
- NPC ID 唯一。
- result itemId 存在，或有 unresolved Item stub。
- requirement itemId 存在，或有 unresolved Item stub。
- npcId 存在，或有 unresolved Npc stub。
- requirement quantity 為正整數。
- result.quantity 為正整數。
- currencyCost.currency 在 Phase 1 必須為 `gold`。
- currencyCost.amount 為非負有限數值。
- recipe requirements 不可包含 `gold`。
- 同一舊配方不可出現兩筆 gold requirement。
- 同一 Recipe 不可有重複 requirement itemId；發現時必須報錯，不可靜默合併。
- EntityRef 必須能解析到有效 entity，否則 entityRef 為 null 且 linkStatus 明確為 unresolved。
- 配方圖必須檢查循環；發現循環時驗證失敗。
- recipe variant 不得由陣列位置或排序產生。
- 同 NPC/result 若有多份配方，必須存在受版本控制的 variant mapping。
- 跨 NPC 同 result 配方不得被合併或遺失。
- 所有輸出必須具決定性、固定排序，且相同輸入產生相同內容。
- 18 個漏列 NPC 必須保留並納入搜尋。
- 4 筆非 1 yield 配方必須通過向上取整、實際產量與成本計算案例。
- unresolved stub 不得取得虛構 name、entityRef、regionId 或 source。

## 13. 契約定案結論

Phase 1A 稽核提出的 item ID、recipe ID、gold、yield、unresolved stub、NPC_ORDER、recipeIndex 與技能書契約問題，已在本文件定案。Phase 1B 可依此開始規劃生成器、schema 與驗證器；技能、monster、region 的實體關聯仍可維持 unresolved，不構成資料骨架實作阻擋。
