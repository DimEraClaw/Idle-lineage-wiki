# Monster／Card Stage B0：Legacy ID Mapping 映射稽核

## 1. 稽核範圍與口徑

本報告依 `docs/LEGACY_ENTITY_MAPPING_CONTRACT.md` 稽核目前怪物、掉落 owner、Wiki、Craft、地圖 label、location、item name 與 card legacy key。只分析現有 ID；沒有建立正式 mapping records 或新 Entity ID。

統計以唯一 `sourceValue` 為主，另在必要處列出 occurrence。`exact_name` 只有在目標集合名稱唯一時才算 resolved。Map target 嚴格限定為 `DB.maps` key；navigation group、CardSet key 與 Wiki region key 不視為 Map ID。

## 2. 總覽

| mappingType | 唯一來源 | resolved | unresolved | ambiguous | conflict | compatibility_only | missing_target |
|---|---:|---:|---:|---:|---:|---:|---:|
| `monster_name_to_id` | 460 | 460 | 0 | 0 | 0 | 0 | 0 |
| `drop_owner_to_monster_id` | 433 | 433 | 0 | 0 | 0 | 0 | 0 |
| `wiki_monster_to_monster_id` | 408 | 408 | 0 | 0 | 0 | 0 | 0 |
| `craft_monster_to_monster_id` | 366 | 365 | 1 | 0 | 0 | 0 | 0 |
| `map_label_to_map_id` | 118 | 100 | 0 | 0 | 0 | 0 | 18 |
| `wiki_location_to_map_id` | 203 | 83 | 120 | 0 | 0 | 0 | 0 |
| `legacy_card_key_to_monster_id` | 409 | 409 | 0 | 0 | 0 | 409 migration uses | 0 |
| `legacy_card_key_to_card_candidate` | 409 | 0 | 409 | 0 | 0 | 0 | 0 |
| `item_name_to_item_id` | 845 | 827 | 18 | 0 | 0 | 0 | 0 |
| `alias_to_entity_id` | 0 verified aliases | 0 | 0 | 0 | 0 | 0 | 0 |

補充：

- Wiki monster occurrence 為 590，皆落在上述 408 個唯一名稱並可 exact resolve。
- Craft 有 471 個 SourceRecord、1,277 個 monster source occurrence、366 個唯一 monsterNameText。
- Wiki 有 4,834 個掉落 occurrence、845 個唯一 item name；4,766 occurrence 可 exact resolve，68 occurrence unresolved。
- 本快照未發現任何來源同名對多個 monster ID、item ID 的 ambiguous／conflict。
- alias resolved 為 0；不得把 exact name 統計誤報為 alias。

## 3. 怪物名稱 mapping

### 3.1 `DB.mobs`

- monster ID：460。
- canonical name：460。
- 名稱唯一：460；同名不同 ID：0。
- `monster_name_to_id`：460／460 exact resolved。
- 安全顯示正規化（NFKC、trim、連續空白、括號字形）collision：0。

若未來新增重名，validator 必須讓所有受影響的 `exact_name` mapping 失去唯一 resolved 資格並報 `ambiguous_mapping`；不得依物件順序選第一筆。

### 3.2 Drop owner

- `MOB_DROPS` owner：433 個唯一名稱。
- exact unique match：433／433。
- alias、ambiguous、unresolved、missing target、conflict：皆 0。
- owner 仍是名稱 key；本結果只證明目前快照可映射，不代表名稱已成正式 identity。
- 27 個無主掉落表怪物不是 mapping error。

### 3.3 Wiki monster

- 唯一名稱：408；occurrence：590。
- exact unique match：408／408；occurrence 590／590。
- ambiguous、unresolved、conflict：0。
- Wiki 名稱仍只是 legacy sourceValue。

### 3.4 Craft monster

- 唯一 monsterNameText：366；monster source occurrence：1,277。
- resolved：365。
- unresolved：1，完整清單為 `精靈墓穴怪物`。
- 此字串較像集合／人工描述，未在 `DB.mobs[].n` 找到 target；不得猜成某一隻怪物或 Region。
- ambiguous、conflict、missing target：0。

### 3.5 Card legacy monster key

