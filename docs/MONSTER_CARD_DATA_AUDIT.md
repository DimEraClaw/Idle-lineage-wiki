# Monster／Card Dataset Stage A：怪物、地區、掉落與卡片資料稽核

## 1. 文件目的與範圍

本文件盤點目前遊戲程式、`wiki.html` 與 Craft 掉落整理資料中的怪物、地圖／地區、生成、掉落、卡片與卡片集合。這是一份 Stage A 稽核文件，不是資料契約或實作規格。

本次沒有建立正式 Dataset、Schema、generator、validator、repository 或 UI，也沒有把顯示名稱轉造成正式 ID。凡現有來源無法以既有 ID 或可追溯程式路徑確認者，均標記為 `unresolved`。

### 1.1 已讀文件

- `AGENTS.md`
- `docs/DEVELOPMENT_RULES.md`
- `docs/GAME_DATABASE_MASTER_PLAN.md`
- `docs/WIKI_DATA_CORE_ARCHITECTURE.md`
- `docs/DATABASE_STRUCTURE.md`
- `docs/SEMANTIC_DIFF_POLICY.md`
- `docs/BASELINE_TEST_REPORT.md`

### 1.2 已檢查實際來源

- `js/00-data.js`：`DB.mobs`、`DB.maps`、`DB.items` 的主要靜態資料。
- `js/01-drops-config.js`：`MOB_DROPS` 與部分模式／試煉設定。
- `js/03-combat-core.js`：實際選怪、Boss 篩選、特殊生成與 runtime mob instance。
- `js/05-kill-progression.js`：擊殺後掉落執行路徑與機率修正。
- `js/11-world-map.js`：`MAP_REGIONS` 導航群組與地圖顯示資訊。
- `js/12-npc-quests.js`：卡片收藏共用儲存與 localStorage key。
- `js/15-cards.js`：卡片、卡片集合、卡片掉落、完成判定與效果套用。
- `wiki.html`：內嵌 `REGIONS_DATA` 百科顯示資料。
- `data/craft/drops.json`：Craft Domain 已整理的材料掉落來源子集。
- 其他 `js/*.js`：以關鍵字追蹤掉落、任務、區域獎勵、存檔與動態資料的交叉依賴。

## 2. 結論摘要

1. 怪物的最佳 authoritative candidate 是 `DB.mobs`。物件 key 是現有且穩定的 monster ID；460 筆 ID 與名稱在本快照內皆唯一。
2. `DB.maps` 的 214 個 key 是目前最可靠的 map identity，不等於上層 Region identity。`MAP_REGIONS` 的 17 組是導航分組；`CARD_REGIONS` 與 Wiki 各有 16 組卡片集合。三者不可合併計數。
3. 主掉落設定 `MOB_DROPS` 有 433 張表、3,655 條 Monster→Item 關聯與 886 個唯一 item ID；item ID 全部可在目前 `DB.items` 基線解析。
4. `MOB_DROPS` 以怪物中文名稱作 owner key。雖然本快照的 433 個名稱都能唯一映射到 `DB.mobs`，仍只是 `name-only` 關聯，不可直接成為正式外鍵。
5. 卡片集合由 16 個 `CARD_REGIONS` 定義，再由 map key → monster ID 執行時計算出 409 個卡片主體；三階卡片物件共動態生成 1,227 筆。
6. 卡片的正式關聯仍未定案：`cardId()`、`CARD_MOB_INFO`、`player.cardDex` 與卡片物件的 `cardMob` 都使用怪物名稱。現況可映射，但名稱變更會改變 identity 與存檔 key。
7. `wiki.html` 的 16 個區域含 590 個區域－怪物列、408 個唯一怪物名稱與 4,834 個顯示掉落；怪物、物品、地圖關聯皆為名稱文字。
8. Wiki 有 42 個區域－怪物列的 HP 與目前 `DB.mobs` 基值不同。未發現 LV、AC、hit 差異；不得在未確認生成／版本規則前擅自覆蓋任一來源。

## 3. 怪物資料盤點

