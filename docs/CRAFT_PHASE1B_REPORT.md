# 製作與配方百科 Phase 1B 報告

## 1. 執行範圍

本階段建立可重複執行的製作資料生成器、JSON Schema、驗證器與 Phase 1 JSON，未接 UI、未修改 `wiki.html`，也未啟用新資料層。

執行日期：2026-07-12

## 2. 新增檔案

### 工具

- `tools/generate_craft_data.py`
- `tools/validate_craft_data.py`

### Schema

- `schemas/craft-recipe.schema.json`
- `schemas/craft-item.schema.json`
- `schemas/craft-npc.schema.json`
- `schemas/craft-source.schema.json`

### 生成資料

- `data/craft/recipes.json`
- `data/craft/items.json`
- `data/craft/npcs.json`
- `data/craft/drops.json`
- `data/craft/unresolved.json`

### 文件

- `docs/CRAFT_PHASE1B_REPORT.md`

沒有修改任何既有 HTML、CSS、JavaScript、afk 腳本或遊戲資料檔。

## 3. 生成器設計

生成器只從 `wiki.html` 讀取：

- `CRAFT_DATA`
- `EQUIP_DATA`
- `NPC_ORDER`
- `CRAFT_DATA` 內的 `CRAFT_RECIPES`、`ITEMS_DB`、`DROPS_DB`、`NPC_INFO`

主要流程：

1. 安全擷取指定常數。
2. 建立原始配方、成品、requirement、NPC 與掉落集合。
3. 在寫檔前執行全部 regression assertions。
4. 依 `DATA_CONTRACT.md` 轉換 recipe、Item、Npc、SourceRecord。
5. 缺資料時建立 unresolved stub，不補造名稱或 entity ID。
6. 固定以 ID 排序，JSON 使用 UTF-8、LF、2 空格縮排、object key 排序及結尾換行。
7. 禁止 NaN/Infinity，確保輸出是標準且 byte-stable 的 JSON。

正式 item ID 直接沿用現有遊戲 ID。Recipe ID 使用：

```text
recipe_<完整 npcId>_<完整 resultId>_01
```

生成器先檢查同 NPC/result 是否有多筆；若有且沒有受版本控制的 variant mapping，立即停止，不會依陣列位置編號。

`gold` 從 requirements 移除並轉成 `currencyCost`。同配方若有兩筆 gold 或重複 requirement itemId，生成失敗。

## 4. Parser 方法

未執行 JavaScript，也未使用單行 regex 解析巢狀 literal。

- 以小型 lexical scanner 掃描 code、字串、line comment、block comment 狀態，定位精確的 `const NAME =` 賦值起點。
- `CRAFT_DATA` 與 `EQUIP_DATA` 必須是合法 JSON literal，再交由 Python `json.JSONDecoder.raw_decode()` 解析。
- 解析後檢查 literal 後方必須是分號，避免只解析到不完整前綴。
- `NPC_ORDER` 使用受限 parser，只接受由單／雙引號字串與逗號構成的陣列；任何 expression、function call 或其他 token 都會失敗。

此方法不評估或執行任何任意 JavaScript。

## 5. Schema 說明

- Recipe Schema：驗證 recipe ID、NPC ID、result、requirements、`currencyCost`、說明與特殊配方欄位；明確禁止 gold requirement。
- Item Schema：驗證既有 item ID、itemType、EntityRef、link/data status 與 stub nullable 欄位。
- NPC Schema：驗證 NPC ID、顯示資料、region unresolved 狀態、stub 與 `sortOrder`。
- Source Schema：驗證 SourceRecord、source status/type、null monsterId、顯示文字、rate 與 `rateUnit=percent`。

Schema 採 JSON Schema Draft 2020-12，驗證器使用 `jsonschema` 4.26.0。

## 6. 生成數量與基準斷言

| 指標 | 結果 | 期望 | 狀態 |
| --- | ---: | ---: | --- |
| NPC | 47 | 47 | 通過 |
| 配方 | 279 | 279 | 通過 |
| 唯一成品 | 272 | 272 | 通過 |
| 唯一 requirement，不含 gold | 278 | 278 | 通過 |
| Phase 1 Item closure | 471 | — | 產生完成 |
| 技能書成品 | 14 | 14 | 通過 |
| 裝備成品 | 213 | 213 | 通過 |
| 有掉落資料 requirement | 193 | 193 | 通過 |
| 無可驗證來源 requirement | 85 | 85 | 通過 |
| 非 1 yield 配方 | 4 | 4 | 通過 |
| 缺 item 成品 | 9 | 9 | 通過 |
| 缺 item requirement | 18 | 18 | 通過 |
| 缺 NPC_INFO | 1 | 1 | 通過 |
| 不在 NPC_ORDER 的配方 NPC | 18 | 18 | 通過 |

`items.json` 只包含 result 與 requirement 的聯集，不輸出與 Phase 1 無關的全部 `ITEMS_DB`。Gold 不在 items.json。

## 7. NPC 排序結果

- 先保留 `NPC_ORDER` 中存在配方資料的 NPC。
- 18 個漏列 NPC 依 NPC ID 升冪追加。
- `npc_mystic_mage` 在原始資料中是空配方 key 且缺 `NPC_INFO`；依已定契約仍建立 stub 並保留在 NPC 索引。
- `recipesByNpcId` 包含全部 47 個 NPC key；`npc_mystic_mage` 對應空陣列，不會被隱藏或遺失。

## 8. 索引驗證

