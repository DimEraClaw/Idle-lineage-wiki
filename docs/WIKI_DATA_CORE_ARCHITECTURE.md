# WikiDataCore 統一資料核心架構

## 1. 文件目的與決策狀態

本文件定義靜態 Wiki 的統一資料核心 `window.WikiDataCore`，供裝備、技能書、製作配方、材料、NPC、怪物、掉落、地區、卡片、任務、試煉、魔法娃娃與套裝逐步共用。

這是 Phase 1C.5 的架構定案，不是實作。本階段不修改網站程式、JSON、Schema、生成器或驗證器。

設計目標：

- 避免持續增加彼此重複的 `CraftWikiData`、`MonsterWikiData`、`EquipWikiData`、`QuestWikiData`。
- Dataset 彼此隔離，不直接呼叫其他 Dataset 的內部函式。
- 所有正式關聯使用穩定 ID；名稱只供顯示與搜尋。
- 同時支援正向與反向查詢，且不複製完整 entity。
- 保持原生 JavaScript、靜態檔案及 GitHub Pages 部署。
- 以 compatibility adapter 漸進遷移，不重寫現有 CraftWikiData 或 UI。

## 2. 架構總覽圖

```text
wiki.html / view modules / URL state
                 │
                 ▼
        window.WikiDataCore
        ├─ loader
        │  └─ Dataset lifecycle / retry / fallback
        ├─ registry
        │  ├─ Dataset definitions
        │  └─ Repository registrations
        ├─ repositories
        │  ├─ items / equipment / skills / recipes
        │  ├─ materials / npcs / monsters / drops / regions
        │  └─ cards / cardSets / quests / dolls / sets
        ├─ indexes
        │  ├─ Dataset-local indexes
        │  └─ Cross-repository reverse indexes
        ├─ relations
        │  └─ EntityRef + Relation graph (Map / Array only)
        ├─ search
        │  ├─ Repository search
        │  └─ Cross-dataset result aggregation
        ├─ navigation
        │  └─ EntityRef → URL state (no DOM rendering)
        ├─ validation
        │  └─ Dataset / entity / reference / relation checks
        └─ diagnostics
           └─ Structured errors and unresolved records

data/*.json
    │
    ├─ craft dataset ── CraftWikiData compatibility adapter
    ├─ equipment dataset
    ├─ monster dataset
    ├─ card dataset
    └─ quest dataset
```

責任邊界：

- 核心管理資料生命週期、repository、索引、關聯、搜尋、導航規格與 diagnostics。
- Repository 只提供資料查詢，不操作 DOM、history 或 UI state。
- View 層決定如何渲染與互動。
- Navigation helper 只產生／套用 URL state，不開 modal、不切換 DOM class。
- Dataset adapter 負責把既有資料 API 接到核心，不要求立即更換資料來源。

## 3. 核心命名空間

正式選擇：

```js
window.WikiDataCore
```

不選 `window.WikiData` 的理由：

- `WikiDataCore` 明確表示這是基礎設施入口，不是一個裝滿所有實體的全域資料物件。
- 可避免與未來頁面區域變數、JSON payload 或 `WikiData` 類型名稱衝突。
- 與現有 `CraftWikiData` 的差異清楚，方便辨識 compatibility adapter 與新核心。

建議公開表面：

```js
window.WikiDataCore = Object.freeze({
  registerDataset,
  loadDataset,
  retryDataset,
  getDatasetStatus,
  getRepository,
  indexes,
  relations,
  search,
  navigation,
  diagnostics,
  resetForTests
});
```

禁止把 repository 方法或 loader helper 逐一平鋪到 `window`。內部以 IIFE 或原生 ES module 風格的 function module 實作；是否採 module script 應在實作階段依現有頁面載入方式決定，不引入 bundler。

## 4. Dataset 註冊

### 4.1 註冊格式

```js
WikiDataCore.registerDataset({
  name: 'craft',
  version: 1,
  requiredFiles: [
    { key: 'recipes', path: './data/craft/recipes.json' },
    { key: 'items', path: './data/craft/items.json' },
    { key: 'npcs', path: './data/craft/npcs.json' }
  ],
  optionalFiles: [
    { key: 'drops', path: './data/craft/drops.json', defaultValue: [] },
    { key: 'unresolved', path: './data/craft/unresolved.json', defaultValue: [] }
  ],
  validator: validateCraftDataset,
  repositoryFactory: createCraftRepositories,
  indexFactory: buildCraftIndexes,
  relationFactory: buildCraftRelations,
  fallback: useCraftCompatibilityAdapter,
  lazy: true
});
```