### 3.1 正式來源候選與 identity

| 來源 | 內容 | identity | 判定 |
|---|---|---|---|
| `DB.mobs` | 怪物基礎資料 | 物件 key，例如程式內 map pool 使用的 key | authoritative candidate |
| `DB.maps` | map key → monster ID array | monster ID | authoritative candidate for spawn pool |
| `MOB_DROPS` | 怪物掉落表 | 怪物顯示名稱 | name-only；需 mapping |
| `CARD_MOB_INFO` | 卡片可用怪物索引 | 怪物名稱，value 另存 monster ID | runtime-derived；需改為 ID-first 契約 |
| `REGIONS_DATA[].mobs[]` | Wiki 顯示快照 | 怪物名稱 | name-only；不是正式 identity |

`DB.mobs` 共有 460 筆：

- monster ID：460，全部唯一。
- 怪物名稱：460 個唯一名稱。
- 同名不同 ID：0。
- 不同名稱共用同一 ID：物件結構本身不允許重複 key；本快照為 0。
- resolved monster ID：460／460。
- `DB.maps` 引用總數：1,380；全部可解析 monster ID。
- 出現在至少一個 `DB.maps` pool 的怪物：451。
- 未出現在 `DB.maps` 的怪物：9；是否只由特殊程式生成需個別追蹤，暫列 `unresolved`。
- 出現在多個 map key 的怪物：207。

不得從 `n` 或任何中文顯示名稱生成新 ID。變體怪物目前以不同 `DB.mobs` key 表示；括號、前綴、顏色、雄雌等名稱文字只是顯示資訊，不能用來推導 `baseMonsterId`。

### 3.2 Boss、普通怪物與特殊分類

- `boss: true` 是目前唯一直接、可機器判定的 Boss 標記，共 70 筆。
- 普通怪物可暫定為未設 `boss: true`，但仍可能有 `siege`、`siegeEnemy`、`noAttack`、`wild`、`isWolf` 等特殊用途，不能把「非 Boss」等同一般野怪。
- `spawnMob()` 會依地圖與狀態分開 Boss／普通 pool，並有純 Boss 地圖、王房、攻城、裂痕、追蹤、血盟、任務條件與低機率特殊生成。
- 純 Boss 地圖目前以程式常數列出 9 個 map key：`antaras_lair`、`fafurion_lair`、`valakas_lair`、`king_baranka_room`、`law_king_room`、`necro_king_room`、`assassin_king_room`、`thebes_temple`、`tikal_altar`。
- Boss 出現仍可能受同名 Boss 限制、房間狀態、冷卻、任務道具、機率或模式條件影響。`DB.maps` array 只代表候選 pool，不代表完整 Spawn 規則。

### 3.3 怪物欄位

460 筆皆有下列基礎欄位：

| 欄位 | 初步含義 | 性質／注意事項 |
|---|---|---|
| object key | monster ID | 可直接作 identity |
| `n` | 顯示名稱 | label，不可作正式外鍵 |
| `lv` | 等級 | 原始基值 |
| `hp` | 最大生命值 | 原始基值；spawn 時另建 `curHp` |
| `ac` | 防禦等級 | 原始基值 |
| `mr` | 魔法防禦／抗性 | 原始基值 |
| `hit` | 命中 | 原始基值 |
| `dmg`, `db` | 物理傷害骰參數 | 原始參數；顯示區間是衍生值 |
| `s` | sprite／外觀識別 | 顯示／資產用途，非能力值 |
| `beh` | 行為類型 | 戰鬥行為設定 |
| `race` | 種族／用途分類 | 卡片排除與戰鬥邏輯會使用 |
| `e` | 元素／屬性設定 | 原始設定；需在契約階段確認 enum 語意 |
| `exp` | 經驗值 | 原始基值 |
| `goldMin`, `goldMax` | 金幣區間 | 原始基值；實得值另受 runtime 邏輯影響 |
| `atkSpd` | 攻擊速度 | 原始基值 |

