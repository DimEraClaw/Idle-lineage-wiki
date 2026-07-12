# 製作百科 CRAFT_DATA 稽核（Phase 1A）

## 1. 稽核範圍與方法

- 稽核來源：`wiki.html` 內的 `CRAFT_DATA`、`EQUIP_DATA`、`NPC_ORDER`，以及製作百科相關函式。
- 稽核日期：2026-07-12。
- 本次只做靜態資料與程式依賴分析，未修改 `wiki.html`、CSS、JavaScript，亦未建立 JSON。
- 所有關聯比對均使用既有 ID 的完全相等比對。中文名稱只用來檢查同名或顯示，不作正式關聯鍵。
- 「材料」在本文件中定義為曾出現在任一配方 `req[].id` 的唯一 ID；`gold` 另列為貨幣，不納入材料數量。
- 「有掉落來源」只表示該材料 ID 在 `DROPS_DB` 有非空陣列；它不等於來源已具備正式 monster ID。現有來源使用怪物中文名稱，轉換後仍須標記關聯狀態。

## 2. 原始資料結構

```text
CRAFT_DATA
├─ CRAFT_RECIPES: Record<npcId, LegacyRecipe[]>
│  └─ LegacyRecipe
│     ├─ result: string
│     ├─ yield: number
│     ├─ req: LegacyRequirement[]
│     │  └─ { id: string, cnt: number }
│     ├─ desc?: string
│     ├─ is_special?: boolean
│     └─ spec_note?: string
├─ ITEMS_DB: Record<legacyItemId, LegacyItem>
│  └─ LegacyItem
│     ├─ id: string
│     ├─ name: string
│     ├─ type: string
│     ├─ slot: string
│     ├─ slot_cn: string
│     ├─ rarity: string
│     ├─ desc: string
│     └─ price: number
├─ DROPS_DB: Record<legacyItemId, LegacyDrop[]>
│  └─ LegacyDrop
│     ├─ mob: string
│     ├─ rate: number
│     └─ maps: string[]
└─ NPC_INFO: Record<npcId, LegacyNpc>
   └─ { name: string, loc: string, desc: string }
```

`CRAFT_RECIPES` 最外層 key 同時扮演 NPC 關聯；配方本身沒有 recipe ID。`ITEMS_DB` 的 object key 與內部 `id` 在現況全部一致。`DROPS_DB` 的怪物與地圖仍是顯示文字，不是正式 entity ID。

## 3. 欄位對照表

