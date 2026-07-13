# Monster Domain Stage C1 後續計畫

## 1. 目的

本計畫將 C1 的 Monster、Map、Drop Data Contract 分解為 C2～C5。各階段採最小、可驗證、可回退的增量，不修改遊戲原始資料，不以名稱建立 canonical identity。

## 2. 固定邊界

- Monster ID：既有 `DB.mobs` key。
- Map ID：既有 `DB.maps` key。
- Item ID：既有 Item ID。
- Region、Card、MapGroup 不在 C1／C2 自行建立新 ID。
- Legacy mapping 是 compatibility/input adapter，不是 canonical repository。
- Base Drop、Runtime Modified Drop、Display Drop 分層。
- 所有跨 Domain 關聯使用 EntityRef。

## 3. Stage C2：Schema、Generator、Validator

### 3.1 Monster Schema

建立 Monster Schema，包含：

- identity、canonical base fields、nullable unresolved fields。
- Stats、Verification、Version、EntityRef、RelationRef definitions。
- relation summaries 與 derived fields 的可重建規則。
- additionalProperties policy、enum、數值範圍與 null semantics。

### 3.2 Map Schema

建立 Map、SpawnPool、SpawnEntry 與 Navigation metadata Schema：

- mapId 僅允許既有 DB.maps key target。
- NavigationGroup 與 Region 分離。
- parent/child、floor、availability 可 unresolved。
- monsterPool/bossPool 為 derived summaries。

### 3.3 Drop Schema

建立 DropTable、DropEntry、Probability、Condition 與 RuntimeModifier Schema：

- base percent 與 card probability 分 unit。
- owner/item 使用 EntityRef。
- unresolved target、unknown roll model與 quantity 有明確結構。
- DropTable／Entry ID assignment 先以文件／fixture 定案，不靠 index。

### 3.4 Generator

Generator 只從明確 source root 離線讀取：

- Monster base：`DB.mobs`。
- Map pool：`DB.maps`。
- Base Drop：`MOB_DROPS`。
- Runtime conditions/modifiers：只抽取 C2 明確支援的路徑；其他列 unresolved。
- Legacy names：透過 Stage B1 mapping Dataset解析。

輸出需 UTF-8、LF、固定排序、單一 newline、byte-stable，不含絕對路徑。Generator 不修改來源。

### 3.5 Validator

至少檢查：

- 460 Monster identity 與 required base fields。
- 214 Map ID、Map→Monster target、重複 pool entry。
- 433 Base Drop owners、3,655 entries、886 unique item targets baseline。
- EntityRef target existence、type compatibility。
- MP／ER／DR null semantics，不把缺欄當 0。
- 42 Wiki HP conflict fixtures 不覆寫 canonical HP。
- 18 pride item unresolved 不被生成 target。
- Base／runtime／display layer 不混用。
- deterministic bytes、schemaVersion、source revision linkage。

### 3.6 C2 驗收門檻

- Schema、generator、validator 與 tests 全部通過。
- 相同輸入 SHA-256 一致。
- 未建立 Region／Card ID。
- unresolved records 保留原值與 evidence。
- Source Manifest 或 immutable source revision linkage 明確；否則 Dataset 最高 review_required。

## 4. Stage C3：Monster Repository

在 C2 Dataset 穩定後才建立 read-only repository：

- `monsters`、`maps`、`dropTables` repositories。
- 共通 API：getById、getAll、has、search、getStatus、getValidationErrors。
- 專用查詢：getMapsForMonster、getMonstersForMap、getDropTablesForMonster、getDropsForItem、getSpawnPools。
- canonical lookup 只用 ID，不依賴 mappings repository。
- mapping resolve 只在 legacy input adapter 顯式呼叫。
- 建立 immutable snapshots、反向索引、reset isolation 與 duplicate diagnostics tests。
- 不操作 DOM。

## 5. Stage C4：Monster View Adapter

建立受控 view adapter，不直接改 UI：

- 將 Monster/Map/Drop canonical records轉成目前頁面需要的 display model。
- 格式化 damage dice、probability、verification 與 unresolved labels。
- 合併 relation summaries，但不複製 target 主資料。
- Base／effective／display drop 顯示必須標示來源層。
- Navigation helper 只接收 EntityRef。
- 提供 legacy fallback feature flag 與對照測試；不讓 fallback 反向污染 Dataset。

## 6. Stage C5：Monster UI

完成 C2～C4 且 baseline tests 穩定後才進 UI：

- Monster 列表／詳情。
- Map／Spawn 導覽。
- Base Drop 與 runtime condition 說明。
- Verification／unresolved／version 顯示。
- Monster↔Map↔Drop↔Item 與 Card／Quest／Skill 等跨域跳轉。
- Desktop/mobile 資訊優先順序與 accessibility。
- 實際 Button、Console、Network 404 與回歸測試。

UI 不直接讀 legacy mapping JSON，也不把 display name 作 URL identity。

## 7. 建議順序與阻擋

建議下一步是 C2 的「Schema + ID assignment fixtures」最小切片，順序：

1. 共通 Verification、Version、EntityRef／RelationRef definitions。
2. Monster Schema 與 460 baseline fixture。
3. Map／Spawn Schema 與 map pool validation。
4. DropTable／Entry ID assignment contract。
5. Drop Schema、generator、validator。
6. 全量 deterministic generation 與回歸。

阻擋項目：

- size raw code 語意。
- ER／DR／MP 缺省語意。
- DropTable／DropEntry／SpawnPool 穩定 ID。
- 18 navigation missing targets 的類型。
- 120 Wiki location 與 Region／MapGroup 邊界。
- 18 pride item target 缺失。
- 特殊掉落與 runtime modifier 支援範圍。

上述問題不阻止建立 nullable／unresolved Schema 骨架，但阻止宣稱 Dataset complete 或 up_to_date。

## 8. C1 變更聲明

C1 只新增四份契約／計畫文件。沒有建立或修改 Schema、generator、validator、JSON Dataset、repository、WikiDataCore、UI、HTML、CSS、JavaScript、mapping、Craft 或 Wiki 資料；沒有 commit 或 push。