選用欄位覆蓋：`boss` 70、`mag` 235、`mag2` 58、`mag3` 20、`hard` 103、`un` 59、`elem` 22、`siege` 14、`siegeEnemy` 14、`dr` 6、`er` 1、`regenHp` 6，另有少量行為、外觀與特殊規則 flag。

能力值判定：

- 原始值：`lv`、`hp`、`ac`、`mr`、`hit`、`dmg`、`db`、`dr`、`er` 等直接位於 `DB.mobs` 的值。
- 缺少欄位：未找到通用怪物 `mp` 欄位；不可用 UI 文字補造。ER 只有 1 筆、DR 只有 6 筆明示，缺欄是否等於 0 要由契約明定，Stage A 不推定。
- runtime 值：`spawnMob()` 建立 instance 後加入 `curHp`、`uid`、`_born`、`_bornMs`、魔法 CD、受擊與狀態欄位；這些不是靜態 Monster Entity。
- 計算值：實際攻擊結果、命中判定、元素修正、玩家狀態、模式與其他戰鬥公式來自 combat 程式，不應把結果快照寫回基礎能力。
- UI-only：Wiki 的 `dmgDesc`、`dmgDiceStr`、格式化 `skills`、元素 emoji、推薦元素屬於顯示／衍生資料，不是新的 authoritative base field。
- 職業差異主要作用於玩家或試煉掉落；未發現 `DB.mobs` 依玩家職業複製不同 base row。模式、攻城、裂痕、任務與地圖狀態會改變生成或戰鬥路徑。

## 4. 地區、地圖與生成資料盤點

### 4.1 三種不同集合

| 集合 | 數量 | identity | 用途 |
|---|---:|---|---|
| `DB.maps` | 214 | stable map key | 實際 monster pool 與目前地圖狀態 |
| `MAP_REGIONS` | 17 | 導航群組主要為陣列位置／名稱；map entry 有 `v` | 世界地圖 UI 導航群組 |
| `CARD_REGIONS` | 16 | `key` | 卡片完成集合，不等同通用 Region |
| Wiki `REGIONS_DATA` | 16 | `key` | 百科顯示分組，與 CardSet key 候選對應 |

因此「地區總數」沒有單一可驗證答案。可直接驗證的是 214 個 map key、17 個導航群組、16 個卡片集合。未來 Region 契約必須先定義 Region、Map、Area、CardSet 的邊界。

### 4.2 關聯與階層

- `DB.maps[mapId] = [monsterId, ...]` 是最可靠的 Map→Monster 關聯。
- 同一怪物可在多個 map 出現；207 個怪物有多 map 關聯。
- `MAP_REGIONS` 將 map entry 放入上層 UI 群組，但此群組目前不是由 `DB.maps` 宣告的 parent ID。
- 樓層與分區主要表現在不同 map key 與顯示名稱；未找到通用 `parentRegionId`／`parentMapId` 欄位。
- 隱藏地圖、王房、攻城地圖、裂痕、未必可直接進入的特殊地圖由不同程式清單與條件管理；不能只依 `MAP_REGIONS` 判斷是否開放。
- `CARD_REGIONS.maps` 使用 map key 或 `__pride__` 動態規則建立集合。CardSet 與 Region 目前共享部分顯示概念，但不是同一已定案 Entity identity。
- Wiki `REGIONS_DATA[].mobs[].maps` 是中文名稱文字；其中也可見少量 map key 文字，屬混合表示，正式 mapping 為 `unresolved`。

### 4.3 Spawn 規則

建議未來以獨立 `Spawn` relation 表示，而不是只把 `DB.maps` array 塞進 Monster：

- 基礎候選 pool：`DB.maps[currentMapId]`。
- Boss／普通選擇：依 `boss`、純 Boss 地圖、房間與節流邏輯。
- 條件生成：任務道具、機率、攻城、血盟、裂痕、追蹤與其他 runtime state。
- runtime instance：`uid`、當前 HP、出生時間、狀態與 CD。

`DB.maps` 可產生基礎 Spawn candidate，但不足以完整重建實際出現率與條件。

