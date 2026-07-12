# 製作與配方百科 Phase 1 實作計畫

## 1. 目標與正式契約

在不破壞現有 wiki 行為的前提下，將目前直接嵌在 `wiki.html` 的製作資料整理成可維護的資料層與索引層，為後續模組化準備。

Phase 1 的正式資料模型、ID、索引、成本與 unresolved 規則以 [DATA_CONTRACT.md](DATA_CONTRACT.md) 為準。本計畫不得另行定義與其衝突的契約。

原則：

- 保留目前 UI 外觀與主要互動方式。
- 先外部化資料與建立索引，再逐步接線。
- 不自行補造未驗證的遊戲資料。
- 不使用中文名稱建立任何正式關聯。
- 所有缺失關聯明確標記 unresolved。

## 2. Phase 1 範圍

### 2.1 包含

- 將 `CRAFT_DATA` 拆為可獨立載入的 `recipes.json`、`npcs.json`、`items.json`、`drops.json`。
- 建立依 recipe、NPC、成品與 requirement 查詢的索引。
- 保留 NPC 切換、搜尋、配方詳情、成品／技能書物品查看、材料來源、樹狀圖與金幣總計。
- 支援 `tab`、`npc`、`search`、`recipe`、`item`、`material` URL 狀態。
- 支援 unresolved Item/Npc stub。
- 保留跨 NPC 的同成品配方。
- 正確處理非 1 產量配方與循環防護。
- 必要資料載入失敗時回退至舊 `CRAFT_DATA`。

### 2.2 不包含

- 重寫 wiki 版型或大規模 UI 重構。
- 改變既有 CSS class 與主要操作流程。
- 完整任務、地區或技能 entity 百科。
- 使用名稱猜測缺少的 ID、來源或關聯。
- 一次拆分所有百科模組。

## 3. 正式 ID 規格

### 3.1 Item ID

- 正式 item ID 直接沿用現有遊戲資料 ID，例如 `wpn_*`、`acc_*`、`arm_*`、`mat_*`、`bk_*`、`mem_*`、`pet_*`、`item_*`、`new_item_*`。
- 不增加 `item_` 第二層包裝；例如使用 `acc_ring_magic`，不使用 `item_acc_ring_magic`。
- `id` 是正式關聯鍵；`sourceId` 只在跨來源追蹤時選用。
- 不使用中文名稱或陣列索引作 ID，排序不得改變 ID。

### 3.2 Recipe ID

固定格式：

```text
recipe_<完整 npcId>_<完整 resultId>_<variant>
```

範例：

```text
recipe_npc_finn_hlm_silver_01
recipe_npc_falin_hlm_silver_01
```

規則：

- 每份配方有獨立 ID。
- 同 NPC/result 目前只有一份時使用 `01`。
- 未來的第二份配方必須由受版本控制的 mapping 指定 variant。
- variant 不得由陣列位置或排序自動生成。
- 重複 recipe ID 時驗證失敗。
- 跨 NPC 同成品配方不得合併。

### 3.3 其他 ID

- NPC 沿用既有 `npc_*` ID。
- equipment entity 沿用 `EQUIP_DATA` ID。
- skill、monster、region 只有在可驗證時才建立正式 entityRef；否則保持 null/unresolved。

## 4. Recipe 與貨幣模型

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

- 舊 `result` 轉為 `{itemId, quantity}`；quantity 來自 `yield`。
- 舊 `req` 轉為 requirements。
- 舊 `{id: "gold", cnt: N}` 從 requirements 移除並轉為 `currencyCost`。
- Phase 1 固定使用可擴充的 `currencyCost`，currency 為 `gold`。
- 無金幣費用時 amount 為 0。
- 同一舊配方若有兩筆 gold requirement，驗證失敗，不可相加。
- gold 不進入 items.json、材料來源查詢或怪物掉落關聯。

## 5. Yield 與成本公式

```text
craftCount = ceil(targetQuantity / result.quantity)
requiredMaterial = requirement.quantity * craftCount
requiredGold = currencyCost.amount * craftCount
actualOutput = result.quantity * craftCount
surplus = actualOutput - targetQuantity
```

- 中間材料可製作時，對其需求量遞迴套用相同公式。
- 每次展開必須有 cycle guard。
- 不得假設 yield 為 1，也不作小數分攤。
- 樹狀圖顯示目標數量、製作次數、實際產量及多餘數量。

目前 4 筆非 1 yield 驗收案例：

