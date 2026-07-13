# 裝備互動與相容性資料契約

## 1. 定位與核心決策

本文件定義《放置天堂整合百科》如何描述兩個裝備之間的互動、效果相容性、疊加、覆蓋、互斥與未解狀態。它是 **Equipment Domain → Mechanics Layer → Interaction Relation** 的正式契約，供後續資料盤點、研究、Schema、Repository、搜尋及 UI 設計共同遵循。

本階段只定義架構，不建立 Interaction 資料，也不對任何真實裝備組合下結論。

- 「可同時裝備」只表示裝備欄位與角色限制允許共存，不等於效果相容、疊加或能互相觸發。
- `compatible` 不是預設值；缺乏足夠 Evidence 時必須使用 `unresolved`。
- 裝備名稱、描述相似、圖示或玩家印象不能取代正式 equipment ID 與 Evidence。
- Interaction 是一級 Relation，不應塞入 Equipment 的自由文字備註或單一布林欄位。

```text
Equipment A ─┐
             ├─ EquipmentInteraction ─ MechanicRef ─ Mechanics Layer
Equipment B ─┘            │
                          ├─ Verification / Evidence
                          └─ VersionScope / Conditions
```

## 2. interactionStatus

`interactionStatus` 表達在指定 `interactionType`、條件與版本範圍內，兩個 Entity 的關係結論。

| 值 | 精確語意 | Evidence 要求 |
|---|---|---|
| `compatible` | 兩者在指定機制下可共同生效；不保證數值相加 | 必須 |
| `not_compatible` | 兩者不能形成指定互動或不能共同生效 | 必須 |
| `stacks` | 兩者效果依已知規則疊加 | 必須，並說明算法 |
| `does_not_stack` | 兩者可共存，但指定效果不累加 | 必須，並說明保留規則 |
| `overrides` | `from` 的指定效果取代或壓過 `to` | 必須 |
| `overridden_by` | `from` 的指定效果被 `to` 取代 | 必須 |
| `mutually_exclusive` | 兩者在指定條件下不能同時存在或生效 | 必須 |
| `conditional` | 結論依角色、狀態、順序、目標或資源等條件改變 | 必須列出條件與分支結果 |
| `independent` | 兩者位於不同機制路徑，沒有直接互動 | 必須證明路徑獨立 |
| `unresolved` | 證據不足、ID 未解、證據衝突或版本不明 | 必須說明未解原因 |

### 2.1 語意邊界

- `compatible` 不等於 `stacks`；共同生效不保證數值累加。
- `not_compatible` 不等於 `mutually_exclusive`；前者可能只是觸發鏈不成立。
- `does_not_stack` 不表示其中一件完全無效；必須指出取最高、取最後或共享上限。
- `independent` 表示已證明沒有直接互動；資料不足時應用 `unresolved`。
- `unresolved` 是正式研究狀態，不是錯誤或臨時假值。

## 3. interactionType

同一對 Entity 可以有多筆不同 `interactionType` 的 Interaction。

| 值 | 語意與邊界 |
|---|---|
| `shared_state` | 是否讀寫同一 state、flag、Buff ID、timer 或共享資源 |
| `trigger_consumption` | 一方產生的狀態／資源能否被另一方觸發或消耗 |
| `buff_refresh` | 是否刷新既有 Buff 的剩餘時間，而不完整重建效果 |
| `buff_reapply` | 是否重新套用 Buff，包含來源、層數或快照值 |
| `stat_stacking` | 對同一 Stat／DerivedValue 的修正如何合併 |
| `effect_override` | 效果優先序、取代、壓過或只保留最高值 |
| `proc_chain` | 一方結果能否觸發另一方 proc，及鏈結中止條件 |
| `immunity_block` | 免疫、抗性或阻擋是否使另一效果失效 |
| `cooldown_interaction` | 是否共享、刷新、縮短、重設或各自維護冷卻 |
| `resource_interaction` | 是否產生、消耗或共享 HP、MP、charge、stack 等資源 |
| `mutually_exclusive_slot` | 裝備欄位、類型或角色限制造成的物理互斥 |
| `unrelated_mechanics` | 經 Evidence 證明兩者屬不同狀態與觸發路徑 |

- 優先選擇最接近程式狀態或遊戲規則的類型，不使用模糊的「一般相容」。
- 同時存在多種機制時拆成多筆 Interaction，不以 notes 混合結論。
- `unrelated_mechanics` 只在完成分析後使用；資料不足時使用 `unresolved` status。