## 5. 掉落資料盤點

### 5.1 主掉落表

`MOB_DROPS` 是獨立設定物件，owner key 為怪物顯示名稱，value 為 `[itemId, rate]` entry array。

| 指標 | 數量 |
|---|---:|
| 主掉落表 | 433 |
| Monster→Item 掉落 entry | 3,655 |
| 唯一 item ID | 886 |
| 同一表內重複 item ID | 0 |
| 找不到 `DB.items` 的主掉落 entry | 0 |
| 找不到 `DB.items` 的唯一 item ID | 0 |
| 可由名稱唯一映射到 `DB.mobs` 的表 | 433 |
| 有怪物但沒有主掉落表 | 27 |

「缺 item ID 的掉落數量」須依來源分開：

- `MOB_DROPS`：0；所有 entry 都明示 item ID。
- Wiki `REGIONS_DATA`：4,834；所有顯示掉落都只有 item name，沒有 item ID。當中 4,766 筆可在本快照用唯一 item name 回推候選 ID，68 筆無法在基礎 item 快照解析；回推結果仍不得直接當正式關聯。
- Craft `drops.json`：item owner 以 `sourcesByItemId` 提供 item ID，但 source 的 `monsterId` 為空並保留 `monsterNameText`，怪物端仍待 mapping。

### 5.2 掉率單位與實際路徑

- `MOB_DROPS` 的 rate 是百分比數值，不是權重。擊殺流程以 `Math.random() < effectiveRate / 100` 判定。
- 卡片掉落函式使用 0～1 機率值直接比較，與 `MOB_DROPS` 百分比單位不同；契約不可共用未標單位的 `rate`。
- 有 100% entry，但不可把 100% 解讀成整個掉落表只選一項；主表逐 entry roll，屬多次獨立判定。
- 主表不是完整掉落真相。擊殺流程另含職業／試煉條件掉落、區域 bonus、龍／記憶類特殊表、任務／房間／活動邏輯、卡片掉落等多層來源。
- `classicDropMult()`、試煉倍率／強制 100%、遺物與其他狀態會修正實際機率或數量；百科必須區分 base rate 與 effective runtime rate。
- Boss 專屬掉落主要表現在 Boss 自身的主表與特殊擊殺邏輯；是否「專屬」不能只由 item 在單一表出現推定。
- 區域限定 bonus 另有 map key 清單與 item 設定，不屬 `MOB_DROPS` owner。
- 裝備、材料、任務道具、技能書均可透過 item ID 出現在主掉落表；分類應由 Item Domain 決定，不從名稱猜測。

### 5.3 建議 owner 模型

不建議把掉落自由文字放進 Monster。未來應採：

- `DropTable`：可被 Monster、Region、Event 或特殊規則引用的 Entity。
- `DropEntry`：DropTable→Item relation，含 base rate、rate unit、roll model、quantity 與條件。
- `MonsterDropTable`／EntityRef：Monster→DropTable relation。
- runtime modifier：Mechanics／condition metadata，不覆寫 base rate。

## 6. 卡片資料盤點

### 6.1 靜態定義與動態生成

| 概念 | 現況 | 數量／identity |
|---|---|---|
| Card tier | `CARD_TIERS` | 3 階；普通／銀／金，積分 1／10／100 |
| CardSet | `CARD_REGIONS` | 16 組，stable key candidate |
| Card subject | map pool 經排除與名稱去重後的怪物 | 409 個；索引目前以 monster name 為 key |
| 實體卡片 item | `generateCardItems()` runtime 加入 `DB.items` | 1,227 筆（409 × 3） |
| CardSet→Monster | runtime-derived | 539 條集合成員關聯 |
| 同屬多集合的卡片主體 | runtime-derived | 70 個 |

`cardId(name, tier)` 以 tier code 加怪物名稱生成，例如概念上為 `card_<tier>_<monsterName>`。這是現行 runtime item key，不符合「不得以中文名稱作正式關聯鍵」的未來契約要求；Stage A 不替換也不創造新 ID。