| 舊位置 | 現有含義／實際用途 | Phase 1 目標欄位 | 轉換備註 |
| --- | --- | --- | --- |
| `CRAFT_RECIPES` object key | 製作 NPC ID、NPC 篩選、卡片 NPC 顯示 | `recipe.npcId` | 必須能在 `npcs.json` 找到；不可由名稱反推 |
| `recipe.result` | 成品 legacy ID；卡片、搜尋、百科按鈕、配方索引與樹根 | `result.itemId` | 先由明確 ID mapping 轉換；不能以中文名稱關聯 |
| `recipe.yield` | 單次產量；目前只在卡片顯示 `xN` | `result.quantity` | 現有樹與金幣演算法沒有按 yield 換算，1B 必須決定計算語意 |
| `recipe.req` | 原料陣列 | `requirements` | 保持原順序可維持目前呈現 |
| `req[].id` | 原料／中間成品／裝備／貨幣 legacy ID | `requirements[].itemId` | `gold` 應有明確貨幣處理，不應偽裝成一般材料 |
| `req[].cnt` | 每次配方需要數量 | `requirements[].quantity` | 目前皆為正數數值 |
| `recipe.desc` | 搜尋字串及卡片說明 | `description` | 50 筆配方有值 |
| `recipe.is_special` | 是否顯示特殊製作警告 | `isSpecial` | 7 筆為 true |
| `recipe.spec_note` | 特殊製作警告文字 | `specialNote` | 7 筆有值；必須與 `isSpecial` 一起驗證 |
| `ITEMS_DB` object key | 現有物品查詢主鍵 | `legacyId`／明確 mapping 輸入 | 不能直接假定所有 key 都符合新 item ID 契約 |
| `item.id` | 與 object key 重複的 legacy ID | `id` 或 `legacyId` | 現況無 key/id 不一致 |
| `item.name` | UI 名稱及搜尋文字 | `name` | 不可作關聯鍵 |
| `item.type` | 舊物品類型 | `itemType` | 需使用固定 mapping 表轉換 |
| `item.slot`, `slot_cn` | 裝備槽位代碼與顯示文字 | 可選展示欄位 | 不用於目前配方運算 |
| `item.rarity` | 卡片、材料名稱的色彩 class | `rarity` | 值域必須在生成時驗證 |
| `item.desc` | 物品說明資料 | `description` | 目前製作卡片不直接讀取成品 item.desc |
| `item.price` | 物品價格 | `price` | 目前製作樹與金幣總計不使用此欄位 |
| `NPC_INFO.name` | NPC 顯示名稱 | `name` | 必填；不可當 ID |
| `NPC_INFO.loc` | NPC 地點顯示文字 | `locationText` | 不足以驗證 `regionId` |
| `NPC_INFO.desc` | NPC 說明 | `description` | 選取 NPC 時顯示 |
| `DROPS_DB` object key | 被查詢物品／材料 legacy ID | `itemId` | 必須經相同 item mapping |
| `drop.mob` | 怪物中文顯示名及跳轉參數 | 暫存顯示文字；`monsterId` unresolved | 禁止從中文名生成正式 monster ID |
| `drop.rate` | 百分比數值 | `rate` | 現有 UI 直接加 `%`，須保留原單位 |
| `drop.maps` | 來源資料內的地圖文字陣列 | 可選來源顯示資料 | 現有 drawer 實際改由 `REGIONS_DATA` 查怪物位置，未直接顯示此欄位 |

## 4. 數量統計

| 指標 | 數量 | 定義 |
| --- | ---: | --- |
| NPC 數量 | 47 | `CRAFT_RECIPES` 的唯一 NPC key；其中只有 46 個存在於 `NPC_INFO` |
| 配方數量 | 279 | 所有 NPC 配方陣列的記錄總數 |
| 成品數量 | 272 | `recipe.result` 唯一 ID 數；有 7 個成品各重複出現在兩個 NPC |
| 材料數量 | 278 | `req[].id` 唯一值扣除 `gold` |
| 技能書成品數量 | 14 | 成品 ID 與 `EQUIP_DATA.category=skillbook` 完全相等 |
| 裝備成品數量 | 213 | 成品 ID 與 `EQUIP_DATA.category=equipment` 完全相等 |
| 有掉落來源的材料數量 | 193 | 材料 ID 在 `DROPS_DB` 有非空來源陣列 |
| 無可驗證來源的材料數量 | 85 | 材料 ID 沒有非空 `DROPS_DB` 陣列；不推測為商店、任務或製作來源 |

補充：279 筆配方中，`yield=1` 有 275 筆、`yield=10` 有 1 筆、`yield=20` 有 2 筆、`yield=100` 有 1 筆。這 4 筆非 1 產量配方是樹狀分解與成本計算的語意風險。

### 4.1 ID 命名空間盤點

成品 272 個 ID 的前綴分布：

| 前綴 | 數量 | 前綴 | 數量 | 前綴 | 數量 |
| --- | ---: | --- | ---: | --- | ---: |
| `acc_` | 45 | `amr_` | 7 | `arm_` | 42 |
| `armguard_` | 3 | `bk_` | 12 | `blt_` | 1 |
| `bot_` | 6 | `clk_` | 13 | `hlm_` | 8 |
| `item_` | 16 | `mat_` | 9 | `mem_` | 2 |
| `new_item_` | 14 | `panacea_` | 6 | `pet_` | 10 |
| `rng_` | 4 | `shd_` | 4 | `tsh_` | 1 |
| `wpn_` | 69 |  |  |  |  |