| 索引 | key 數量 | 結果 |
| --- | ---: | --- |
| `recipesById` | 279 | 通過 |
| `recipesByNpcId` | 47 | 通過 |
| `recipesByResultId` | 272 | 通過；每個值均為 Recipe[] |
| `recipesByRequirementId` | 278 | 通過 |
| `itemsById` | 471 | 通過 |
| `npcsById` | 47 | 通過 |
| `sourcesByItemId` | 471 | 通過 |

跨 NPC 同成品配方全部保留，沒有使用 resultId -> 單一 recipe 的首筆覆蓋模型。

## 9. 驗證結果

兩輪驗證皆通過：

- 四份 JSON Schema 通過。
- Recipe、Item、NPC ID 唯一。
- 所有 result/requirement itemId 都有完整 Item 或 unresolved stub。
- 所有 npcId 都有完整 NPC 或 unresolved stub。
- quantity 均為正整數。
- currencyCost amount 均為非負有限數值。
- requirements 不含 gold。
- 無重複 requirement itemId。
- EntityRef resolved/unresolved 狀態一致。
- Drops 覆蓋全部 471 個 Phase 1 Item。
- 所有 legacy monster source 的 monsterId 均為 null，rateUnit 為 percent。
- 決定性排序與 regression assertions 通過。

## 10. Unresolved 統計

`unresolved.json` 共 540 筆：

| 類型 | 數量 | blocking |
| --- | ---: | --- |
| 缺 item requirement | 18 | false |
| 缺 item result | 9 | false |
| 無可驗證來源 requirement | 85 | false |
| unresolved monster mapping | 366 | false |
| unresolved NPC | 1 | false |
| unresolved region mapping | 47 | false |
| unresolved skill mapping | 14 | false |

每筆均包含 `type`、`id`、`reason`、`sourceLocation`、`severity`、`blocking`。沒有透過中文名稱生成正式關聯。

## 11. 非 1 yield 驗收

驗證公式：

```text
craftCount = ceil(targetQuantity / result.quantity)
requiredMaterial = requirement.quantity * craftCount
requiredGold = currencyCost.amount * craftCount
actualOutput = result.quantity * craftCount
```

| Recipe | yield | 測試目標 | craftCount | 實際產出 | 結果 |
| --- | ---: | ---: | ---: | ---: | --- |
| `recipe_npc_narupa_wpn_30_01` | 10 | 11 | 2 | 20 | 通過 |
| `recipe_npc_narupa_wpn_5_01` | 100 | 101 | 2 | 200 | 通過 |
| `recipe_npc_elf_new_item_169_01` | 20 | 21 | 2 | 40 | 通過 |
| `recipe_npc_elf_new_item_170_01` | 20 | 21 | 2 | 40 | 通過 |

四案均驗證 requirement 數量乘以 craftCount；目前四份配方的 currencyCost 均為 0，因此 requiredGold 為 0。

## 12. Cycle 檢查

驗證器由全部 `recipesByResultId` 建立配方依賴圖，以 visiting/visited 集合執行 DFS cycle guard。檢查結果：通過，未發現循環。

若未來出現循環，驗證器會列出循環路徑並失敗，不會遞迴至無限深度。

## 13. 兩次輸出雜湊與 byte-stable

第一輪與第二輪的 SHA-256 完全一致：

| 檔案 | 第一輪 SHA-256 | 第二輪 SHA-256 | 一致 |
| --- | --- | --- | --- |
| `recipes.json` | `2792afd60a82ed2f3ecd47942b199de4427530a702f5acf8389f03eb4e853aa0` | `2792afd60a82ed2f3ecd47942b199de4427530a702f5acf8389f03eb4e853aa0` | 是 |
| `items.json` | `ebef858526cd94f4cfaeec18b4f9c4930fbf1d8994fdbf0d15d39ef54059a108` | `ebef858526cd94f4cfaeec18b4f9c4930fbf1d8994fdbf0d15d39ef54059a108` | 是 |
| `npcs.json` | `fcdaccdfafdb492b085209ed3a635f7267d992e51bbadfbf1b416ba8f36e4da2` | `fcdaccdfafdb492b085209ed3a635f7267d992e51bbadfbf1b416ba8f36e4da2` | 是 |
| `drops.json` | `43a201afe0daa1a2516823c4f4113d23300be3d329721c23c814d53418d23b15` | `43a201afe0daa1a2516823c4f4113d23300be3d329721c23c814d53418d23b15` | 是 |
| `unresolved.json` | `b9a54a61bde82ed72f6c4adbd94c0c289db4b2bb1b0debb4932574e754f623f6` | `b9a54a61bde82ed72f6c4adbd94c0c289db4b2bb1b0debb4932574e754f623f6` | 是 |

結論：相同輸入重跑後輸出 byte-stable。

## 14. Git 變更檢查

已執行：

- `git diff --stat`
- `git status --short`
- 對 `wiki.html`、`index.html`、`css/`、`js/` 與 `afk-*.js` 的限定 diff

限定網站程式 diff 無輸出，表示本階段沒有修改這些檔案。

目前 repository 的 Git 狀態原先即包含中文路徑刪除項目及根目錄／docs 未追蹤狀態，因此全域 `git diff --stat` 無法只代表本階段工作。本階段實際新增範圍僅為第 2 節列出的 tools、schemas、data/craft 與本報告；未建立或切換分支，未 commit，未 push。

## 15. Phase 1C 判斷

資料生成器、Schema、驗證器、基準斷言、索引語意、yield、cycle guard、unresolved 集中輸出與 byte-stable 驗收均完成。

可以進入 Phase 1C 的「資料層載入與受 feature flag 控制的接線規劃」。進入時仍須維持舊 `CRAFT_DATA` fallback，預設不得直接啟用新資料層，並須重新執行 baseline UI、Console 與 Network 404 測試。