### 6.2 Monster、Card 與 CardSet 關聯

- `CARD_REGIONS.maps` 先引用 map key。
- build index 讀取 `DB.maps[mapKey]` 的 monster ID，再取得 `DB.mobs[monsterId]`。
- 部分種族／攻城怪物會被程式排除。
- 最後使用 monster name 去重並建立 `CARD_MOB_INFO`、`CARD_MOB_REGIONS`、`CARD_MOB_MAPS`。
- 本快照 monster name 唯一，所以可回溯至 monster ID；但資料結構本身仍是 `name-only`／runtime-derived，不是已落盤的 Card→Monster ID relation。

### 6.3 CardSet 完成與效果

- `cardRegionTier(setKey)` 要求集合中的每一個怪物卡片都至少達到同一 tier；回傳最低 tier。
- 不是「收集任意數量」或比例完成，而是全成員最低階級制。
- `CARD_REGIONS` 每組含 `stat` 與三階 `vals`。
- `cardCollectionBonus()` 依完成 tier 套用 HP、MP、回復、DR、負重、額外魔力／傷害／命中、MR 或元素抗性等效果。
- CardEffect 建議成為可驗證結構；`stat` code 與 `vals` 可作 authoritative candidate，Wiki 的中文 label 只作 display label candidate。

### 6.4 卡片掉落、重複與升級

- `rollCardDrops(mob)` 僅對卡片索引內怪物執行，並排除特定 race／用途怪物。
- 金、銀、普通卡使用不同機率直接獨立 roll；該 rate 單位是 0～1 probability，不是 `MOB_DROPS` 的百分比欄位。
- 重複卡會累積隱藏分數，普通／銀／金分別增加 1／10／100，最高 100。
- 多餘卡可留在背包，另有合成與溢出處理。這些屬玩家物品／收藏機制，不是靜態 Card Entity 欄位。
- 稀有度／tier 是 Card variant metadata；未發現獨立、穩定且與怪物名稱解耦的 Card ID。

### 6.5 玩家收藏狀態

- 角色記憶體：`player.cardDex`，key 是 monster name，value 是 0～100 分數。
- 共用 localStorage 基礎 key：`lineage_idle_carddex`，實際 key 另受模式分桶邏輯影響。
- `saveCardDex()`、`loadSharedCollections()` 負責合併、遷移與儲存；存檔另保留版本遷移處理。
- 玩家背包也可持有尚未登錄或多餘的卡片 item。

未來靜態 Card／CardSet Dataset 不得包含 `player.cardDex`、背包張數、完成狀態或 localStorage 值。這些應由 PlayerState／Save Domain 透過 card／monster EntityRef 另行管理。

## 7. 關聯矩陣

| 關聯 | 現況 | 狀態 | 說明 |
|---|---|---|---|
| Monster → Region | `DB.maps` 加 `MAP_REGIONS`／`CARD_REGIONS` | runtime-derived | Monster→Map resolved by ID；Map→上層 Region 尚未有統一 Entity 契約 |
| Monster → Drop | `MOB_DROPS[monsterName]` | name-only | 433／433 在本快照可唯一 mapping，但 owner 不是 ID |
| Monster → Card | `CARD_MOB_INFO[monsterName]` | name-only / runtime-derived | value 保留 monster ID，key 與 card identity 仍使用名稱 |
| Card → CardSet | `CARD_MOB_REGIONS[monsterName]` | name-only / runtime-derived | 經 CardSet map list 計算，不是落盤 relation |
| CardSet → Effect | `CARD_REGIONS.stat + vals` | resolved by stable key | CardSet key 可作 candidate；Effect 尚無獨立 ID |
| Drop → Item | `MOB_DROPS` entry item ID | resolved by ID | 3,655／3,655 可解析；runtime 特殊掉落需另盤點 |
| Item → Equipment／Material／QuestItem／SkillBook | `DB.items` type／effect 與各 Domain 資料 | mixed | 部分 resolved by stable key，完整分類契約待 Item Domain 對齊 |
| Region → Monsters | CardSet maps → `DB.maps` → `DB.mobs` | runtime-derived | CardSet 539 條；通用 Region 關聯尚未定案 |