材料 278 個 ID 的前綴分布：

| 前綴 | 數量 | 前綴 | 數量 | 前綴 | 數量 |
| --- | ---: | --- | ---: | --- | ---: |
| `acc_` | 26 | `amr_` | 2 | `arm_` | 14 |
| `blt_` | 1 | `bot_` | 1 | `clk_` | 1 |
| `glv_` | 1 | `hlm_` | 3 | `item_` | 55 |
| `mat_` | 77 | `new_item_` | 70 | `new_phoenix_` | 1 |
| `panacea_` | 1 | `pet_` | 5 | `wpn_` | 20 |

上述分布代表 `req` 並非純材料表；它同時包含裝備、中間成品、一般物品及貨幣。轉換時不能只依 `mat_` 前綴決定 itemType。

### 4.2 NPC ID 清冊

```text
npc_bamut, npc_bartel, npc_brabo, npc_david, npc_dytite, npc_elf,
npc_elfqueen, npc_ent, npc_falin, npc_finn, npc_flame_aide,
npc_flame_shadow, npc_flame_smith, npc_hector, npc_herbert, npc_ibelbin,
npc_imp, npc_joel, npc_keluya, npc_kororanz, npc_kupu, npc_lentis,
npc_lumiel, npc_moli, npc_moliya, npc_mystic_mage, npc_nalien,
npc_narupa, npc_norse, npc_pan, npc_pir, npc_q_dark, npc_q_dragon,
npc_q_elf, npc_q_illusion, npc_q_knight, npc_q_mage, npc_q_royal,
npc_q_warrior, npc_rabiani, npc_rekne, npc_robinson, npc_ryan,
npc_sebas, npc_tas, npc_upni, npc_zeus_golem
```

### 4.3 技能相關 ID 清冊

以下 14 個是技能書「物品 entity ID」，不是已驗證的技能 entity ID：

```text
bk_dragon_armor, bk_dragon_bloodlust, bk_elf_summon, bk_elf_summon2,
bk_royal_bravewill, bk_royal_burnweapon, bk_royal_callally,
bk_royal_kingguard, bk_royal_precise, bk_royal_shield,
bk_warrior_dualaxe, bk_warrior_roar, mem_cube_burn, mem_cube_shock
```

`EQUIP_DATA` 沒有獨立 skill entity ID 欄位，因此目前可確認的是技能書物品本身，不能確認 `skill_*` 關聯。

## 5. ID 與關聯問題清單

### 5.1 重複 ID／重複成品

`ITEMS_DB` object key、內部 `item.id`、`EQUIP_DATA.id`、`NPC_INFO` key 均未發現資料集內重複。配方本身沒有 ID，因此現況無法檢查 recipe ID 唯一性。

有 7 個 `result` ID 重複出現在不同 NPC；兩份配方內容完全相同：

| result ID | NPC 1 | NPC 2 |
| --- | --- | --- |
| `hlm_silver` | `npc_finn` | `npc_falin` |
| `arm_112` | `npc_finn` | `npc_falin` |
| `arm_92` | `npc_finn` | `npc_falin` |
| `arm_77` | `npc_finn` | `npc_falin` |
| `shd_bone` | `npc_joel` | `npc_ryan` |
| `amr_bone` | `npc_joel` | `npc_ryan` |
| `hlm_bone` | `npc_joel` | `npc_ryan` |

這些不是物品 ID 衝突，但會影響 `recipeIndex`：現有程式只保留第一次遇到的成品配方與 NPC。

### 5.2 同名不同 ID／同 ID 不同名稱

- 在本次關聯範圍內，`ITEMS_DB`、`EQUIP_DATA` 與 `NPC_INFO` 未發現同名不同 ID。
- `ITEMS_DB` 與 `EQUIP_DATA` 的共同 ID 未發現同 ID 不同名稱。
- 這個結論只代表目前資料沒有衝突，不代表名稱可升格為關聯鍵。