- `CARD_MOB_INFO` runtime name keys：409。
- 409／409 可 exact unique 映射至 monster ID。
- 9 個無 `DB.maps` pool 的怪物只影響 spawn coverage，不影響其 `DB.mobs` identity；若出現在 legacy mapping 仍可正常 resolve。
- `player.cardDex` 的實際玩家 key 集合取決於存檔，不能由 repository 靜態窮舉；目前可提供的 compatibility universe 是這 409 個 card subject name。

## 4. 地圖與 location mapping

### 4.1 identity 空間

| 空間 | 數量 | 結論 |
|---|---:|---|
| `DB.maps` key | 214 | 本階段唯一 Map ID target |
| `MAP_REGIONS` navigation group | 17 | UI grouping，不是 Map／Region ID |
| `MAP_REGIONS` map entry | 118 | label + navigation value |
| `CARD_REGIONS` CardSet key | 16 | CardSet identity，不是 Region ID |
| Wiki `REGIONS_DATA` key | 16 | Wiki display grouping；不可冒充 CardSet／Region ID |
| Wiki location unique text | 203 | name／ID／樓層集合混合來源 |

### 4.2 Navigation map entries

- 118 個 label 全部唯一；label→多 key：0。
- 多 label→同 key：0。
- 100 個 entry 的 `v` 可在 `DB.maps` 驗證。
- 18 個 `v` 不在 `DB.maps`，依本階段 Map ID 定義為 `missing_target` candidates。它們多為 town／入口 destination，不能因此補建 Map ID：

```text
銀騎士村莊 → town_silver_knight
妖精森林村莊 → town_elf
說話之島村莊 → town_talking
燃柳村莊 → town_gludio
海賊島村莊 → town_pirate_village
海音城鎮 → town_heine
奇岩城鎮 → town_giran
沉默洞穴 → town_silent
威頓村莊 → town_witon
貝希摩斯 → town_behemoth
歐瑞村莊 → town_oren
象牙塔（1~3樓） → town_ivory_tower
希培利亞 → town_hyperia
亞丁城鎮 → town_aden
傲慢之塔1樓 → town_pride
炎魔謁見所 → town_flame_audience
時空裂痕入口 → town_rift
席琳神殿 → town_sherine
```

### 4.3 CardSet map references

- CardSet：16。
- 展開 `__pride__` 後引用 206 個既有 map key。
- resolved：206／206；missing：0。
- 這只驗證 CardSet→Map candidate relation，不把 CardSet key 變成 Region ID。

### 4.4 Wiki location

- unique location text：203。
- exact ID：2（`hidden_antqueen`、`tikal_altar`）。
- exact unique navigation label：81。
- resolved total：83。
- ambiguous：0。
- unresolved：120。

完整 unresolved 清單：