補充狀態：

- `resolved by ID`：Monster↔Map、主 DropEntry→Item。
- `resolved by stable key`：CardSet 本身 key 與 map key。
- `name-only`：Monster→主 DropTable、Card identity、Wiki monster／item／map。
- `ambiguous`：本快照未發現重名怪物造成的多解，但結構允許未來名稱碰撞。
- `missing`：9 個怪物無 `DB.maps` pool；27 個怪物無主掉落表，不一定是錯誤。
- `runtime-derived`：CardSet 成員、卡片物件、完整 Spawn 與 effective drop rate。

## 8. 來源比較與衝突

### 8.1 遊戲資料 vs Wiki `REGIONS_DATA`

Wiki 統計：16 個顯示區域、590 個區域－怪物列、408 個唯一怪物名稱、4,834 個顯示掉落。

可直接驗證的比較結果：

- 590 個怪物列的名稱均可唯一映射到 `DB.mobs`；缺少 0、歧義 0。
- LV、AC、hit 沒有發現差異。
- 42 個列的 HP 與 `DB.mobs` 不同，列為 42 個明確值衝突；可能是 Wiki 過期、特定區域修正、或顯示生成規則，尚不能判定權威來源。
- 4,766 個 Wiki 掉落可用 item name 唯一映射，且與 `MOB_DROPS` 的 base rate 相同。
- 68 個 Wiki 掉落名稱無法由本次基礎 `DB.items` 快照解析；可能是其他 runtime 動態 item 或人工補充，列為 `unresolved`。
- 對 Wiki 涵蓋怪物比較後，遊戲主掉落表另有 80 個 entry 未出現在 Wiki name mapping 結果；不直接判定為 Wiki 遺漏，因 68 筆 unresolved name 可能與其中部分重疊。
- 16 個 Wiki 區域的怪物清單與目前 `CARD_REGIONS` runtime 計算結果皆不完全相同：Wiki 590 列，程式 CardSet 539 條。
- 16 組的效果表示法皆不同：程式使用 `stat` code，Wiki 使用中文顯示 label。這是 representation discrepancy，不等同 16 個已證實的數值衝突。

### 8.2 遊戲資料 vs Craft `drops.json`

- Craft 資料是製作材料來源子集，不是完整 Monster／Drop Dataset。
- item 端由 `sourcesByItemId` 提供既有 item ID。
- monster 端保留 `monsterNameText` 且 `monsterId` 為空，不能直接提升為 Monster EntityRef。
- `locationTexts` 是顯示文字，未對應 `DB.maps` key。
- Craft 來源可作人工整理候選與 mapping 輔助，不可取代遊戲擊殺程式的主掉落與 runtime 修正。

### 8.3 衝突計數口徑

為避免把格式差異算成假更新，分成：

| 類型 | 數量 | 是否為已證實內容衝突 |
|---|---:|---|
| Wiki HP 與 `DB.mobs` 不同 | 42 | 是，但權威來源未定 |
| Wiki item name 無法解析 | 68 | 否，unresolved mapping |
| 遊戲主掉落未出現在 Wiki mapping | 80 | 否，coverage discrepancy |
| CardSet 與 Wiki 成員清單不同 | 16 組 | 否，集合規則／快照差異待查 |
| CardSet effect code 與 Wiki label 表示不同 | 16 組 | 否，representation discrepancy |

因此「已證實值衝突」為 42；另有 180 個／組結構或覆蓋差異觀察。不得把兩者相加後當成 222 個獨立遊戲資料錯誤，也不得自動決定哪份資料正確。

### 8.4 authoritative candidates

