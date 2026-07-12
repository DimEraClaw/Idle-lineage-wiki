# Wiki 最終架構規劃

## 1. 網站模組圖

```text
index.html
└─ 遊戲主體
   ├─ 啟動畫面
   ├─ 角色建立
   ├─ 遊戲主介面
   ├─ 戰鬥系統
   ├─ 地圖與任務
   ├─ 商店與儲存
   └─ 裝備 / 卡片 / 寵物 / 召喚等子系統

wiki.html
└─ 百科主體
   ├─ 裝備百科
   ├─ 製作百科
   ├─ 怪物百科
   ├─ 卡片收藏
   ├─ 任務百科（未來）
   ├─ NPC 百科（未來）
   └─ 材料百科（未來）
```

### 模組責任邊界
- index.html：維持遊戲本體，不做百科資料重構。
- wiki.html：作為百科入口與資料展示中心。
- data/：收斂所有靜態百科資料與未來結構化資料。
- js/：保留互動邏輯與 UI 渲染，但逐步改為依賴 data/ 的結構化資料。

---

## 2. 頁面結構

### 2.1 主頁面
- /wiki.html
- 目前為主要百科入口。
- 未來仍維持為單一入口頁，根據 URL 參數切換子視圖。

### 2.2 子頁面視圖
- /wiki.html?tab=equip
- /wiki.html?tab=craft
- /wiki.html?tab=cards
- /wiki.html?tab=quests（未來）
- /wiki.html?tab=npcs（未來）
- /wiki.html?tab=materials（未來）

### 2.3 詳細頁
未來可擴充為：
- /wiki.html?tab=equip&id=wpn_123
- /wiki.html?tab=quests&id=quest_001
- /wiki.html?tab=monsters&id=mob_ghost

### 2.4 內容分區
- 左側：側邊欄分類與篩選
- 中央：查詢結果與列表
- 右側/彈窗：詳細內容

---

## 3. 資料流程

### 3.1 現況
- 資料目前主要直接嵌在 [wiki.html](wiki.html) 中。
- 內容由內建的 JavaScript 常數提供。

### 3.2 未來目標
資料應改為：
1. 從 data/ 下的結構化檔案讀取。
2. 由一層資料層提供給各個頁面與模組。
3. 瀏覽器端先載入資料，再由 UI 模組渲染畫面。

### 3.3 資料流向
```text
data/*.json / data/*.js
        ↓
   data layer / loader
        ↓
   view model / filter logic
        ↓
   UI renderer
```

### 3.4 資料層責任
- 負責載入與解析資料。
- 提供查詢、索引、快取與過濾功能。
- 不直接負責 DOM 渲染。

---

## 4. 資料關聯

### 4.1 裝備資料
- 裝備會關聯到：
  - 來源怪物
  - 任務
  - NPC
  - 材料
  - 稀有度與職業需求

### 4.2 製作資料
- 製作配方會關聯到：
  - 產物 item
  - 材料 item
  - NPC
  - 任務
  - 掉落來源

### 4.3 怪物資料
- 怪物會關聯到：
  - 掉落物
  - 地區
  - 任務
  - 卡片

### 4.4 卡片資料
- 卡片會關聯到：
  - 怪物
  - 掉落來源
  - 套裝/效果

### 4.5 未來的跨資料關聯
- Quest ↔ NPC
- Quest ↔ Item
- NPC ↔ Craft Recipe
- Monster ↔ Drop Item
- Item ↔ Source / Location

---

## 5. URL 規格

### 5.1 入口與視圖
- /wiki.html?tab=equip
- /wiki.html?tab=craft
- /wiki.html?tab=cards
- /wiki.html?tab=quests

### 5.2 篩選與搜尋
- /wiki.html?tab=equip&category=equipment&group=weapon&type=one_hand_sword
- /wiki.html?tab=craft&npc=npc_sebas
- /wiki.html?tab=cards&region=silverknight

### 5.3 詳細內容
- /wiki.html?tab=equip&id=wpn_123
- /wiki.html?tab=quests&id=quest_001
- /wiki.html?tab=monsters&id=mob_ghost

### 5.4 規則
- `tab` 為主視圖。
- `id` 表示單一實體。
- `category`、`group`、`type` 表示篩選條件。
- `search` 保留關鍵字搜尋。

---

## 6. ID 規格

### 6.1 通用原則
- ID 必須穩定、可讀、避免空白與特殊字元。
- 優先使用英文小寫與底線。

### 6.2 建議格式
- 裝備：`wpn_`、`arm_`、`acc_`、`skillbk_`
- 材料：`mat_`
- 怪物：`mob_`
- 任務：`quest_`
- NPC：`npc_`
- 卡片：`card_`

