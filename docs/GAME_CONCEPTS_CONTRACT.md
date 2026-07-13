# Knowledge Domain：Game Concepts Data Contract

## 1. 定位與責任邊界

Game Concept 是玩家可獨立搜尋、理解及跨域追蹤的遊戲概念，例如 STR、命中、暴擊、加速、中毒與冷卻。它不是 Equipment、Skill 或 Monster 的附屬文字欄位，也不取代擁有實例資料的 Domain Entity。

| 層級 | 回答的問題 | 範例 | 資料所有權 |
|---|---|---|---|
| Game Entity | 哪個具體遊戲對象？ | Equipment、Monster、Skill、Quest、Item、Card、Map | 各 Domain |
| Game Concept | 這個術語是什麼、影響什麼？ | STR、Accuracy、Critical、Haste、Poison、Cooldown、DoT | Knowledge Domain |
| Mechanic | 底層規則如何運作？ | stack、override、consume、trigger、snapshot | Knowledge Domain / Mechanics Layer |
| Formula | 輸入如何計算成輸出？ | 傷害、命中、暴擊、回復、掉落率公式 | Knowledge Domain / Mechanics Layer |
| Research | 我們如何知道、仍有哪些爭議？ | 程式分析、測試、Conflict、VersionDiff | Research Layer |
| Guide／Editorial | 玩家如何運用？ | 配點建議、職業方向、常見誤解 | Editorial owner |

Concept、Mechanic 與 Formula 都是可引用的獨立 Entity。Research 保存知識形成過程，不等於 canonical fact；Guide 是主觀或整理內容，不得覆寫 Concept canonical fields。結構化資料不得全部塞入自由文字。

### 1.1 典型判定

- STR 是 `GameConcept`，分類為 `character_attribute`。
- 加速可同時涉及「加速」Concept、實際套用於角色的 StatusEffect，以及解釋速度修改／覆蓋規則的 Mechanic；三者 identity 分離並以 Relation 連接。
- Stack、Override、Consume 是 Mechanic，不是 ConceptCategory。
- 傷害公式是 Formula；傷害解析順序是 Mechanic；傷害類型是 Concept。
- 玩家推薦配點只進 Guide／Editorial。

## 2. ConceptCategory

`mechanic` 不得作為 ConceptCategory。

| category | 中文含義 | 適用範例 | 通常有數值 | 通常關聯 Formula | 通常關聯 Mechanic | 可直接搜尋 |
|---|---|---|---|---|---|---|
| `character_attribute` | 角色基礎能力 | STR、DEX、CON、INT、WIS、CHA | 是 | 是 | 是 | 是 |
| `combat_stat` | 戰鬥衍生數值 | 命中、ER、DR、MR、暴擊率 | 是 | 是 | 是 | 是 |
| `resource` | 可持有與消耗資源 | HP、MP、負重 | 是 | 是 | 是 | 是 |
| `damage_type` | 傷害分類 | 近距離、遠距離、魔法、持續傷害 | 視情況 | 是 | 是 | 是 |
| `defense_type` | 防禦或抗性分類 | AC、MR、減傷、迴避 | 是 | 是 | 是 | 是 |
| `recovery` | 恢復概念 | HP 回復、MP 回復、吸血 | 是 | 是 | 是 | 是 |
| `speed` | 行動速度概念 | 攻速、施法速度、移速 | 是 | 是 | 是 | 是 |
| `probability` | 機率與隨機判定 | 命中率、暴擊率、掉落率 | 是 | 是 | 是 | 是 |
| `buff` | 有利效果概念 | 加速、增傷 Buff | 視情況 | 視情況 | 是 | 是 |
| `debuff` | 不利效果概念 | 緩速、降防 | 視情況 | 視情況 | 是 | 是 |
| `status_effect` | 狀態效果術語 | 中毒、沉默、麻痺 | 視情況 | 視情況 | 是 | 是 |
| `targeting` | 目標選擇概念 | 單體、範圍、最近目標 | 否 | 視情況 | 是 | 是 |
| `cooldown` | 冷卻概念 | 技能冷卻、共用冷卻 | 是 | 是 | 是 | 是 |
| `trigger` | 觸發概念 | on-hit、on-kill、proc | 視情況 | 視情況 | 是 | 是 |
| `stacking` | 疊加相關概念 | 層數、疊加上限、刷新 | 是 | 視情況 | 是 | 是 |
| `immunity` | 免疫相關概念 | 控場免疫、毒免疫 | 多為布林／集合 | 視情況 | 是 | 是 |
| `elemental` | 元素與剋制概念 | 火、水、風、地、弱點 | 視情況 | 是 | 是 | 是 |
| `progression` | 成長與進度 | 等級、經驗、強化 | 是 | 是 | 是 | 是 |
| `economy` | 經濟系統概念 | 金幣、價格、製作成本 | 是 | 是 | 視情況 | 是 |
| `other` | 已知但尚無合適正式分類 | 特殊且可明確定義的概念 | 視情況 | 視情況 | 視情況 | 是 |
| `unresolved` | 類別本身尚待確認 | 來源術語未能安全分類 | 未知 | 未知 | 未知 | 是，須標警示 |