- Monster base：`DB.mobs`。
- Map identity 與基礎 pool：`DB.maps`。
- 基礎主掉落與 base rate：`MOB_DROPS` 加 `js/05-kill-progression.js` 的單位解讀。
- CardSet 定義與 effect code：`CARD_REGIONS`。
- 完整有效掉率、條件生成與特殊掉落：實際 runtime 程式路徑。
- Wiki `REGIONS_DATA`：人工／顯示快照 candidate，只能用於差異提示與人工審查。
- Craft `drops.json`：Craft Domain 的來源文字子集，不是 Monster Domain authoritative source。

## 9. 建議資料模型（僅規劃）

| 模型 | 類型 | 建議內容 |
|---|---|---|
| `Monster` | Entity | 既有 monster ID、label、base stats、classification flags、verification metadata |
| `MonsterVariant` | Entity 或 self-relation | 只在現有資料能證實 base／variant 關係時建立；不可從名稱括號推導 |
| `Region` | Entity | 上層世界區域；正式 ID、名稱、父子關係待契約定案 |
| `Map` | Entity | 既有 `DB.maps` key、顯示名稱、parent RegionRef、可進入／隱藏 metadata |
| `Spawn` | Relation | MonsterRef、MapRef、pool、weight／chance、條件、模式、來源位置 |
| `DropTable` | Entity | owner-independent table、roll model、來源與驗證狀態 |
| `DropEntry` | Relation | DropTableRef、ItemRef、base rate、unit、quantity、conditions |
| `Card` | Entity | 穩定 card ID、MonsterRef、tier／rarity metadata；不得用 monster name 作 FK |
| `CardSet` | Entity | stable set ID、名稱、成員規則；可與 RegionRef 關聯但不等同 Region |
| `CardEffect` | Entity 或 typed relation | CardSetRef、tier、stat code、value、mechanics reference |
| 玩家收藏 | PlayerState | CardRef／MonsterRef → score、tier、inventory；不得進靜態百科 Dataset |

`EntityRef` 應遵守 WikiDataCore：`{ domain, entityType, entityId }`。名稱只作 label 或 alias；不存在正式 ID 時使用 `unresolved` 與來源文字，不補造 ID。

## 10. 統計總表

| 指標 | 結果 | 備註 |
|---|---:|---|
| 怪物數量 | 460 | `DB.mobs` |
| Boss 數量 | 70 | `boss: true` |
| 地圖數量 | 214 | `DB.maps` stable map key |
| 導航地區數量 | 17 | `MAP_REGIONS` UI 群組 |
| 卡片套組／地區集合數量 | 16 | `CARD_REGIONS` |
| 主掉落表數量 | 433 | `MOB_DROPS` name owner |
| 主掉落關聯數量 | 3,655 | Monster name→item ID |
| 唯一掉落 item 數量 | 886 | 主掉落表 |
| 缺 item ID 的主掉落 | 0 | Wiki 顯示掉落則為 4,834 筆 name-only |
| 卡片主體數量 | 409 | runtime monster subjects |
| 三階卡片 item 數量 | 1,227 | runtime generated |
| CardSet→Card 關聯 | 539 | runtime-derived |
| resolved monster ID | 460／460 | `DB.mobs` identity |
| name-only 主掉落 monster 關聯 | 433 | 目前皆可唯一 mapping，仍需正式表 |
| Wiki name-only Monster→Region 列 | 590 | 不能直接成為正式 FK |
| unresolved Region identity | 17 導航群組／16 CardSet 的統一關係未定 | 不虛構 region ID |
| 已證實來源值衝突 | 42 | 全為 Wiki HP vs base HP |

## 11. 可用性分級

### 11.1 可直接進入 Dataset 契約

- `DB.mobs` 的既有 monster ID 與基礎欄位。
- `DB.maps` 的 map key 與 monster ID pool。
- `MOB_DROPS` 的 item ID、base percentage 與 entry 順序／來源位置。
- `CARD_REGIONS.key`、`stat`、`vals` 與 map key candidate。
- 明確的 Boss flag 與程式中可定位的特殊條件。

「可進入契約」只代表可定義來源欄位，不代表可以未經 mapping 直接生成正式 JSON。

### 11.2 需要 mapping