```text
大洞穴隱遁者地區
風木地監
無生命實驗室
封印精靈地監
傲慢之塔 2 樓
傲慢之塔 2~10 樓
傲慢之塔 3 樓
傲慢之塔 4 樓
傲慢之塔 5 樓
傲慢之塔 6 樓
傲慢之塔 7 樓
傲慢之塔 8 樓
傲慢之塔 9 樓
傲慢之塔 10 樓
傲慢之塔 11 樓
傲慢之塔 11~20 樓
傲慢之塔 12 樓
傲慢之塔 13 樓
傲慢之塔 14 樓
傲慢之塔 15 樓
傲慢之塔 16 樓
傲慢之塔 17 樓
傲慢之塔 18 樓
傲慢之塔 19 樓
傲慢之塔 20 樓
傲慢之塔 21 樓
傲慢之塔 21~30 樓
傲慢之塔 22 樓
傲慢之塔 23 樓
傲慢之塔 24 樓
傲慢之塔 25 樓
傲慢之塔 26 樓
傲慢之塔 27 樓
傲慢之塔 28 樓
傲慢之塔 29 樓
傲慢之塔 30 樓
傲慢之塔 31 樓
傲慢之塔 31~40 樓
傲慢之塔 32 樓
傲慢之塔 33 樓
傲慢之塔 34 樓
傲慢之塔 35 樓
傲慢之塔 36 樓
傲慢之塔 37 樓
傲慢之塔 38 樓
傲慢之塔 39 樓
傲慢之塔 40 樓
傲慢之塔 41 樓
傲慢之塔 41~50 樓
傲慢之塔 42 樓
傲慢之塔 43 樓
傲慢之塔 44 樓
傲慢之塔 45 樓
傲慢之塔 46 樓
傲慢之塔 47 樓
傲慢之塔 48 樓
傲慢之塔 49 樓
傲慢之塔 50 樓
傲慢之塔 51 樓
傲慢之塔 51~60 樓
傲慢之塔 52 樓
傲慢之塔 53 樓
傲慢之塔 54 樓
傲慢之塔 55 樓
傲慢之塔 56 樓
傲慢之塔 57 樓
傲慢之塔 58 樓
傲慢之塔 59 樓
傲慢之塔 60 樓
傲慢之塔 61 樓
傲慢之塔 61~70 樓
傲慢之塔 62 樓
傲慢之塔 63 樓
傲慢之塔 64 樓
傲慢之塔 65 樓
傲慢之塔 66 樓
傲慢之塔 67 樓
傲慢之塔 68 樓
傲慢之塔 69 樓
傲慢之塔 70 樓
傲慢之塔 71 樓
傲慢之塔 71~80 樓
傲慢之塔 72 樓
傲慢之塔 73 樓
傲慢之塔 74 樓
傲慢之塔 75 樓
傲慢之塔 76 樓
傲慢之塔 77 樓
傲慢之塔 78 樓
傲慢之塔 79 樓
傲慢之塔 80 樓
傲慢之塔 81 樓
傲慢之塔 81~90 樓
傲慢之塔 82 樓
傲慢之塔 83 樓
傲慢之塔 84 樓
傲慢之塔 85 樓
傲慢之塔 86 樓
傲慢之塔 87 樓
傲慢之塔 88 樓
傲慢之塔 89 樓
傲慢之塔 90 樓
傲慢之塔 91 樓
傲慢之塔 91~100 樓
傲慢之塔 92 樓
傲慢之塔 93 樓
傲慢之塔 94 樓
傲慢之塔 95 樓
傲慢之塔 96 樓
傲慢之塔 97 樓
傲慢之塔 98 樓
傲慢之塔 99 樓
傲慢之塔 100 樓
暗殺軍王之室
魔獸軍王之室
法令軍王之室
冥法軍王之室
底比斯沙漠
底比斯金字塔內部
底比斯歐西里斯祭壇
```

其中傲慢之塔文字包含單樓層與範圍描述；範圍不一定對應單一 map key，不能靠移除空白或轉換數字自動建立 mapping。其他名稱可能能由 `HIDDEN_AREA_NAMES`、CardSet maps 或人工規則找到候選，但未經正式一對一證據前維持 unresolved。

## 5. Item name mapping

### 5.1 `DB.items` 基線

- `js/00-data.js` 基礎 item ID：1,340。
- 基礎 item name：1,340 個，全部唯一。
- 同名多 ID：0。
- 安全顯示正規化 collision：0。
- 載入卡片程式後會動態增加卡片相關 item；這些 runtime item 不改變本次 Wiki drop name 的 exact mapping 結論。

### 5.2 Wiki drop names

- occurrence：4,834。
- unique name：845。
- exact resolved unique names：827。
- exact resolved occurrence：4,766。
- ambiguous：0。
- unresolved unique strings：18。
- unresolved occurrence：68。

18 個 unresolved 字串的完整來源：