## 3. GameConcept Entity

概念模型只示範契約，不宣稱 STR 的實際效果已知：

```json
{
  "conceptId": "concept_character_attribute_str",
  "slug": "str",
  "displayName": "力量",
  "shortName": "STR",
  "aliases": [],
  "category": "character_attribute",
  "definition": "力量能力值。",
  "summary": "實際效果需依程式、公式或測試驗證。",
  "unit": null,
  "valueType": "integer",
  "scope": ["player"],
  "effects": [],
  "formulaRefs": [],
  "mechanicRefs": [],
  "relations": [],
  "verification": {},
  "version": {},
  "dataStatus": "partial",
  "entityRef": { "entityType": "concept", "entityId": "concept_character_attribute_str" },
  "notes": []
}
```

### 3.1 欄位契約

| 欄位 | 類型 | 分類 | 規則 |
|---|---|---|---|
| `conceptId` | string | canonical／必填 | 穩定 ID，不由名稱或排序生成 |
| `slug` | string | canonical／必填 | ASCII lowercase snake_case；供 URL 候選，不單獨作跨域 identity |
| `displayName` | string | canonical／必填 | 顯示文字，可改名但不改 ID |
| `shortName` | string/null | canonical | 可為 STR 等正式縮寫；未知為 null |
| `aliases` | string[] | metadata | 只供搜尋，不代表 canonical identity |
| `category` | ConceptCategory | canonical／必填 | 未能確認時為 `unresolved` |
| `definition` | string/null | canonical claim | 可驗證的定義；未知不補造 |
| `summary` | string/null | derived display | 由已驗證內容產生的快速摘要，不得擴張結論 |
| `unit` | string/EntityRef/null | canonical | 無單位或未知須明確區分 |
| `valueType` | enum/null | canonical | integer、number、percentage、boolean、duration、enum、set、text 或 unresolved |
| `scope` | string[] | canonical | player、monster、skill、item、map、global 等受控值；未知可空 |
| `effects` | ConceptEffect[] | relation summary | 指向結構化 claim／relation，不保存未驗證自由文字效果 |
| `formulaRefs` | EntityRef[] | relation summary | 可由 Formula relation 重建 |
| `mechanicRefs` | EntityRef[] | relation summary | 可由 Mechanic relation 重建 |
| `relations` | RelationRef[] | relation summary | 不複製 target Entity |
| `verification` | Verification | metadata／必填 | 結論須能回到 Evidence |
| `version` | VersionScope | metadata／必填 | 未知範圍保留 null，不猜版本 |
| `dataStatus` | enum | metadata／必填 | complete、partial、unresolved、review_required 等契約狀態 |
| `entityRef` | EntityRef | derived／必填 | 必須回指同一 conceptId |
| `notes` | string[] | editorial metadata | 不得承載 canonical 數值或正式 Relation |

### 3.2 資料分類

- **canonical**：identity、正式分類、可驗證定義、單位、值型別與適用範圍。
- **derived**：由 canonical facts／relations 產生的摘要、反向統計與 `entityRef`。
- **editorial**：閱讀提示、常見誤解與實戰應用；不得成為公式輸入。
- **unresolved**：原始主張存在但 identity、含義、效果、公式或版本未確認。
- **relation summary**：為查詢便利保存的 refs；權威邊仍在 Relation Graph，必須可重建並驗證一致。