| NPC | 成品 | yield |
| --- | --- | ---: |
| `npc_narupa` | `wpn_30` | 10 |
| `npc_narupa` | `wpn_5` | 100 |
| `npc_elf` | `new_item_169` | 20 |
| `npc_elf` | `new_item_170` | 20 |

## 6. Item、EntityRef 與技能書

### 6.1 Item

- `id`、`name`、`itemType`、`entityRef`、`linkStatus`、`dataStatus` 依正式資料契約。
- 能以既有 ID 對應 `EQUIP_DATA.category=equipment` 時，equipment entityRef 使用同一 ID。
- 不只依 ID 前綴或中文名稱猜測 itemType/entityRef。

### 6.2 Unresolved Item stub

缺少 `ITEMS_DB` 記錄時允許：

```json
{
  "id": "原始既有 ID",
  "name": null,
  "itemType": "unknown",
  "entityRef": null,
  "linkStatus": "unresolved",
  "dataStatus": "stub"
}
```

- 適用於已知 9 個缺 item 成品、18 個缺 item requirement 及未來同類資料。
- UI 顯示原始 ID 與「資料尚未收錄」。
- 不提供百科跳轉，不補造名稱。

### 6.3 技能書

目前 14 個技能書只有 item ID，沒有可驗證 skill entity ID：

- 保留技能書 Item，`itemType=skillbook`。
- `entityRef=null`、`linkStatus=unresolved`。
- UI 顯示「技能資料關聯尚未建立」。
- 可保留以 item ID 查看技能書物品，但不宣稱已連到 skill entity。
- 不把 `bk_*`／`mem_*` 當作 `skill_*`，不以中文名稱猜測。

## 7. NPC 資料、排序與搜尋

### 7.1 NPC stub

`npc_mystic_mage` 缺少 `NPC_INFO` 時建立：

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

UI 顯示 ID 與「NPC 資料尚未收錄」，不補造名稱或地區，也不隱藏配方。

### 7.2 排序與完整性

- `NPC_INFO` 與 `CRAFT_RECIPES` 是資料來源。
- `NPC_ORDER` 只作排序 metadata。
- 先顯示 `NPC_ORDER` 中有配方的 NPC。
- 有配方但未列於 `NPC_ORDER` 的 NPC 追加於後，按 NPC ID 穩定升冪排序。
- 搜尋掃描所有有配方的 NPC。

18 個漏列 NPC 必須納入驗收：

```text
npc_bamut, npc_bartel, npc_david, npc_flame_aide, npc_flame_shadow,
npc_flame_smith, npc_herbert, npc_ibelbin, npc_imp, npc_kororanz,
npc_kupu, npc_lentis, npc_lumiel, npc_moliya, npc_mystic_mage,
npc_norse, npc_sebas, npc_tas
```

## 8. SourceRecord 與 region

- `sourceStatus`：`verified`／`unresolved`／`unknown`。
- `sourceType`：`monster_drop`／`shop`／`quest`／`craft`／`exchange`／null。
- 現有 `DROPS_DB` 只提供怪物名稱、機率與地點文字，沒有可靠 monster ID。
- 保留 `monsterNameText`、`rate`、`locationTexts`，`monsterId=null`。
- 有 legacy drop record 時可標為 monster_drop，但 sourceStatus 為 unresolved。
- 沒有來源資料時 sourceStatus 為 unknown，不推測其他管道。
- 固定空狀態文案：「尚未在目前資料中找到可驗證的取得來源。」
- `NPC_INFO.loc` 只轉為 `locationText`；沒有可驗證資料時 `regionId=null`。

## 9. 正式索引

不得再使用 `resultId -> 單一 recipe`。至少建立：

```text
recipesById: Map<recipeId, Recipe>
recipesByNpcId: Map<npcId, Recipe[]>
recipesByResultId: Map<itemId, Recipe[]>
recipesByRequirementId: Map<itemId, Recipe[]>
itemsById: Map<itemId, Item>
npcsById: Map<npcId, Npc>
sourcesByItemId: Map<itemId, SourceRecord>
```

- 即使 result 只有一份配方，`recipesByResultId` 的值仍是陣列。
- 同成品的跨 NPC 配方全部保留。
- 陣列依 recipe ID 做決定性排序；排序不生成 ID。
- 配方樹與成本計算必須選定 recipe ID，不得任取第一筆。

## 10. JSON 載入與 fallback

載入順序：