| sourceValue | 次數 | Wiki 怪物來源 | 分類 |
|---|---:|---|---|
| `item_pride_scroll_11` | 5 | 變種蛇女、變種楊果里恩、梅杜莎、奇美拉、扭曲的潔尼斯女王 | ID-like display text；missing item target |
| `item_pride_scroll_21` | 5 | 死亡之劍、邪惡密密、邪惡多眼怪、魔狼、不幸的幻象眼魔 | 同上 |
| `item_pride_scroll_31` | 6 | 恐怖的火炎蛋、恐怖夢魘、恐怖的地獄犬、小惡魔、恐怖的伊弗利特、恐怖的吸血鬼 | 同上 |
| `item_pride_scroll_41` | 7 | 殘暴的骷髏斧兵、殘暴的骷髏槍兵、殘暴的食屍鬼、殘暴的史巴托、殘暴的骷髏神射手、殘暴的骷髏鬥士、死亡的殭屍王 | 同上 |
| `item_pride_scroll_51` | 7 | 恐怖的鋼鐵高崙、火焰之魔法師、幼龍、火焰之靈魂(紅)、火焰之靈魂(藍)、骨龍、地獄的黑豹 | 同上 |
| `item_pride_scroll_61` | 5 | 受詛咒的妖魔殭屍、受詛咒的艾爾摩法師、受詛咒的艾爾摩士兵、受詛咒的艾爾摩將軍、不死的木乃伊王 | 同上 |
| `item_pride_scroll_71` | 5 | 暗黑萊肯、火焰烈炎獸、冷酷冰原老虎、火焰阿西塔基奧、冷酷的艾莉絲 | 同上 |
| `item_pride_scroll_81` | 5 | 暗黑黑騎士、暗黑火焰弓箭手、暗黑火焰戰士、暗黑思克巴女皇、闇黑的騎士范德 | 同上 |
| `item_pride_scroll_91` | 5 | 傲慢的潔尼斯女王、小幻象眼魔、恐怖的殭屍王、馬昆斯吸血鬼、不滅的巫妖 | 同上 |
| `item_pride_sealed_11` | 2 | 扭曲的潔尼斯女王、邪惡的鐮刀死神 | ID-like display text；missing item target |
| `item_pride_sealed_21` | 2 | 不幸的幻象眼魔、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_31` | 2 | 恐怖的吸血鬼、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_41` | 2 | 死亡的殭屍王、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_51` | 2 | 地獄的黑豹、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_61` | 2 | 不死的木乃伊王、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_71` | 2 | 冷酷的艾莉絲、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_81` | 2 | 闇黑的騎士范德、邪惡的鐮刀死神 | 同上 |
| `item_pride_sealed_91` | 2 | 不滅的巫妖、邪惡的鐮刀死神 | 同上 |

分類結論：

- 18 個字串都同時出現在 `js/01-drops-config.js` 的掉落 entry，證明不是單純 Wiki 拼字或人工描述。
- 它們使用看似 item ID 的字串，但在 `js/00-data.js` 基礎 `DB.items` 與本次已檢查的 runtime 卡片生成後仍無 target。
- 未找到可驗證的舊名稱、格式差異或已建立 runtime item 定義。
- 因此 18 個 unique／68 occurrences 維持 `unresolved`；不能把 sourceValue 直接當正式 item ID。

## 6. Card legacy key 風險

1. `CARD_MOB_INFO[monsterName]`、`CARD_MOB_REGIONS[monsterName]`、`CARD_MOB_MAPS[monsterName]` 都以名稱作 runtime key。
2. `player.cardDex[monsterName]` 與 localStorage `lineage_idle_carddex` 保存名稱 key；名稱改變會使舊進度無法自然合併。
3. `card_<tier>_<monsterName>` 是 runtime item ID，混合 tier 與中文名稱，不等於未來 Card ID。
4. 目前 409 個 card subject name 都可唯一映射 MonsterRef，但這只足以建立 compatibility mapping。
5. `legacy_card_key_to_card_candidate` 因未來 Card identity 尚未定案，409 筆均應 unresolved；不得把 Monster ID 或 runtime item ID冒充 Card ID。
6. 若未來怪物重名，現有 name-key 將同時影響 card index、背包 card item 與存檔進度，必須阻止自動選第一筆。
7. migration 失敗時必須保留原 key/value；不可丟棄、覆蓋或合併到相似名稱。
8. 新靜態 Card Dataset 不得包含 `player.cardDex` 分數或 localStorage 狀態。

## 7. 正規化與 collision 稽核

以 NFKC、trim、連續空白壓縮與括號字形統一進行只讀 collision 掃描：

| 集合 | 原始名稱數 | collision |
|---|---:|---:|
| Monster names | 460 | 0 |
| 基礎 Item names | 1,340 | 0 |
| MAP_REGIONS labels | 118 | 0 |

此結果不授權自動 mapping；它只表示目前安全規則未造成已知 collision。傲慢之塔樓層文字若再套用刪空白、數字／範圍改寫可能碰撞或改變語意，因此不得自動正規化成正式關聯。