## 4. 第一批角色能力候選

STR、DEX、CON、INT、WIS、CHA 是 K2 的第一批 Concept candidates，不是 K1 已完成的資料。每個能力頁未來可分別保存：遊戲內描述、每點效果、門檻、遞減／分段、衍生數值、Skill／Equipment／Class 關聯、FormulaRef、程式來源、Verification、VersionScope、常見誤解與實戰應用。

其中遊戲描述可作 Official／display claim；每點效果、門檻與公式必須有 Code／Test／其他可定位 Evidence。推薦職業、建議配點與培養方向只屬 Guide／Editorial。

## 5. Mechanic Entity

`mechanicType` 至少支援：`stacking`、`override`、`consume`、`refresh`、`reapply`、`trigger`、`proc`、`chain`、`snapshot`、`immunity`、`suppression`、`priority`、`cooldown`、`resource_conversion`、`state_identity`、`target_selection`、`damage_resolution`、`other`、`unresolved`。

```json
{
  "mechanicId": "mechanic_status_consume",
  "mechanicType": "consume",
  "displayName": "狀態消耗",
  "definition": "觸發時移除或消耗指定狀態。",
  "inputs": [],
  "outputs": [],
  "conditions": [],
  "formulaRefs": [],
  "relatedConcepts": [],
  "relatedEntities": [],
  "verification": {},
  "version": {},
  "dataStatus": "partial",
  "entityRef": { "entityType": "mechanic", "entityId": "mechanic_status_consume" }
}
```

Mechanic 的 inputs、outputs、conditions 都應結構化並使用 Ref。EquipmentInteraction 描述兩個 Entity 的客觀互動結論；Mechanic 解釋底層規則。Interaction 可引用一個或多個 MechanicRef，Mechanic 不保存「推薦搭配」。

## 6. Formula Entity

Formula 至少包含：`formulaId`、`displayName`、`formulaType`、`expression`、`variables`、`variableRefs`、`units`、`rounding`、`orderOfOperations`、`caps`、`floors`、`conditions`、`outputs`、`examples`、`mechanicRefs`、`conceptRefs`、`verification`、`version`、`dataStatus`、`entityRef`。

`formulaType`：`damage`、`hit`、`evasion`、`critical`、`defense`、`recovery`、`cooldown`、`speed`、`probability`、`drop_rate`、`progression`、`resource`、`other`、`unresolved`。

規則：

- `expression` 規劃同時保存可機器處理的 AST／token 與獨立 display expression；不得只有自由文字。
- 未知公式以 null／unresolved 表達，不用猜測 placeholder。
- `variables` 定義型別、單位、範圍與角色；`variableRefs` 引用 Concept／Stat／EntityRef。
- 取整方式、運算順序、上下限、條件與輸出階段不可藏在說明文字。
- 顯示用簡化式不得冒充程式實際式；兩者以明確欄位及 Evidence 分離。
- examples 是可驗證案例，不是 canonical expression 的替代品。

## 7. Verification 與 Evidence

Verification 對齊既有列舉：`Official`、`Code`、`Generated`、`Community`、`Research`、`Test`、`Unknown`。狀態不是互斥的權威排名，應附著於 claim／field，Entity-level status 只是聚合。

Evidence 至少包含：`evidenceId`、`evidenceType`、`sourceLocation`、`sourceRevision`、`gameVersion`、`summary`、`excerpt` 或 `reference`、`testSetup`、`observedResult`、`confidence`、`limitations`、`status`。

- Code Evidence 必須定位檔案與 symbol／function／range，並保存 source revision。
- Test Evidence 必須有 setup、steps、expected、observed 與 limitations。
- Community 只能形成候選或研究輸入，不自動升級為 verified fact。
- Generated 證明可重現轉換，不證明輸入語意正確。
- Unknown 不得呈現為已證實。
- 同一 Concept 的衝突 Evidence 全部保留，建立 Research Conflict，不採「最高標籤覆蓋」。

## 8. Research records