註冊規則：

- `name` 必須唯一且穩定，只接受小寫英文、數字與連字號／底線。
- 路徑使用 GitHub Pages 相容的相對路徑。
- required file 失敗只阻止該 Dataset ready，不影響其他 Dataset。
- optional file 失敗使用明確 defaultValue，並新增 diagnostic。
- validator 在 repository/index 建立前完成 blocking 檢查。
- repositoryFactory 只接收已驗證的 Dataset payload 與核心服務介面。
- Dataset 可以 lazy load；跨 Dataset 查詢不得暗中載入大量無關資料，需由呼叫端或 search coordinator 明確要求。
- 同名 Dataset 重複註冊是 `index_collision`／registration error，不得覆蓋。

### 4.2 Dataset 隔離

每個 Dataset 有獨立狀態、load Promise、錯誤、repositories、indexes 與 diagnostics：

```text
craft:error       equipment:ready       monster:ready
     └─ 不得讓 craft error 清除或阻止其他 ready dataset
```

Repository 不直接 import 或呼叫其他 Dataset repository。跨資料關聯一律交給 relations/indexes coordinator，或由上層取得兩個 repository 後組合。

### 4.3 Manifest 決策

未來可增加：

```text
data/wiki-manifest.json
```

用途可包含 Dataset 名稱、版本、檔案路徑、必要／可選分類與內容 hash。但 Phase 1C.5 不建立 manifest，Phase 1D 也不應先建立，理由如下：

- 目前只有 craft Dataset 已具完整外部資料與 runtime loader。
- 過早引入 manifest 會新增一個全站啟動失敗點。
- 初期以程式內註冊物件較容易審查、測試與回滾。

當至少三個 Dataset 已穩定接入，且重複的路徑／版本設定開始產生維護成本時，再另案評估 manifest。即使使用 manifest，核心內仍要保留內建最低限度 Dataset 定義或 fallback，不能讓 manifest 404 拖垮全站。

## 5. Repository 介面

### 5.1 共通介面

每個 repository 至少提供：

```ts
interface Repository<T> {
  getById(id: string): T | null;
  getAll(): T[];
  has(id: string): boolean;
  search(keyword: string): SearchResult[];
  getStatus(): RepositoryStatus;
  getValidationErrors(): Diagnostic[];
}
```

共通規則：

- `getAll()` 與多值查詢回傳新陣列或唯讀視圖，呼叫端不得修改核心索引。
- `getById()` 只接受 ID，不做名稱 fallback。
- `search()` 可比對名稱，但結果仍以 EntityRef 識別。
- repository 可獨立注入 fixture 建立，無需 DOM、browser history 或其他 repository，因此可獨立測試。
- repository 不負責 fetch；loader 完成資料驗證後才建立 repository。
- repository status 反映自身 Dataset 狀態，不用 UI 文案取代 diagnostics。

### 5.2 Repository 清單

| Repository | 主要 entityType | Dataset 建議歸屬 |
| --- | --- | --- |
| `items` | `item` | shared/items 或第一階段 craft adapter |
| `equipment` | `equipment` | equipment |
| `skills` | `skillbook`, `skill` | equipment/skills |
| `recipes` | `recipe` | craft |
| `materials` | `material` | materials 或 items view |
| `npcs` | `npc` | shared/npcs |
| `monsters` | `monster` | monsters |
| `drops` | `drop` | monsters/sources |
| `regions` | `region` | monsters/shared |
| `cards` | `card` | cards |
| `cardSets` | `cardSet` | cards |
| `quests` | `quest` | quests |
| `dolls` | `doll` | equipment/dolls |
| `sets` | `set` | equipment/sets |

同一實體若暫時來自不同 Dataset，不得建立互相競爭的主 repository。Registry 需指定 owner Dataset；其他 Dataset 透過 source adapter 或 Relation 引用該 ID。

### 5.3 專用查詢

`recipes`：

- `getByNpcId(npcId): Recipe[]`
- `getByResultId(itemId): Recipe[]`
- `getByRequirementId(itemId): Recipe[]`

`monsters`：

- `getByRegionId(regionId): Monster[]`
- `getByDropId(itemId): Monster[]`

`quests`：

- `getByRequiredItemId(itemId): Quest[]`
- `getByRewardId(entityId): Quest[]`
- `getByNpcId(npcId): Quest[]`

`items`：

- `getSources(itemId): Relation[]`
- `getUsages(itemId): Relation[]`

專用多值查詢永遠回傳陣列，包括 0 或 1 筆。不得以 `resultId -> Recipe` 形式只保存第一筆。