## 4. 正式資料模型

以下是概念 JSON 形狀，不是本階段要建立的資料或 Schema：

```json
{
  "id": "interaction_equipment_verified_a_equipment_verified_b_01",
  "from": {
    "entityType": "equipment",
    "entityId": "verified_equipment_id_a"
  },
  "to": {
    "entityType": "equipment",
    "entityId": "verified_equipment_id_b"
  },
  "interactionType": "trigger_consumption",
  "interactionStatus": "not_compatible",
  "direction": "bidirectional",
  "summary": "兩件裝備不共用同一個可供對方消耗的觸發狀態。",
  "details": {
    "sharedState": false,
    "stacking": "none",
    "triggerChain": false,
    "conditions": [],
    "notes": []
  },
  "mechanicRef": {
    "entityType": "mechanic",
    "entityId": "mechanic_verified_state"
  },
  "verification": {
    "status": "code",
    "confidence": "verified",
    "evidenceIds": ["evidence_verified_example"]
  },
  "versionScope": {
    "validFrom": null,
    "validTo": null,
    "versionFingerprint": null
  },
  "notes": [],
  "sourceLocation": null,
  "dataStatus": "complete"
}
```

## 5. 欄位契約

| 欄位 | 必要性 | 契約 |
|---|---|---|
| `id` | 必填 | 穩定且唯一的 Interaction ID |
| `from` | 必填 | 已驗證或明確 unresolved 的 EntityRef；不得只存名稱 |
| `to` | 必填 | 已驗證或明確 unresolved 的 EntityRef；不得只存名稱 |
| `interactionType` | 必填 | 第 3 節列舉值 |
| `interactionStatus` | 必填 | 第 2 節列舉值 |
| `direction` | 必填 | `forward`、`reverse`、`bidirectional`、`asymmetric` |
| `summary` | 必填 | 中性、可驗證且不超出 Evidence 的摘要 |
| `details` | 必填 | 結構化機制細節；未知值不得自行補造 |
| `mechanicRef` | 條件必填 | 已識別 Mechanic 時使用；未建模時為 null 並記 unresolved |
| `verification` | 必填 | 驗證狀態、信心及 Evidence 引用 |
| `versionScope` | 必填 | 適用版本；null 表示未知，不代表所有版本 |
| `notes` | 選填 | 不影響核心判定的補充資訊 |
| `sourceLocation` | 選填 | 原始資料、程式或研究紀錄定位 |
| `dataStatus` | 必填 | `complete`、`partial`、`stub`、`unresolved` |

### 5.1 details 建議欄位

- `sharedState: boolean | null`
- `sharedStateRef: EntityRef | null`
- `stacking: "additive" | "multiplicative" | "highest_only" | "last_applied" | "independent" | "none" | "unknown"`
- `triggerChain: boolean | null`
- `refreshBehavior: "refresh_duration" | "reapply" | "no_refresh" | "unknown" | null`
- `priority: number | string | null`
- `conditions: Condition[]`
- `notes: string[]`

details 只記錄支持核心判定所需的資訊；不能用大量 notes 逃避建立 Mechanic 或 Evidence。

## 6. ID 與方向規則

```text
interaction_<fromType>_<fromId>_<toType>_<toId>_<variant>
```

- 只使用正式 Entity type 與穩定 Entity ID，不使用中文名稱、顯示名稱或自行翻譯的 slug。
- ID 不包含 `interactionType`；同一 Entity pair 的多筆互動以穩定 `variant` mapping 區分。
- `variant` 使用固定寬度序號，例如 `01`；不得按搜尋結果順序動態產生。
- ID 發布後不因 summary、status、Evidence 或顯示順序改變而重編。
- from／to 順序是 identity 的一部分；正規化規則必須在生成前定案。

### 6.1 對稱與反向 Relation

- `bidirectional` 且語意完全對稱時，只建立一筆 canonical Relation。
- canonical pair 依 `entityType + entityId` 的穩定字典序排列，避免 A-B 與 B-A 重複。
- `overrides`／`overridden_by`、觸發來源、資源產生與消耗等方向性語意不得交換端點去重。
- `asymmetric` 表示雙方互相有關但作用不對等；details 必須分別說明 A→B 與 B→A。
- Repository 可產生反向查詢視圖，但不得建立第二筆內容相同的永久 Relation。