### 6.3 範例
- `wpn_redflame_sword`
- `mat_unicorn_horn`
- `mob_ghost_knight`
- `quest_knight_trial_15`
- `npc_gant`
- `card_ghost_knight`

---

## 7. 模組拆分策略

### 7.1 第一層：頁面層
- wiki-page.js：負責頁面初始化與路由。
- wiki-nav.js：負責標籤與分頁切換。
- wiki-state.js：負責頁面狀態與 URL 同步。

### 7.2 第二層：視圖層
- equip-view.js：裝備頁 UI 與渲染。
- craft-view.js：製作頁 UI 與渲染。
- cards-view.js：卡片頁 UI 與渲染。

### 7.3 第三層：資料層
- data-loader.js：載入資料。
- data-index.js：建立索引與查詢介面。
- data-transform.js：資料格式轉換。

### 7.4 第四層：共用元件
- modal.js：詳細內容彈窗。
- drawer.js：掉落來源抽屉。
- filter-bar.js：搜尋與篩選控制。

### 7.5 遷移策略
- 先保留 [wiki.html](wiki.html) 的外觀與互動。
- 先把資料從內嵌常數搬到 data/。
- 再把 UI 邏輯拆成視圖模組。
- 最後再把 state 與路由抽離。

---

## 8. data 資料夾規劃

### 8.1 建議目錄
```text
data/
  equip/
    items.json
    categories.json
  craft/
    recipes.json
    npc.json
    items.json
  monsters/
    regions.json
    mobs.json
    drops.json
  cards/
    cards.json
    sets.json
  quests/
    quests.json
  npcs/
    npcs.json
  materials/
    materials.json
  shared/
    classes.json
    rarity.json
    locations.json
```

### 8.2 規則
- 每個子資料夾以實體類型命名。
- 同類資料盡量集中，避免散落的陣列與字典。
- 需要關聯時由 ID 連接，而不是重複各自的完整內容。

---

## 9. 未來 Quest、NPC、Monster、Cards 的資料模型

### 9.1 Quest
```json
{
  "id": "quest_knight_trial_15",
  "name": "騎士 15 級試煉任務",
  "type": "class_trial",
  "level": 15,
  "npcId": "npc_gant",
  "rewardItems": ["item_001"],
  "requirements": [],
  "description": "..."
}
```

### 9.2 NPC
```json
{
  "id": "npc_gant",
  "name": "甘特",
  "location": "銀騎士村",
  "craftRecipeIds": ["recipe_001"],
  "questIds": ["quest_knight_trial_15"],
  "shopItems": []
}
```

### 9.3 Monster
```json
{
  "id": "mob_ghost_knight",
  "name": "亡靈騎士",
  "regionId": "region_silverknight",
  "level": 20,
  "drops": ["item_001", "item_002"],
  "maps": ["銀騎士村周邊"],
  "skills": []
}
```

### 9.4 Cards
```json
{
  "id": "card_ghost_knight",
  "name": "亡靈騎士卡",
  "monsterId": "mob_ghost_knight",
  "rarity": "rare",
  "effects": [],
  "regionId": "region_silverknight"
}
```

### 9.5 資料模型原則
- 使用 ID 關聯，而不是把完整物件重複塞進多份資料。
- 每份資料保留必要欄位即可，避免過度冗餘。
- 過濾與顯示字段由 view 層決定，不要把 UI 邏輯塞進資料結構。

---

## 10. 開發階段規劃

### 第一階段：資料抽離
目標：
- 將目前 [wiki.html](wiki.html) 中的 `EQUIP_DATA`、`CRAFT_DATA`、`REGIONS_DATA` 逐步抽離到 data/。
- 保持現有頁面外觀與互動不變。

### 第二階段：資料層與索引
目標：
- 建立統一資料讀取與查詢層。
- 提供搜尋、分類、關聯查詢。

### 第三階段：視圖模組化
目標：
- 將裝備、製作、卡片頁面的渲染邏輯拆分成獨立模組。
- 不改變使用者看到的功能流程。

### 第四階段：擴展百科內容
目標：
- 加入 Quest、NPC、Material 的資料模型與頁面。
- 保持 URL 與資料模型一致。

### 第五階段：進一步優化
目標：
- 增加頁面快取、資料預載入、錯誤處理與可維護性。
- 逐步把百科從內嵌資料轉為更清晰的結構化資料系統。

---

## 11. 實作順序建議

1. 先不改動現有 HTML/CSS/JS 的功能。
2. 先建立 data/ 與資料載入層。
3. 再將 [wiki.html](wiki.html) 中的內嵌資料改成從 data/ 載入。
4. 最後才拆分 UI 模組與路由邏輯。

這樣可確保整體能夠漸進式完成，且不會一次性引入大規模重構風險。