## 6. EntityRef 契約

統一格式：

```json
{
  "entityType": "equipment",
  "entityId": "hlm_silver"
}
```

正式 `entityType` 至少包含：

```text
item
equipment
skillbook
skill
recipe
material
npc
monster
drop
region
card
cardSet
quest
doll
set
```

規則：

- `entityId` 使用 entity owner Dataset 的正式 ID。
- EntityRef 不包含 name；顯示名稱由對應 repository 查詢。
- `entityType + entityId` 是核心內的 entity identity。
- EntityRef 必須指向存在的 entity、合法 stub，或被 diagnostics 明確標示 unresolved。
- 不可把技能書 item ID 假設為 skill ID。
- `cardSet` 採 camelCase，與 entityType 列舉及 URL mapping 統一；檔案／Dataset 名稱仍可使用 kebab-case 或 snake_case。

## 7. Relation 契約

### 7.1 格式

```json
{
  "relationType": "requires",
  "from": {
    "entityType": "recipe",
    "entityId": "recipe_npc_finn_hlm_silver_01"
  },
  "to": {
    "entityType": "material",
    "entityId": "mat_example"
  },
  "metadata": {
    "quantity": 5
  },
  "sourceDataset": "craft",
  "sourceLocation": "recipes.json#recipe_npc_finn_hlm_silver_01"
}
```

正式 `relationType` 至少包含：

```text
requires
produces
drops
located_in
given_by
rewards
belongs_to
part_of_set
requires_card
unlocks
teaches
crafted_by
```

### 7.2 直接生成的 Relation

| 原始資料 | Relation |
| --- | --- |
| Recipe requirement | `recipe requires item/material`，metadata.quantity |
| Recipe result | `recipe produces item`，metadata.quantity |
| Recipe npcId | `recipe crafted_by npc` |
| Monster regionId | `monster located_in region` |
| Monster verified drop itemId | `monster drops item`，metadata.rate/rateUnit |
| Quest npcId | `quest given_by npc` |
| Quest required item | `quest requires item`，metadata.quantity |
| Quest reward | `quest rewards entity`，metadata.quantity/choiceGroup |
| Card monster/source | `card belongs_to monster` 或明確來源關係 |
| Card set membership | `card part_of_set cardSet` |
| Set component | `equipment/item part_of_set set` |
| Skillbook verified skillRef | `skillbook teaches skill` |

只有原始欄位含穩定 ID 且 validator 驗證成功，才能建立 resolved Relation。

### 7.3 反向索引

反向查詢不另造意義相反的 Relation record，而由同一份 Relation 建立索引：

```text
relationsFrom[EntityKey] -> Relation[]
relationsTo[EntityKey]   -> Relation[]
relationsByType[type]    -> Relation[]
```

例如 `recipe requires material` 同時支援：

- 從 recipe 查 requirements。
- 從 material 查被哪些 recipe 使用。

這可避免 `requires` 與自造的 `required_by` 兩份資料漂移。

### 7.4 只能 unresolved 的 Relation

現階段下列資料不能產生 resolved Relation：

- `DROPS_DB.mob` 只有中文名稱、沒有 monster ID。
- `locationTexts`／NPC `locationText` 沒有 region ID。
- 14 個技能書沒有可驗證 skill entity ID。
- 缺 item/NPC 記錄但已有合法 stub 的參照。
- 任何只靠中文名稱才能猜測的 card、quest、monster、region 關聯。

處理方式：保留 source record 或 unresolved relation candidate，產生 `unresolved_reference` diagnostic；不把中文文字填入 EntityRef。

### 7.5 Metadata 格式

Metadata 必須是可 JSON 序列化的 plain object，只保存關聯本身的屬性，例如：

- `quantity: positive integer`
- `rate: finite non-negative number`
- `rateUnit: "percent"`
- `currencyCost: { currency, amount }`（若關聯查詢確有需要）
- `order: non-negative integer`
- `choiceGroup: string | null`
- `requiredLevel: non-negative integer`

禁止在 metadata 複製完整 entity、DOM HTML、render callback 或 repository instance。

### 7.6 去重與 Relation ID

Phase 1 不建立持久化 relation ID。核心建立 deterministic relation key：

```text
relationType | from.entityType | from.entityId |
to.entityType | to.entityId | canonicalMetadata
```

`canonicalMetadata` 使用固定 key 排序的 JSON 表示。完全相同的 key 視為重複 relation，產生 `invalid_relation` 或 `index_collision` diagnostic，不默默覆蓋。

不立即建立獨立 relation ID 的理由：