### 6.2 direction

| 值 | 語意 |
|---|---|
| `forward` | 只主張 from 對 to 的作用 |
| `reverse` | 正式作用是 to 對 from；通常應交換端點改用 forward，保留此值須有理由 |
| `bidirectional` | A→B 與 B→A 的結論完全相同 |
| `asymmetric` | 雙方互動存在，但方向、強度、優先序或結果不同 |

未來 UI 必須依查詢視角轉譯 `overrides`／`overridden_by`，不能把反向查詢原樣顯示成錯誤主詞。

## 7. Verification 與 Evidence

### 7.1 verification.status

- `official`：可定位的官方說明直接支持 Interaction Claim。
- `code`：可定位的程式或資料路徑支持實際機制。
- `test`：控制條件且可重現的測試支持結果。
- `unresolved`：證據不足、衝突、ID 未解或版本範圍不明。

同一 Interaction 可引用多類 Evidence；`verification.status` 表示主要驗證依據，其他依據留在 `evidenceIds`。

除 `unresolved` 外，所有 interactionStatus 都必須至少有一筆可定位 Evidence，否則一律降為 `unresolved`。

### 7.2 Code Evidence 最低要求

- `file`
- `function`／`symbol`
- 可取得時的 line／range 或穩定定位方式
- `versionFingerprint`
- `analysisSummary`
- 觀察到的 state、flag、Buff ID、timer、source、trigger path 或判斷分支

程式名稱相似不代表共享狀態；必須追蹤實際讀寫路徑或呼叫鏈。

### 7.3 Test Evidence 最低要求

- `setup`：版本、角色、屬性、裝備、目標與前置狀態
- `steps`：可重現操作
- `expected`：待驗證假說下的預期
- `observed`：原始觀察與樣本
- `limitations`：樣本量、隨機性、未控制變因與版本限制

### 7.4 禁止事項

- 不得以裝備描述、名稱相似、玩家印象或單次未控制觀察標記 verified。
- 不得把「沒有觀察到」自動當成 `not_compatible`；可能是觸發條件未成立。
- 不得因兩件裝備可同時穿戴就標記 `compatible` 或 `stacks`。
- Evidence 尚無正式 ID 時不得虛構 `evidenceIds`。

## 8. unresolved 契約

下列任一情況必須使用 `interactionStatus: "unresolved"` 或 `dataStatus: "unresolved"`：

- from／to equipment ID 無法由既有資料驗證。
- Mechanic 尚未識別，只有效果文字猜測。
- Evidence 缺失、無法定位、互相衝突或不適用目前版本。
- 只知道可同時裝備，不知道效果是否共享、疊加或觸發。
- 觀察結果可能由多個變因造成。
- 同一裝備名稱存在多個 ID，尚未確認目標 Entity。

unresolved 應保存原始問題、已知端點、候選 Mechanic、現有 Evidence、衝突原因、下一個驗證動作及優先度。不得自行補造 equipment、mechanic、evidence 或 source ID。

## 9. WikiDataCore Repository 與索引規劃

未來新增 `interactions` repository；本階段不實作。

### 9.1 共通 API

- `getById(id)`
- `getAll()`
- `has(id)`
- `search(keyword)`
- `getStatus()`
- `getValidationErrors()`

### 9.2 專用 API

- `getByEntity(entityRef)`
- `getBetween(fromRef, toRef)`
- `getCompatibleWith(entityRef)`
- `getConflictsWith(entityRef)`
- `getUnresolvedFor(entityRef)`
- `getByMechanicId(mechanicId)`

`getCompatibleWith` 只回傳有 Evidence 的正向相容結果，不得混入 `independent` 或 unresolved。`getConflictsWith` 必須定義涵蓋的 status 並保留原始方向。

### 9.3 必要索引

- `interactionsById`
- `interactionsByEntityKey`
- `interactionsByPairKey`
- `interactionsByStatus`
- `interactionsByType`
- `interactionsByMechanicId`
- `unresolvedInteractionsByEntityKey`

索引只保存 Interaction ID 或不可變引用，不複製 entity。`pairKey` 使用 canonical Entity key；對稱 relation 不因查詢方向重複，非對稱 relation 保留方向。

### 9.4 驗證規則