- `MOB_DROPS` monster name → monster ID。
- Wiki monster／item／map name → EntityRef。
- Craft `monsterNameText`、`locationTexts` → MonsterRef／MapRef。
- 現行 Card name key／`player.cardDex` key → 未來 CardRef 或 MonsterRef。
- `MAP_REGIONS`、`CARD_REGIONS` 與未來 Region／Map／CardSet 的 identity 邊界。

### 11.3 需要程式分析

- 完整 Spawn 條件、Boss 節流、任務與模式差異。
- effective drop rate、數量倍率、強制掉落與多層掉落合成。
- 動態 item／卡片生成順序。
- Wiki 的 damage／skill 顯示字串生成規則。
- 42 個 HP 差異是否來自區域倍率、舊快照或人工內容。

### 11.4 無法驗證／unresolved

- 通用 Region 正式 ID 與父子模型。
- 9 個無 `DB.maps` 的怪物是否全部由特殊路徑生成。
- 27 個無 `MOB_DROPS` 表的怪物是否應為無掉落。
- 68 個 Wiki-only item name 的正式 item ID／動態定義來源。
- 80 個主掉落 entry 的 Wiki coverage 差異是否與上述 68 筆重疊。
- 16 組 CardSet 與 Wiki 成員差異的預期規則。
- 變體怪物的正式 base／variant relation。
- 缺省 `dr`／`er`／`mp` 的正式語意。
- 未開放、不可進入、隱藏與事件地圖的統一狀態 enum。

## 12. Stage B 前阻擋問題

1. 必須先決定 Monster ID mapping table 的權威與失敗策略；不能讓 generator 以名稱直接 join。
2. 必須定義 Region、Map、Area、CardSet 是否為不同 Entity，以及 CardSet 是否只持有 MapRef／RegionRef。
3. 必須定義 Drop rate unit 與 roll model；主掉落百分比和卡片 probability 不可混用。
4. 必須把 base drop 與 runtime modifier／conditional drop 分層，否則百科會顯示錯誤的有效掉率。
5. 必須確認 42 個 HP 衝突、68 個 Wiki item mapping 與 CardSet／Wiki 成員差異，不可自動採信任一來源。
6. 必須為 Card 建立不依賴中文名稱的 identity 契約，並另規劃舊存檔 `player.cardDex` 的 compatibility mapping；本階段不產生新 ID。
7. 必須明確排除 PlayerState，避免把收藏分數、背包卡片或 localStorage 搬入靜態 Card Dataset。
8. semantic diff 必須以 canonical Entity 與 relation 比較；排序、顯示 label、emoji、格式化技能文字不可產生假更新。

## 13. 下一階段建議

建議順序：

1. **C. ID mapping table**：先建立只引用既有 ID 的 Monster name→monster ID、map display→map key、legacy Card／Craft name mapping 契約；無法唯一解析者為 `unresolved`。
2. **A. Monster／Region／Drop 資料契約**：在 mapping 與 Region／Map 邊界確立後，定義 Monster、Map、Region、Spawn、DropTable、DropEntry 與 rate unit。
3. **B. Card／CardSet 資料契約**：引用已定案 MonsterRef、MapRef／RegionRef，並處理現行 name-key compatibility。
4. **E. 先修正資料來源衝突**：不是直接改資料，而是在契約後建立可審核的 conflict resolution record，優先處理 42 個 HP 與 CardSet coverage。
5. **D. Generator／validator**：最後才實作；輸入、mapping、unresolved policy 與 semantic diff canonicalization 都定案後再開始。

下一個最小步驟應是 **C：ID mapping table 的文件契約與 mapping 稽核**，不是 generator。它可先解開掉落 owner、Card name key、Wiki 顯示名稱與 Craft legacy source 的共同阻擋，同時不需虛構任何新 ID。

## 14. 本階段變更聲明

本階段只新增本文件。沒有修改 HTML、CSS、JavaScript、`wiki.html`、Craft JSON 或其他資料；沒有建立 Monster／Card JSON、Schema、generator、validator 或 UI；沒有 commit 或 push。