- Relation 不需要獨立詳情頁或深連結。
- 避免為靜態反向索引引入第二套 ID mapping。
- Relation 可由原始 entity 決定性重建。

若未來 Relation 本身需要引用、編輯或 URL，才由生成器依受版本控制規則建立正式 ID，不使用 runtime 陣列位置或 hash 當永久資料契約。

## 8. 索引策略

### 8.1 註冊 API

```js
WikiDataCore.indexes.register({
  name: 'recipesByResultId',
  dataset: 'craft',
  ownerRepository: 'recipes',
  multi: true,
  rebuild: ({ repositories }) => Map<itemId, recipeId[]>
});
```

規則：

- 索引名稱全核心唯一，或明確使用 `dataset.indexName` namespace。
- 可能多筆時 `multi=true`，value 永遠是 ID 陣列，0 筆時 repository 回傳空陣列。
- 不允許首筆覆蓋。
- 索引只保存 ID，不保存完整 entity object。
- ID 陣列固定排序並去重；排序不參與 entity ID 生成。
- 所有索引都能由 repository entity 及 Relation 重建。
- 每個 repository 聲明自己的 local index；跨 repository index 由核心 relation/index coordinator 建立。
- `resetForTests(dataset?)` 可清除全部或指定 Dataset 的索引、load promise 與狀態。

### 8.2 必要索引

| Index | Value |
| --- | --- |
| `recipesByNpcId` | `Map<npcId, recipeId[]>` |
| `recipesByResultId` | `Map<itemId, recipeId[]>` |
| `recipesByRequirementId` | `Map<itemId, recipeId[]>` |
| `monstersByDropId` | `Map<itemId, monsterId[]>` |
| `monstersByRegionId` | `Map<regionId, monsterId[]>` |
| `questsByRequiredItemId` | `Map<itemId, questId[]>` |
| `questsByRewardId` | `Map<EntityKey, questId[]>` |
| `cardsByRegionId` | `Map<regionId, cardId[]>` |
| `cardSetsByCardId` | `Map<cardId, cardSetId[]>` |
| `itemsByEntityRef` | `Map<EntityKey, itemId[]>` |
| `sourcesByItemId` | `Map<itemId, drop/sourceId[]>` |
| `usagesByItemId` | `Map<itemId, RelationKey[]>` |

`EntityKey` 固定為 `${entityType}:${entityId}`，只作 runtime Map key，不取代 EntityRef JSON 契約。

## 9. Loader 狀態模型

### 9.1 Dataset 狀態

```text
idle
  └─ load() → loading
                 ├─ required valid → ready
                 ├─ required failed + fallback available → fallback
                 └─ required failed + no fallback → error

ready/error/fallback ── retry() → loading
```

狀態欄位建議：

```js
{
  name: 'craft',
  status: 'ready',
  ready: true,
  attempt: 1,
  loadedFiles: [],
  optionalFailures: [],
  lastError: null,
  diagnosticsCount: 0,
  usingFallback: false
}
```

### 9.2 Loader 規則

- 每個 Dataset 有自己的 singleton load Promise 與 state lock。
- 檔案使用 `Promise.allSettled`。
- fetch 檢查 `response.ok`，parse error 與 load error 分開診斷。
- 必要檔失敗不建立部分 repository/index。
- 可選檔失敗可 ready，但需 defaultValue 及 diagnostic。
- `retryDataset(name, options)` 清除該 Dataset 的失敗 Promise，再重新載入；不清除其他 ready Dataset。
- fallback 是 Dataset adapter，不是全站模式。
- lazy Dataset 只在明確 load、repository request with load option 或 cross-search scope 要求時載入。
- loader 不操作 DOM；玩家提示由 view/controller 依 status 決定。
- 開發 diagnostics 可看到失敗檔名；一般玩家只在 Dataset 真正不可用時看到簡短訊息。

## 10. Search 規格

### 10.1 Repository 內部搜尋

第一階段使用簡單靜態掃描：

- keyword 轉字串、trim、使用 `toLocaleLowerCase()`。
- 搜尋正式 ID、name 及 repository 明確白名單欄位。
- 中文名稱正常比對，但不建立關聯。
- 空 keyword 回傳 repository 全部 entity 的結果摘要，或由 options 明確指定空集合；每個 repository 必須文件化，跨搜尋預設空 keyword 回傳空集合以避免大量結果。
- 不搜尋任意巢狀物件、HTML 或未列入的 metadata。

### 10.2 跨資料集搜尋

```js
WikiDataCore.search.query(keyword, {
  datasets: ['equipment', 'craft', 'monsters', 'cards'],
  entityTypes: ['equipment', 'recipe', 'monster', 'card'],
  load: 'ready-only',
  limit: 100
});
```