1. `recipes.json`
2. `npcs.json`
3. `items.json`
4. `drops.json`
5. 可選的 mappings／regions

- 建議使用 `Promise.allSettled`。
- recipes、npcs、items 是必要檔；任一載入或解析失敗時回退舊 `CRAFT_DATA`。
- drops、mappings、regions 是可選檔；失敗時保持 unresolved/unknown，不中斷主要流程。
- 使用 GitHub Pages 相容相對路徑，例如 `./data/craft/recipes.json`。
- fallback 顯示：「目前資料載入失敗，已切換回舊版製作資料顯示。」
- 舊資料也不可用時顯示空狀態，不能白畫面。

## 11. 事件與 URL 規格

### 11.1 事件

- 固定父容器建議為 `craft-wiki-root`。
- `bindCraftWikiEvents()` 初始化一次，以 `data-events-bound=true` 防止重複綁定。
- 新按鈕使用 `type=button`，禁止新增 inline onclick。
- 支援 `open-recipe`、`open-item`、`open-material`、`select-npc`、`open-drop-source`、`toggle-recipe-tree`。
- 無效 ID 必須記錄錯誤並顯示提示，不可靜默失敗或改用名稱猜測。

### 11.2 URL

- 支援 `tab`、`npc`、`search`、`recipe`、`item`、`material`。
- `tab` 優先；craft 參數只在 craft 分頁生效。
- 使用者主動點擊用 pushState；內部同步及搜尋輸入用 replaceState。
- popstate 與重新整理使用同一套 state restore。
- 先恢復 tab，再恢復 npc/search，最後恢復 recipe/item/material 詳情。
- 關閉詳情移除對應 query。
- 無效 ID 顯示 invalid/unresolved 狀態，不以名稱猜測。

## 12. Phase 1B 驗證要求

- recipe、item、NPC ID 各自唯一。
- result/requirement itemId 存在，或有 unresolved Item stub。
- npcId 存在，或有 unresolved Npc stub。
- result.quantity 與 requirement.quantity 為正整數。
- currencyCost.amount 為非負有限數值，currency 為 gold。
- requirements 不可包含 gold。
- 同一舊配方不可有兩筆 gold requirement。
- 同一 Recipe 不可有重複 requirement itemId，不可靜默合併。
- entityRef 有效，或明確 null/unresolved。
- 配方圖無循環並具 cycle guard。
- recipe variant 不由陣列位置產生。
- 所有輸出具決定性與固定排序。
- 7 組跨 NPC 同成品配方全部保留。
- 18 個漏列 NPC 全部保留並可搜尋。
- 4 筆非 1 yield 配方通過向上取整與成本案例。
- 9 個缺成品 item、18 個缺 requirement item、`npc_mystic_mage` 依 stub 契約輸出。
- 技能書、monster、region 不得出現推測性 entity ID。

## 13. Rollback 與驗收

- 新資料層以 feature flag 控制，預設關閉。
- 舊 `initCraftWiki()` 與 `CRAFT_DATA` 保留為 fallback。
- 只有新資料完整載入、驗證、baseline 回歸及 fallback 測試全部通過後，才可考慮移除舊資料。
- 回退時關閉 feature flag、停用新入口並重新使用舊資料路徑。

驗收至少包含：

- NPC 切換、完整 NPC 搜尋與追加排序。
- 配方搜尋、詳情、材料來源及空狀態。
- 跨 NPC 同成品配方。
- 配方樹、非 1 yield、總金幣與 cycle guard。
- unresolved Item/Npc/skill/monster/region 顯示。
- 深連結、重新整理、上一頁、下一頁、無效 query 與關閉詳情。
- 動態重繪後按鈕有效且事件不重複註冊。
- 重跑 `BASELINE_TEST_REPORT.md` 全部項目。
- Console 無未處理 Error、Network 無 404、所有必要 JSON 回應成功。

## 14. Phase 1 最終界線

Phase 1 包含製作資料外部化、正式索引、NPC 完整性、搜尋、配方與材料詳情、來源顯示、yield 正確的配方樹／成本，以及 URL 狀態。

Phase 1 不包含完整地區、任務、技能 entity 或跨百科關聯導覽。14 個技能書、monster ID、region ID 與無來源資料可保持 unresolved；只要符合 [DATA_CONTRACT.md](DATA_CONTRACT.md) 的 stub／狀態契約，就不阻擋 Phase 1B 資料骨架實作。
