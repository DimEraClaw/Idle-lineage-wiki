# Knowledge Domain Stage K1 後續計畫

## 1. K1 成果與固定邊界

K1 只定義 GameConcept、Mechanic、Formula、Research、Evidence、Relation 與 WikiDataCore 未來接入契約，未實作程式、Schema、Dataset、generator、validator、repository 或 UI，也未宣稱 STR、DEX、CON、INT、WIS、CHA 的效果已知。

Knowledge Domain 是角色能力查詢的正式 owner，也是 Equipment、Skill、Interaction 與 Mechanics 的共用知識層；它不取代 Monster、Quest、Craft、Card 等 Domain，不提前實作 Analytics、Build Planner 或 Calculator。

## 2. Stage K2：Source audit、inventory 與契約落地

### 2.1 第一個資料稽核

優先盤點角色能力與戰鬥數值來源：

1. 搜尋 STR、DEX、CON、INT、WIS、CHA 的資料 key、初始化、存檔與 UI label。
2. 追蹤每個能力進入 derived stat、戰鬥、負重、回復、技能與裝備效果的實際執行路徑。
3. 分開 source value、runtime derived value、display-only value 與 editorial text。
4. 盤點 Accuracy、Evasion、AC、ER、DR、MR、HP、MP、攻速、施法速度、移速、暴擊等 stat identity。
5. 記錄檔案、symbol／function／range、source revision、GameVersion 候選、衝突與未知語意。

### 2.2 K2 交付規劃

- Source audit 文件與 attribute／stat inventory。
- Concept candidate → source key mapping；只映射可驗證 key，不以中文名稱造 ID。
- Concept、Mechanic、Formula、Research、Evidence 與 relation 的 Schema。
- unresolved fixtures：未知效果、缺上限、衝突來源、缺 target、未知公式與 alias collision。
- common definitions 與現有 EntityRef、Verification、VersionScope、dataStatus 對齊。

### 2.3 K2 阻擋與驗收

- 若 source key identity 不穩定，先保留 source record／mapping candidate。
- display description 不足以證明 runtime mechanic。
- 無法定位版本時不得推定 current／all versions。
- Schema 必須允許部分已知資料，不以 0、空公式或 `complete` 遮蔽 unknown。
- 第一批 Concept ID 必須經人工審核並可回溯來源。

## 3. Stage K3：Deterministic data pipeline

- 建立 deterministic generator 與 validator。
- 生成第一批 STR、DEX、CON、INT、WIS、CHA Concept records。
- 只寫入稽核可支持的 identity、description、claims、relations 與 Evidence。
- 不在缺證據時補造每點效果、門檻、公式、上限、疊加或職業關聯。
- 驗證 byte stability、ID uniqueness、Ref resolution、Evidence requirements、version scope、unresolved policy 與 semantic normalization。
- Mechanics／Formula 可逐筆累積；缺少完整遊戲覆蓋不是失敗，但 status 必須誠實。

## 4. Stage K4：WikiDataCore repositories

- 註冊 concepts、mechanics、formulas、researchTopics、findings、evidence repositories。
- 建立 category／type、正反向 EntityRef、Evidence、Formula dependency、Mechanic／Interaction 與 version indexes。
- 加入 repository search 與 cross-entity search；alias 命中不轉換 identity。
- 實作 `getByCategory`、`getRelatedEntities`、`getFormulaRefs`、`getMechanicRefs`、`getByType`、`getVariables`、`getDependents`、Research 查詢等 read APIs。
- 進行 parity、immutability、isolation、invalid reference、duplicate ID 與 deterministic index tests。
- Repository 不操作 DOM，不修改 Domain Dataset。

## 5. Stage K5：玩家可見頁面與受控接線

- Concept 頁面與角色能力頁。
- Formula／Mechanics 詳細展開區。
- Verification／Evidence／Conflict／unresolved 顯示。
- Equipment／Skill／Monster 等反向關聯入口。
- 手機與桌面都遵守「快速答案 → 詳細效果 → 機制 → 證據 → Editorial」層級。
- feature flag、fallback、baseline、Console、Network、navigation 與互動測試。
- 未載入 Knowledge Dataset 時，既有百科與遊戲功能維持原狀。

## 6. 與 Monster Roadmap 的順序

1. 保留 Monster C1 契約成果，不回頭改寫。
2. 完成 Knowledge K1 文件定案。
3. 進入實作前，在 Monster C2 與 Knowledge K2 中選擇一個能最快形成玩家可查詢最小切片的階段。
4. 建議若目標是角色能力查詢，先做 Knowledge K2 的 stat source audit；若目標是怪物百科資料落地，先做 Monster C2。
5. 不同時全面展開兩個大型實作階段；共通 EntityRef、Verification、VersionScope definitions 應先定案，避免重複契約。

## 7. Semantic diff 與發布

K2 定義 Knowledge Domain-specific normalization：哪些 arrays 是 set-like、哪些有順序、哪些是 derived／display-only。K3 建立 fixture 驗證排版、排序與生成 metadata 不產生假更新。任何玩家可見 ChangeRecord 都須經人工 review，並區分遊戲變更、Wiki data correction、Research update、Editorial-only 與 Technical-only。

## 8. 非必要範圍

- K1～K5 不要求一次建完所有 Mechanic／Formula。
- Player Tools、Calculator、Build Planner、Analytics 不在必要範圍。
- Guide／Editorial 可在 K5 呈現，但不參與 canonical formula 或 stat calculation。
- 未經另行核准不修改既有 HTML、CSS、JavaScript、JSON、Monster／Craft／Mapping／Release 資料。

## 9. 是否可進入 K2

架構上可以進入 K2，但 K2 應從 read-only source audit 開始，不直接建立能力效果資料。只有 source identity、code path、版本與 Evidence 可定位後，才進行 Schema 與第一批 ID mapping；任何未驗證效果保持 unresolved。