- Coordinator 呼叫各 repository.search，再合併結果。
- Dataset 失敗只產生該組 diagnostics，不阻止其他結果。
- 預設只搜尋 ready Dataset；使用者操作明確要求時才 lazy load。
- 先以固定欄位 substring match 實作，不做全文倒排索引。
- 結果依 entityType 分組；組內採 match quality、title、entityId 的穩定排序。
- 不引入大型搜尋套件。

### 10.3 統一搜尋結果

```json
{
  "entityType": "monster",
  "entityId": "monster_death_knight",
  "title": "死亡騎士",
  "subtitle": "古魯丁地監 7樓",
  "matchedFields": ["name", "drops"],
  "dataset": "monsters",
  "status": "resolved",
  "score": 100
}
```

- `title`／`subtitle` 只作顯示。
- 導航使用 `entityType`／`entityId`。
- `matchedFields` 只能列出 repository 白名單欄位。
- `score` 是可選、可重建的簡單整數，不形成永久排序契約。

## 11. Navigation 與 URL Helper

### 11.1 API

```js
WikiDataCore.navigation.navigateToEntity(entityRef, {
  history: 'push',
  preserve: ['search'],
  validate: true
});
```

Navigation helper 負責：

- 驗證 entityType。
- 查詢 entity 是否存在／unresolved。
- 根據 mapping 產生 URL。
- 選擇 pushState 或 replaceState。
- 解析 popstate 與目前 URL 成標準 navigation state。

它不負責：

- 切換 DOM class。
- 開 modal/drawer。
- 渲染錯誤畫面。
- 呼叫 repository 內部的 UI callback。

### 11.2 Entity 到 view mapping

| entityType | tab/view | query |
| --- | --- | --- |
| item/material | `materials` 或來源 owner view | `item=<id>` / `material=<id>` |
| equipment | `equip` | `item=<id>` |
| skillbook/skill | `equip` / future `skills` | `item=<id>` / `skill=<id>` |
| recipe | `craft` | `recipe=<id>` |
| npc | `npcs` 或 owner view | `npc=<id>` |
| monster | `monsters`／現有 cards view | `monster=<id>` |
| drop | owner view | `drop=<id>` |
| region | `monsters` | `region=<id>` |
| card | `cards` | `card=<id>` |
| cardSet | `cards` | `cardSet=<id>` |
| quest | `quests` | `quest=<id>` |
| doll | `equip` | `doll=<id>` |
| set | `equip` | `set=<id>` |

最終 query 採：

```text
wiki.html?tab=<view>&<entity-param>=<stable-id>
```

規則：

- 使用者主動導航採 pushState。
- 輸入同步、預設值正規化採 replaceState。
- popstate 只解析 state 並通知 view controller；不由 repository 操作 DOM。
- invalid entityType 產生 `unsupported_entity_type`。
- entity ID 不存在產生 invalid navigation result，不改用名稱猜測。
- unresolved stub 可導航到 owner view 的 unresolved state，但不假裝有完整詳情。
- 關閉詳情移除對應 entity query，保留 tab、search 及允許的 filter。
- 若 entity owner view 尚未實作，回傳 `unsupported_view` 結果，不強制切頁。

## 12. Diagnostics 與驗證

### 12.1 格式

```json
{
  "code": "missing_reference",
  "severity": "error",
  "dataset": "craft",
  "entityType": "recipe",
  "entityId": "recipe_npc_finn_hlm_silver_01",
  "message": "Requirement item is missing.",
  "sourceLocation": "recipes.json#recipe_npc_finn_hlm_silver_01",
  "blocking": true
}
```

正式 code 至少包含：

```text
duplicate_id
missing_reference
unresolved_reference
invalid_relation
load_error
parse_error
schema_error
cycle_detected
unsupported_entity_type
index_collision
```

### 12.2 語意

- `error` 不等於 unresolved。
- unresolved 是已知但尚未完整連結的資料狀態，通常 severity 為 info/warning 且 blocking=false。
- 只有 `blocking=true` 才阻止該 Dataset ready。
- 一個 Dataset 的 blocking diagnostic 不改變其他 Dataset 狀態。
- Diagnostics repository 支援按 dataset、code、severity、entityRef、blocking 查詢。
- 開發模式可輸出完整 diagnostics；一般玩家不看到資料工程細節。
- 只有 Dataset 無法使用時，view 才顯示簡短 fallback／unavailable 訊息。

### 12.3 驗證層級