### 5.3 配方結果找不到 item

共 9 個，全部位於 `npc_upni`：

```text
item_pride_dom_11, item_pride_dom_21, item_pride_dom_31,
item_pride_dom_41, item_pride_dom_51, item_pride_dom_61,
item_pride_dom_71, item_pride_dom_81, item_pride_dom_91
```

這些成品只能保留 legacy ID，名稱、itemType、entityRef 與 linkStatus 均無法由 `ITEMS_DB` 驗證，應標記 unresolved；不得由畫面文字補造。

### 5.4 requirement 找不到 material/item

共 18 個，亦全部出現在 `npc_upni` 的 9 筆配方：

```text
item_pride_pass_11, item_pride_pass_21, item_pride_pass_31,
item_pride_pass_41, item_pride_pass_51, item_pride_pass_61,
item_pride_pass_71, item_pride_pass_81, item_pride_pass_91,
item_pride_scroll_11, item_pride_scroll_21, item_pride_scroll_31,
item_pride_scroll_41, item_pride_scroll_51, item_pride_scroll_61,
item_pride_scroll_71, item_pride_scroll_81, item_pride_scroll_91
```

其中 9 個 `item_pride_scroll_*` 在 `DROPS_DB` 有來源資料，但仍缺少 `ITEMS_DB` 物品記錄；不能因為有掉落資料就推定其正式名稱或類型。

### 5.5 EQUIP_DATA 對應

- 213 個被 `ITEMS_DB.type` 分為 `wpn`／`arm`／`acc` 的裝備成品，全都能以完全相同 ID 對應到 `EQUIP_DATA.category=equipment`。
- 14 個 `skillbk` 成品能對應 `EQUIP_DATA.category=skillbook`，但只能證明技能書物品存在。
- 其餘 45 個成品不是裝備 entity：包含一般物品、材料、中間成品與 9 個缺 item 記錄；不得把「未命中 EQUIP_DATA」一律視為錯誤。
- 因此「已被判定為裝備、卻找不到 EQUIP_DATA」的數量為 0。

### 5.6 NPC 資料與 UI 順序問題

- `CRAFT_RECIPES` 有 47 個 NPC key；`NPC_INFO` 有 46 個。
- `npc_mystic_mage` 有配方但沒有 `NPC_INFO`，屬 unresolved NPC。
- `NPC_ORDER` 有 54 個唯一 ID，其中只有 29 個同時存在於配方與 NPC_INFO。
- 有 25 個 `NPC_ORDER` ID 沒有 `NPC_INFO`，目前 `renderNpcList()` 直接跳過。
- 有 18 個配方 NPC 不在 `NPC_ORDER`，因此不會出現在左側 NPC 清單；全域搜尋也不會掃描這 18 組配方。

不在 `NPC_ORDER` 的 18 個配方 NPC：

```text
npc_bamut, npc_bartel, npc_david, npc_flame_aide, npc_flame_shadow,
npc_flame_smith, npc_herbert, npc_ibelbin, npc_imp, npc_kororanz,
npc_kupu, npc_lentis, npc_lumiel, npc_moliya, npc_mystic_mage,
npc_norse, npc_sebas, npc_tas
```

### 5.7 配方圖結構

- 以現有「每個 result 只取第一筆配方」規則建立的配方圖，未發現循環依賴。
- 但此結論受 `recipeIndex` 首筆覆蓋策略限制；新資料層應保留 recipe ID，不應再以 result ID 當唯一 recipe key。

## 6. unresolved 清單