- **ResearchTopic** 是具有穩定 ID、範圍、問題、狀態與關聯目標的 Entity；可聚合多筆研究文件型 records。
- **Finding** 是研究產生的可版本化結論，引用 Evidence，以及 Concept、Mechanic、Formula、Equipment、Skill、Monster 等 EntityRef；未通過驗證不得回寫 canonical facts。
- **Conflict** 保存互斥 claims、各自 Evidence、適用版本、目前判定與下一步，不靜默覆蓋。
- **VersionDiff** 引用同一目標在兩個 GameVersion／source revision 範圍的已確認或待確認差異。
- 未完成研究使用 open／partial／unresolved／review_required 等狀態；缺證據不是負面結論。
- 玩家頁預設顯示審核後結論與狀態，研究步驟、程式細節與 Conflict 放在深入層。

## 9. Relation model

Concept 可關聯 Equipment、Skill、Monster、Quest、Item、Card、Map、Recipe、Interaction、Mechanic、Formula、Research、Release、Class、StatusEffect。全部使用 EntityRef／RelationRef，不以名稱 fallback。

Relation 至少包含 from、to、relationType、direction、verification、version、evidenceRefs、dataStatus；目標未確認時保存 unresolved relation candidate，不建立假 EntityRef。

`relationType` 至少支援：`affects`、`affected_by`、`grants`、`consumes`、`modifies`、`scales_with`、`calculated_by`、`contributes_to`、`blocked_by`、`immune_to`、`applies`、`removes`、`refreshes`、`overrides`、`stacks_with`、`conflicts_with`、`used_by`、`relevant_to`、`verified_by`、`changed_in`、`unresolved_relation`。

方向性由 relationType 契約決定；`affects/affected_by` 等是語意反向，`stacks_with/conflicts_with` 可為對稱。Repository 以同一 canonical edge 建正反向索引，不複製兩份互相可能漂移的 Relation。

## 10. 穩定 ID

- `concept_<category>_<token>`
- `mechanic_<type>_<token>`
- `formula_<type>_<token>`
- `research_<topic>_<variant>`
- `evidence_<type>_<variant>`

所有 token 使用 ASCII lowercase snake_case；不得使用中文名稱、陣列索引、排序或 runtime hash。既有 code／stat key 若可驗證，保留為 source key 或 mapping，不必直接成為 Concept ID。正式 ID 發布後不因顯示名稱改變而重編；variant 由版本控制管理，不由內容 hash 隱式生成。

## 11. Unresolved policy

- 不知道 STR 等能力效果時不填猜測值。
- 只有遊戲文字時可保存 display／Official claim；Mechanic 與 Formula 保持 unresolved。
- 說明文字與程式行為衝突時兩者都保存並建立 Conflict。
- 缺 Equipment／Skill／Monster 等正式 ID 時不以中文名稱連結。
- 缺 Formula 不代表效果為 0；缺上限不代表無上限；缺疊加資料不代表可疊加；缺 Interaction 不代表彼此獨立。
- unresolved 不使整個 Dataset 自動 failed，但 Dataset 不得標示 complete／已完全驗證；必要 identity 或契約錯誤仍可成為 blocking diagnostic。

## 12. Semantic diff

| 變化 | 分類原則 |
|---|---|
| 遊戲端 Concept 定義、公式數值／變數、Mechanic 流程改變 | 玩家可見遊戲變更；需版本與 Evidence |
| Wiki 修正 identity、單位、關聯或錯誤公式 | `data_corrected`，不得冒充遊戲更新 |
| Finding resolved、Verification 狀態、Conflict 新增／解除 | Research update；若改變玩家結論再人工判定影響 |
| Entity relation 新增／移除 | 依來源判定遊戲變更或資料修正 |
| Guide 文案改變 | Editorial-only |
| 排序、排版、索引、序列化或 cache 改變 | Technical-only |

文章排版、標點與 section ordering 不得產生 mechanic change。結構化 expression、variable、rounding、cap、condition 或 version scope 的改變才是 Formula semantic candidate，仍須人工審核。

## 13. K1 驗收結論

Game Concept 是玩家術語的正式 Entity；Mechanic 解釋流程；Formula 保存可計算規則；Research 保存證據形成與爭議。K1 只定義契約，沒有建立 STR／DEX 等正式資料，也沒有修改任何程式或 Dataset。