1. 檔案：HTTP、parse、基本格式。
2. Dataset：Schema、唯一 ID、必填欄位。
3. Repository：entity type、local references、local indexes。
4. Cross Dataset：EntityRef、Relation、owner repository。
5. Graph：cycle、duplicate relation、reverse index consistency。

Cross Dataset unresolved 不應反向讓已 ready 的 owner Dataset 變 error；只有明確契約要求 resolved 的 reference 缺失時才 blocking。

## 13. CraftWikiData 遷移流程

### Stage 0：保持現況

- `CraftWikiData` 完全不動。
- Feature flag 預設 false。
- UI 繼續使用舊 `CRAFT_DATA`。
- WikiDataCore 只有本架構文件，尚未實作。

### Stage 1：Compatibility 包裝

- 建立最小 WikiDataCore skeleton 與 `craft` Dataset adapter。
- Adapter 包裝現有 `CraftWikiData`，不搬移 loader、不改回傳格式、不改 UI。
- 核心 repository 將現有 API 結果轉成標準 repository 表面。
- 以 parity tests 比較 adapter 與原 API 的數量、ID 順序、多配方、搜尋、yield 與錯誤狀態。

Stage 1 必須保留的 CraftWikiData API：

```text
load
validateLoadedData
buildIndexes
getState
isReady
getLoadError
getRecipeById
getRecipesByNpcId
getRecipesByResultId
getRecipesByRequirementId
getItemById
getNpcById
getSourceByItemId
searchRecipes
calculateRecipeRequirements
resetForTests
```

### Stage 2：核心 Registry 成為資料來源

- CraftRepository 改由 WikiDataCore registry 取得已載入資料與 ID indexes。
- `CraftWikiData` 變成 compatibility adapter，內部委派 WikiDataCore。
- 對外 API 與回傳格式保持不變。
- 舊 UI 仍不改。

### Stage 3：UI 受控改讀 CraftRepository

- 以獨立 feature flag 控制 view adapter。
- 新舊 UI 輸入先做 shadow comparison。
- 小步替換 NPC、搜尋、卡片、來源、配方樹，不一次重寫。
- 每一步重跑 baseline、Console 與 Network 測試。

### Stage 4：評估移除 compatibility adapter

只有以下全部成立才可刪除 `CraftWikiData` compatibility adapter：

- 所有保留 API 已無呼叫者，經 repository usage audit 證實。
- 新 UI 全部使用 WikiDataCore repositories。
- Feature flag 開啟與 fallback 測試通過。
- Baseline 與完整回歸連續通過。
- URL、深連結、搜尋、yield、ambiguity、unresolved、retry 均通過。
- 至少一個發行週期／明確驗收期間沒有回退需求。
- 已有單步 rollback commit 或可移除的獨立接線區塊。

WikiDataCore 最終會承接 CraftWikiData 的核心責任，但不是立即以改名方式取代。CraftWikiData 在 Stage 0、1、2、3 全部保留，最早只能於 Stage 4 評估移除。

## 14. 未來 Dataset 接入範例

### 14.1 Monster

```js
WikiDataCore.registerDataset({
  name: 'monsters',
  requiredFiles: [
    { key: 'monsters', path: './data/monsters/mobs.json' },
    { key: 'regions', path: './data/monsters/regions.json' }
  ],
  optionalFiles: [
    { key: 'drops', path: './data/monsters/drops.json', defaultValue: [] }
  ],
  validator: validateMonsterDataset,
  repositoryFactory: createMonsterRepositories,
  indexFactory: buildMonsterIndexes,
  lazy: true
});
```

建立 `monstersByRegionId`。只有 drop item ID 與 monster ID 都可驗證時才建立 `monster drops item` Relation；現有中文 monsterNameText 先保持 unresolved。

### 14.2 Quest

```js
WikiDataCore.registerDataset({
  name: 'quests',
  requiredFiles: [
    { key: 'quests', path: './data/quests/quests.json' }
  ],
  optionalFiles: [],
  validator: validateQuestDataset,
  repositoryFactory: createQuestRepository,
  indexFactory: buildQuestIndexes,
  lazy: true
});
```

建立 `questsByRequiredItemId`、`questsByRewardId`、`questsByNpcId`。若 NPC/item owner Dataset 尚未 ready，Quest 可先完成 local validation；cross-reference 產生 unresolved diagnostic，而非拖垮 equipment 或 craft。

### 14.3 Card

```js
WikiDataCore.registerDataset({
  name: 'cards',
  requiredFiles: [
    { key: 'cards', path: './data/cards/cards.json' },
    { key: 'sets', path: './data/cards/sets.json' }
  ],
  optionalFiles: [],
  validator: validateCardDataset,
  repositoryFactory: createCardRepositories,
  indexFactory: buildCardIndexes,
  lazy: true
});
```