| 類型 | 數量 | 狀態與原因 |
| --- | ---: | --- |
| 缺少 item 記錄的成品 | 9 | 無名稱、類型及 entityRef 的可靠來源 |
| 缺少 item 記錄的 requirement | 18 | 無可靠物品主檔；其中 9 個只有掉落資料 |
| 無非空掉落資料的 requirement | 85 | 只能標記來源 unknown/unresolved，不能推測商店或任務來源 |
| 技能書到 skill entity 的 mapping | 14 | 只有技能書 item ID，沒有已驗證 `skill_*` ID |
| `npc_mystic_mage` NPC 資料 | 1 | 有配方、無 `NPC_INFO` |
| NPC region mapping | 46 個已知 NPC 仍待驗證 | 只有 `loc` 文字，不能生成 region ID |
| 掉落 monster mapping | 193 個有來源材料涉及的所有來源記錄 | `drop.mob` 為中文名稱，沒有正式 monster ID |
| 掉落 map/region mapping | 所有 drop 記錄 | `maps` 是文字陣列；不能據此自行生成 region ID |

85 個「沒有非空 DROPS_DB」的 requirement 不一定真的沒有取得方式：其中包含可製作中間品、裝備與未知管道物品。Phase 1B 必須把「沒有怪物掉落記錄」與「已驗證沒有來源」分開，預設使用 `sourceStatus: unresolved` 或 `unknown`，不得標示為已驗證無來源。

## 7. 現有功能的實際欄位依賴

### 7.1 配方樹

- `initCraftWiki()` 以 `recipe.result` 建立 `recipeIndex[result] = { npc, req }`。
- 同一 result 有多份配方時只保留第一份。
- `renderTreeNode()` 使用 result／requirement ID 遞迴查 `recipeIndex`。
- 顯示名稱與顏色依賴 `ITEMS_DB[id].name`、`ITEMS_DB[id].rarity`。
- 沒有配方的 ID 被當作最底層原料；是否顯示來源按鈕依賴 `DROPS_DB[id].length`。
- `yield` 沒有參與樹狀數量換算。

### 7.2 金幣總計

- `gold` 是特殊保留 ID；`calculateTotalGold('gold', count)` 直接回傳 count。
- 每一層配方尋找 `req` 中 `id === 'gold'` 的 `cnt` 作為單件手續費。
- 其他 requirement 以 `m.cnt * count` 遞迴展開。
- `ITEMS_DB.price` 完全不參與金幣總計。
- `yield` 沒有參與成本攤分；非 1 產量配方的成本語意可能不正確。
- 未發現循環，但函式沒有 cycle guard；Phase 1B 索引層仍必須加入循環偵測。

### 7.3 NPC 篩選與搜尋

- 左側清單完全依賴 `NPC_ORDER` 順序，再查 `NPC_INFO[npcId]`；沒有 info 的 ID 被跳過。
- 選取後依賴 `CRAFT_RECIPES[selectedNpc]`。
- 全域搜尋只走 `NPC_ORDER`，所以漏掉不在該陣列的 18 個配方 NPC。
- 搜尋比對 `ITEMS_DB[result].name`、`recipe.desc`、`ITEMS_DB[req.id].name`；缺 item 時退回顯示／搜尋 ID。

### 7.4 掉落來源

- 按鈕是否顯示只依賴 `DROPS_DB[itemId]` 是否為非空陣列。
- drawer 讀取 `drop.mob` 與 `drop.rate`；也相容舊 tuple 形式，但現有 3,858 筆 drop 全部是 `{mob, rate, maps}` object。
- drawer 不直接使用 `drop.maps`；它以 `drop.mob` 中文名稱呼叫 `getMobLocations()`，再到 `REGIONS_DATA` 以名稱查位置。
- 怪物跳轉亦傳入中文名稱。這是現有 UI 行為，不可直接轉成正式 ID 關聯。

## 8. JSON 明確轉換規則

### 8.1 共通規則

1. 先抽取原始 JSON literal，禁止以正規表示式拆解巢狀物件。
2. 所有輸入保留 `legacyId`，供差異比對與 rollback。
3. 所有正式關聯只接受明確 mapping 或完全相等的既有 entity ID。
4. 名稱只作展示與稽核，不參與 ID 生成、模糊比對或 fallback。
5. 缺少資料時保留原 legacy ID 並標記 `unresolved`；生成器不得自行補名稱、NPC、region、monster 或 skill ID。
6. 生成前驗證唯一性、必填欄位、正數 quantity、參照完整性及配方圖循環。
7. 生成應具決定性：相同輸入必須產生 byte-stable 的排序與內容。