## 8. 主要衝突與 unresolved

### 8.1 已證實 conflict／ambiguous

- 同一 sourceValue 指向不同 monster ID：0。
- monster／item exact-name ambiguity：0。
- navigation label→多 map key：0。
- 正規化 collision：0。
- 目前沒有需要先裁決的 mapping conflict。

### 8.2 需要人工 mapping 的完整集合

- Craft monster：`精靈墓穴怪物`（1 unique）。
- Wiki item：第 5.2 節的 18 unique／68 occurrences。
- Wiki location：第 4.4 節的 120 unique texts。
- Navigation targets：第 4.2 節的 18 missing targets；需先判斷是否屬另一種 Destination Entity，而非直接補 Map。
- Card candidate：409 個 legacy card subject 均等待未來 Card identity 契約；MonsterRef compatibility 已可解析。

### 8.3 不應列為 mapping error

- 9 個無 map pool 的 Monster：Monster ID 本身仍可 mapping。
- 27 個無主掉落表的 Monster：absence of relation，不是 identity failure。
- CardSet／Wiki Region key 不同用途：不是 alias，不能互相 mapping 成同一 Region ID。

## 9. 建議優先修正項目

1. 先定義 machine-readable mapping 的 scope、version 與 stable mapping ID Schema，但只納入已驗證 target；unresolved 保留原文。
2. 優先建立 433 drop owner、408 Wiki monster、365 Craft monster 與 409 card legacy name 的 MonsterRef mapping；這些目前無 ambiguity。
3. 對 `精靈墓穴怪物` 建立 unresolved record，不手動猜怪物。
4. 釐清 18 個 pride item target 是否缺少 item 定義或載入階段；在證據出現前不建立 item mapping。
5. 將 120 個 Wiki location 分成單 map、樓層集合、隱藏地圖 label 與區域描述，再決定 Map／MapGroup／Region 契約。
6. Card identity 定案前，只允許 cardDex→MonsterRef compatibility mapping，不遷移成虛構 CardRef。

## 10. WikiDataCore mappings repository 接入

建議註冊獨立 `mappings` repository，實作時遵守 `LEGACY_ENTITY_MAPPING_CONTRACT`：

- 共通查詢：`getById`、`getAll`、`has`、`search`、`getStatus`、`getValidationErrors`。
- 專用查詢：`resolve`、`getCandidates`、`getByTarget`、`getAliases`、`getLegacyKeys`、`getUnresolved`、`getConflicts`。
- `resolve` 只回傳唯一 resolved EntityRef。
- compatibility mapping 必須由呼叫端顯式允許，不能流入 canonical relation。
- repository 不操作 DOM，不修改 Monster／Card／Craft Dataset。
- mapping failure 預設為局部 structured diagnostic；required relation 才阻擋對應 Dataset 驗證。
- canonical `getById` 不得依賴 mapping repository。

## 11. 下一步判斷

建議低風險順序：

1. **A. machine-readable mapping JSON／Schema**：可以進入，但先只建立 mapping 基礎設施、resolved Monster mappings 與 unresolved records；不得同時發明 Card／Region ID。
2. **B. Monster／Map／Drop 資料契約**：接續定義 MonsterRef、Map 與 DropTable／DropEntry，並明確處理 18 navigation missing targets 與 conditional drop。
3. **C. Card／CardSet 資料契約**：在 MonsterRef 與 Map 契約穩定後定義 Card identity、variant 與 save compatibility。
4. **D. mapping 衝突處理**：目前沒有 actual ambiguous／conflict 需要先阻擋；但 18 item、120 location、1 Craft monster 與 409 Card candidates 必須維持 unresolved，逐項補證據。

因此可進入 A 的最小骨架與 Schema 設計；資料內容應先限制在可驗證 mapping，不應直接開始完整 Monster／Card generator。

## 12. 變更聲明

本階段只新增 `docs/LEGACY_ENTITY_MAPPING_CONTRACT.md` 與 `docs/MONSTER_CARD_MAPPING_AUDIT.md`。沒有修改 HTML、CSS、JavaScript、`wiki.html`、JSON、存檔格式、Card identity 或掉落 owner，也沒有建立 mapping JSON、Schema、generator、validator、commit 或 push。