建立 `cardsByRegionId` 與 `cardSetsByCardId`。Card → Monster 只有 monsterId 可驗證時才 resolved；名稱相同不構成關聯。

## 15. 風險

| 風險 | 影響 | 控制方式 |
| --- | --- | --- |
| 核心變成巨型全域物件 | 難測試、模組互相纏繞 | 公開小型 facade；功能留在子模組／repository |
| 過早統一所有資料模型 | 為抽象而丟失各領域語意 | 共用 EntityRef/Relation/狀態；entity schema 保持領域專屬 |
| 同一 entity 多 owner | ID 衝突、資料不同步 | Registry 明定 owner Dataset，其他 Dataset 只引用 |
| 跨 Dataset 載入連鎖 | 單一失敗拖垮全站 | Dataset 狀態與 Promise 隔離，cross reference 可 unresolved |
| Relation 數量膨脹 | 記憶體與初始化時間增加 | 只建必要 Relation／index、lazy Dataset、只存 ID |
| 名稱誤當外鍵 | 錯誤連結難察覺 | Validator 禁止 name fallback，僅保留 unresolved candidate |
| 多值索引首筆覆蓋 | 配方／來源遺失 | multi index 永遠使用排序 ID[]，collision diagnostic |
| Compatibility adapter 永久存在 | 新舊 API 雙重維護 | Stage 4 刪除門檻與 usage audit |
| Core 與 UI 責任混合 | 難以回滾與測試 | Repository/loader 不接 DOM，navigation 只處理 URL state |
| 全文搜尋過度設計 | 增加依賴與 build pipeline | 先用欄位白名單 substring scan |

確實存在過度抽象風險；因此 Phase 1D 只允許實作 core skeleton、registry、最小 repository contract 與 craft adapter，不一次建立全部 repository 的空 class 或假資料。

## 16. 回滾策略

### Phase 1D／Stage 1

- WikiDataCore 使用獨立 script 與 feature flag，預設 false。
- 移除 script 引用或關閉 flag 即回到 Stage 0。
- 不改 `CraftWikiData`、`CRAFT_DATA` 或 UI，因此回滾不需資料轉換。
- Adapter 註冊失敗只產生 core diagnostic；舊 CraftWikiData 仍可用。

### Stage 2

- `CraftWikiData` 保留舊 loader fallback。
- Registry 委派與舊實作需有可切換的單一接線點。
- Dataset error 不清空已存在的 compatibility state。

### Stage 3

- 每個 view adapter 獨立 flag，不使用一個全站開關一次替換全部 UI。
- 每次只遷移一個功能面，失敗時切回舊 renderer。

回滾不得刪除使用者資料、localStorage 或既有 JSON；核心也不應永久寫入 feature flag。

## 17. 驗收條件

### 架構驗收回答

| 問題 | 決策 |
| --- | --- |
| WikiDataCore 是否會取代 CraftWikiData？ | 最終承接核心責任，但不立即取代；依 Stage 1–4 漸進遷移。 |
| CraftWikiData 哪些階段保留？ | Stage 0、1、2、3 全部保留；Stage 4 才評估移除。 |
| Repository 是否可獨立測試？ | 是；以 fixture 建立，不依賴 DOM、history 或其他 repository。 |
| Dataset 失敗是否互相隔離？ | 是；每個 Dataset 有獨立 state、Promise、diagnostics、fallback。 |
| 所有多值索引是否使用陣列？ | 是；value 永遠使用排序後的 ID[]，不首筆覆蓋。 |
| 是否支援 unresolved？ | 是；unresolved_reference 通常 blocking=false，不等於 error。 |
| 是否仍能靜態部署？ | 是；只使用相對 JSON、原生 JavaScript、Map、Array、fetch。 |
| 是否引入框架？ | 否。 |
| 是否改動現有程式？ | Phase 1C.5 沒有；只新增本架構文件。 |
| 是否有過度抽象風險？ | 有；以最小 facade、領域 schema、Stage 1 小實作與不預建空 repository 控制。 |
| Phase 1D 先做什麼？ | 只做 WikiDataCore skeleton、Dataset registry、base repository contract、diagnostics store 與 CraftWikiData read-only compatibility adapter/parity tests。 |

### Phase 1D 最小實作驗收