### 8.2 `recipes.json`

- 將每個 `CRAFT_RECIPES[npcId][]` 攤平成陣列。
- `npcId` 直接使用既有 NPC key。
- `result` 轉為 `{ itemId, quantity }`；quantity 來自 `yield`。
- `req` 轉為 `requirements: [{ itemId, quantity }]`。
- `desc`、`is_special`、`spec_note` 分別轉成 `description`、`isSpecial`、`specialNote`。
- recipe ID 使用 `recipe_<npc-id>_<result-id>_<variant>` 契約。每個 NPC/result 現況最多一筆，可使用固定 `01`；不得用陣列位置。若未來同 NPC/result 有多筆，variant 必須來自受版本控制的明確 mapping，不能由排序位置暗中產生。
- 7 組跨 NPC 同成品配方必須各自保留，不能去重；NPC ID 已使 recipe ID 不衝突。
- 9 筆缺 item 成品的配方可保留作 unresolved 記錄，但必要資料驗收不得將其宣稱為 resolved。
- `gold` 建議轉為顯式 `currencyCost`；若 Phase 1 契約要求仍留在 requirements，則必須建立已驗證的保留貨幣 item，並禁止進入一般材料來源查詢。此點需在 1B 前定案。

### 8.3 `npcs.json`

- 由 `NPC_INFO` object key 產生 `id`。
- `name` 原樣保留；`loc` 只轉為 `locationText`；`desc` 轉為 `description`。
- 在沒有可驗證 regions 資料前，`regionId: null`、`linkStatus: unresolved`。
- `npc_mystic_mage` 不可依 key 或配方內容補造名稱／地點；應加入 unresolved 報告，或在必要資料驗收中阻擋其配方啟用。
- 不以 `NPC_ORDER` 作資料來源；排序應另外保存為 UI metadata，且必須補齊或明確排除 18 個現有配方 NPC。

### 8.4 `items.json`

- 來源是所有 recipe result 與 requirement ID 的聯集，再以 `ITEMS_DB` 補欄位；不能直接輸出全部 1,991 個無關 item，除非 Phase 1B 明確決定建立全站 item master。
- 保存 `legacyId`，正式 `id` 依 Phase 1 ID 契約與一份可審查 mapping 產生。
- 既有 result 若能完全相等對應 `EQUIP_DATA.category=equipment`：`itemType: equipment`，`entityRef: {entityType: equipment, entityId: legacyId}`，`linkStatus: resolved`。
- 技能書：`itemType: skillbook`，但在沒有 skill entity ID 時 `entityRef: null`、`linkStatus: unresolved`。不能把技能書 item ID 當成 skill ID。
- `mat_` 及其他已知非裝備類型依明確 type mapping 轉為 material／misc；不得只靠名稱判斷。
- 缺 `ITEMS_DB` 的 27 個關聯 ID保留為 unresolved stub 或使必要驗收失敗；stub 只能含既有 legacy ID 與狀態，不能補造中文名稱。
- `rarity`、`description`、`price`、slot 欄位可原樣保留，但需先驗證型別與值域。

### 8.5 `drops.json`

- 只針對 Phase 1 item 集合輸出來源，不需搬移 928 個無關 `DROPS_DB` key。
- 每筆以轉換後 itemId 關聯，保留 legacy item key 供追蹤。
- 有非空來源陣列時可確認「存在 legacy drop record」，但 `monsterId` 仍為 null，除非另有以 ID 為鍵的可靠 mapping。
- `mob` 保存為 `monsterNameText`，`maps` 保存為 `locationTexts`；兩者不得轉成正式 ID。
- `rate` 原樣保存並註明單位為 percentage value。
- 沒有來源陣列時：`sourceStatus: unresolved`、`sourceType: null`、`sources: []`。不能根據缺資料推測 shop／quest／craft。
- 只有 monster ID 經資料集驗證後，才能使用 `sourceStatus: verified` 與 `sourceType: monster_drop`。