- ID 唯一且符合 from／to／variant mapping。
- from、to、mechanicRef、evidenceIds 可解析，否則產生 structured diagnostic。
- status、type、direction 組合在語意上有效。
- 非 unresolved 結論具備 Evidence。
- 對稱 relation 沒有 A-B／B-A 重複。
- `overrides`／`overridden_by` 的方向與反向查詢一致。
- 同一 pair、type、version scope 沒有未標 Conflict 的矛盾 active relation。

Repository 不依賴 DOM、history、UI state，也不自行推導缺少的 Interaction。

## 10. UI 呈現原則

本節只定義未來呈現語意，不授權本階段修改 UI。

未來可從裝備詳情或「互動／相容性」區塊進入，至少呈現：對象裝備、interactionType、interactionStatus、方向、條件、Mechanic、驗證標籤、Evidence 摘要、版本範圍及 unresolved 原因。

| 狀態 | 建議顯示 |
|---|---|
| `compatible` | 可共同生效 |
| `not_compatible` | 不形成指定互動 |
| `stacks` | 效果可疊加 |
| `does_not_stack` | 效果不疊加 |
| `overrides` | 會覆蓋對方效果 |
| `overridden_by` | 效果會被對方覆蓋 |
| `mutually_exclusive` | 互斥 |
| `conditional` | 視條件而定 |
| `independent` | 機制獨立 |
| `unresolved` | 尚未驗證 |

不得顯示「一定可用」「完全無效」「最佳搭配」等超出 Evidence 的文案。未知版本不得省略成「全版本適用」。跨模組跳轉一律使用 EntityRef，不使用中文名稱作為正式鍵。

## 11. Roadmap 與實作前阻擋條件

### Stage A：資料盤點與研究問題

- 盤點 equipment ID、裝備欄位、效果描述及可定位程式來源。
- 建立候選 Interaction 清單，未驗證者全部保持 unresolved。

### Stage B：Mechanic 與 Evidence 契約

- 為共享狀態、Buff、觸發、冷卻與資源建立 Mechanic identity。
- 建立 Evidence、版本指紋、Conflict 與 TestCase 契約。

### Stage C：資料、Schema 與驗證器

- 在另行核准後建立資料、Schema、生成與 validator。
- 建立 duplicate、missing reference、missing evidence、direction conflict 診斷。

### Stage D：WikiDataCore 接入

- 新增 repository、索引、Relation graph 與 parity fixture。
- 預設不改 UI；以 feature flag、shadow comparison 與 reset isolation 驗證。

### Stage E：受控 UI 呈現

- Evidence 與 fallback 準備完成後才接入裝備詳情。
- 驗證文案不超出 Evidence，並完成 Console、Network、URL 與 baseline 回歸。

### 阻擋條件

- 沒有可驗證的 equipment ID mapping。
- Mechanic identity 不明，只能依名稱猜測。
- 非 unresolved 結論缺少 Evidence。
- 對稱／非對稱與 from／to 正規化未定案。
- 版本指紋不可取得且結論可能因版本改變。
- 資料、Evidence、Repository 或 fallback 未完成前要求先顯示 UI 結論。

## 12. 驗收問題

1. **裝備可同時穿戴是否等於效果相容？** 否；效果相容需要獨立 Interaction 與 Evidence。
2. **`compatible` 是否可作為預設？** 否；未驗證時必須是 `unresolved`。
3. **沒有 Evidence 可否標記 `stacks` 或 `not_compatible`？** 不可。
4. **同一對裝備可以有多筆 Interaction 嗎？** 可以，不同 type 或版本應分開表達。
5. **對稱 Interaction 是否建立兩筆？** 不建立，只保存 canonical 一筆並支援雙向查詢。
6. **非對稱 Interaction 如何處理？** 保留 from／to，使用 forward 或 asymmetric；反向查詢只轉譯視角。
7. **中文名稱可否成為關聯鍵？** 不可，只能用於顯示與搜尋。
8. **ID 或 Mechanic 無法驗證時怎麼辦？** 保存原始資訊並標記 unresolved，不虛構 ID。
9. **這是 Equipment 欄位還是一級 Relation？** 是一級 Interaction Relation。
10. **UI 可以現在加入嗎？** 不可以，本文件只提供未來呈現契約。
11. **本階段是否修改網站或資料？** 否，只建立／修訂文件。
12. **下一步是直接建立資料嗎？** 否，先完成 ID、Mechanic 與 Evidence 盤點，再另行核准。