- `window.WikiDataCore` 只有單一 facade，不平鋪全域函式。
- 可註冊並查詢一個 `craft` Dataset。
- Adapter 不修改、複製或重新 fetch CraftWikiData 已載入資料。
- `recipes`、`items`、`npcs`、`drops` repository 可由 fixture 獨立測試。
- Adapter API parity：279 recipes、47 NPC、471 items、272 result keys、278 requirement keys、471 source keys。
- `hlm_silver` 保留兩份 Recipe。
- 四筆非 1 yield 與 ambiguity 結果和 CraftWikiData 一致。
- Core 失敗不影響 CraftWikiData 舊 API 與 UI。
- Feature flag 預設 false。
- 不改現有 UI、URL 或資料檔。

## 18. Equipment Interaction Repository 規劃

裝備互動是 Equipment Domain 與 Mechanics Layer 之間的一級 Relation。完整契約見 `docs/EQUIPMENT_INTERACTION_CONTRACT.md`。本節只定義未來 WikiDataCore 接入邊界，不代表目前已實作。

### 19.1 Repository

未來新增 `interactions` repository，沿用共通 API，並規劃 `getByEntity`、`getBetween`、`getCompatibleWith`、`getConflictsWith`、`getUnresolvedFor`、`getByMechanicId`。

Repository 不依賴 DOM、history 或 UI state，不把中文名稱作為 key，也不得從裝備描述自行推導 Interaction。

### 19.2 Indexes

- `interactionsByEntityKey`
- `interactionsByPairKey`
- `interactionsByStatus`
- `interactionsByType`
- `interactionsByMechanicId`
- `unresolvedInteractionsByEntityKey`

索引只保存 Interaction ID／不可變引用。對稱 Relation 使用 canonical pair key；非對稱 Relation 保留 from／to。重複 pair、缺少 EntityRef、缺少 Evidence、方向矛盾及無法解析 Mechanic 必須產生 structured diagnostic。

### 19.3 接入順序

1. 完成 equipment ID、Mechanic 與 Evidence 盤點。
2. 定案 Interaction Schema、生成與驗證規則。
3. 建立 repository fixture、索引一致性與方向測試。
4. 以 feature flag 接入 WikiDataCore，預設不改 UI。
5. 完成 parity、fallback 與 baseline 後，才評估受控 UI 呈現。

Evidence、版本範圍或正式 ID 不足時應保留 unresolved，不得以 `compatible` 作為 fallback。

## 19. Release Hub Dataset 規劃

Release Hub 以獨立 `releases` Dataset 提供 GameVersion、Release、ChangeRecord、SyncStatus 與 DatasetSyncStatus 的唯讀發布視圖。完整契約見 `docs/RELEASE_HUB_CONTRACT.md`。本節不代表目前已建立資料或 consumer。

### 19.1 Repository 與索引

規劃 `gameVersions`、`releases`、`changeRecords`、`syncStatus`、`datasetSyncStatuses` repositories，並建立 release/game version、change/release、change/EntityRef、change type 及 dataset/status 索引。

Release Hub 不直接讀寫各 Domain Entity，不以名稱連結，也不從 Git diff 自動生成玩家可見結論。ChangeRecord 只保存 EntityRef，跳轉交由 Navigation Helper。

### 19.2 狀態與載入隔離

- gameVersion、wikiVersion、schemaVersion 分別保存。
- Dataset 層的 partial、review_required、failed、unknown 必須原樣提供 consumer。
- Releases Dataset 載入失敗不得破壞 Equipment、Craft、Monster 等其他 Dataset。
- sync-status 缺失時為 unknown，不得從最新 Release 推算 up_to_date。
- unresolved EntityRef 保留診斷與顯示能力，不得虛構目標。

### 19.3 接入順序

1. 定案版本來源、semantic diff 與人工 review 契約。
2. 經另行核准後建立資料、Schema、生成與 validator。
3. 建立 deterministic fixture、repository、index 與 navigation tests。
4. 以 feature flag 接入首頁 consumer。
5. 完成 fallback、Console、Network 與 baseline 後才發布。

## 20. 明確不做的事項

- 不使用 dependency injection framework。
- 不使用 Redux、GraphQL 或前端框架。
- 不建立 class hierarchy 或 enterprise service container。
- 不引入 npm build pipeline 或 bundler。
- 不建立 graph database。
- 不在核心複製完整 entity 到每個索引。
- 不以名稱建立正式 Relation。
- 不在本階段建立 manifest。
- 不在本階段實作全文索引或大型搜尋套件。
- 不讓 repository 操作 DOM。
- 不一次重寫 CraftWikiData。
- 不直接改名 CraftWikiData 來假裝完成統一。
- 不在 Phase 1C.5 開始 Phase 1D 程式實作。