## 9. Phase 1B 實作前阻擋問題

### 必須先解決

1. **item ID 契約歧義**：計畫同時要求 `item_` 前綴，又允許沿用穩定原始 key；必須明確決定 `acc_*`／`wpn_*`／`mat_*` 是正式 itemId，還是轉成 `item_*` 並保存 legacyId。未定案會使 recipes、items、drops 三檔無法建立穩定外鍵。
2. **缺少 9 個成品及 18 個 requirement 的 item master 記錄**：必須取得可驗證資料，或正式允許 unresolved stub 並定義必要資料驗收如何處理。
3. **`npc_mystic_mage` 缺 NPC_INFO**：不能生成合格的必填 NPC 記錄。
4. **NPC_ORDER 與資料不一致**：18 個配方 NPC 不在目前清單與搜尋路徑。1B 必須決定補入資料驅動排序或明確排除；不能在不知情下改變可見配方範圍。
5. **非 1 yield 的樹與成本語意**：目前計算忽略 yield，必須確認 quantity 展開與金幣成本是否應按產量除算。
6. **貨幣模型**：`gold` 要保留為 item requirement 或轉成 `currencyCost` 尚未定案。
7. **正式 recipe variant 規則**：現況可安全用每個 NPC/result 的固定 `01`，但生成器需明確拒絕未配置的同 NPC/result 重複資料。

### 不阻擋資料骨架，但阻擋宣稱完整關聯

- 14 個技能書沒有 skill entity ID mapping。
- region ID 尚未驗證。
- drop monster ID 尚未驗證。
- 85 個 requirement 沒有可驗證的取得來源。

## 10. 建議的資料生成方式

建議新增一支「只讀 `wiki.html`、只寫目標 JSON／稽核報告」的根目錄 Python 生成器，但應留到 Phase 1B 並另行授權。流程如下：

1. 以 JavaScript/JSON literal 邊界解析方式抽取 `CRAFT_DATA` 與 `EQUIP_DATA`，不使用脆弱的單行 regex 解析內容。
2. 建立不可變的 legacy model，驗證所有 object key 與內部 ID。
3. 載入受版本控制的 `id-mapping`／`unresolved-overrides`；mapping 必須以 legacy ID 為鍵，不接受中文名稱鍵。
4. 攤平配方並建立 recipe ID；遇到重複 recipe ID、缺必要 mapping 或循環立即失敗。
5. 產生只涵蓋 Phase 1 關聯閉包的 NPC、item、drop 資料。
6. 在寫檔前執行 schema、唯一性、foreign key、quantity、entityRef、sourceStatus 驗證。
7. 以固定排序及 UTF-8 輸出，另產生統計摘要供人工 diff。
8. 將目前 279／272／278／14／213／193／85 等基準數字設為 regression assertions；資料有意更新時才同步調整基準。

## 11. 預計生成的 JSON 檔案清單

Phase 1B 預計建立，但本階段未建立：

- `data/craft/recipes.json`
- `data/craft/npcs.json`
- `data/craft/items.json`
- `data/craft/drops.json`

只有在 ID 契約與缺資料處理定案後才考慮：

- `data/craft/mappings.json` 或 `data/craft/entity-mappings.json`
- `data/craft/regions.json`（目前沒有足夠資料生成）

## 12. Phase 1A 結論

現有資料足以開始建立 Phase 1B 的生成器、schema、驗證器及 unresolved 機制，但不適合直接生成並啟用完整資料層。進入 1B 前至少要定案 item ID、gold、yield 與 unresolved stub 契約；技能、region 與 monster 關聯可在 1B 保持 unresolved，不應以名稱猜測補齊。
