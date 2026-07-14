# Wiki Automation Pipeline

## 1. Purpose

Wiki Automation Pipeline（WAP）把不可變的遊戲來源轉成可供人工審核的資料更新候選。它的最高原則是：**任何玩家可見資料都不能由 Generator 直接自動發布。**

Pipeline 只搬運已知 identity、Evidence 與 validation result；不能用顯示名稱補造 ID、修正來源資料、猜測公式或把工程 diff 寫成玩家更新。

## 2. Stage responsibilities

```text
Source Snapshot
  → Source Manifest
  → Domain Generator
  → Validator
  → Semantic Diff
  → Human Review Gate
  → Release Builder
  → Deployment
```

### 2.1 Source Snapshot

- 以 upstream full SHA 固定不可變來源。
- snapshot 必須與主要工作區隔離，不能修改 Wiki Dataset。
- branch、tag、Pages URL 或取得時間不能取代 full SHA。

### 2.2 Source Manifest

- 記錄 repository、full SHA、GameVersion、檔案 path、SHA-256、byte size 與取得方式。
- 所有 Generator input 都必須納入 manifest 或獨立的 Wiki-local input manifest。
- hash mismatch、漏列 input 或 mutable source 是 blocking。

### 2.3 Domain Generator

- 只讀已固定來源與已核准 fixtures。
- 只產生 Candidate Dataset；不能覆蓋 Approved／Published Dataset。
- 不取得網路、不修正來源、不產生玩家文案。

### 2.4 Validator

- 驗證 Candidate 的 Schema、identity、foreign key、排序、determinism 與來源連結。
- Validator 只能回報 diagnostic，不能替 Candidate 補值或更改狀態。
- validation failure 阻止後續發布，但不回寫來源。

### 2.5 Semantic Diff

- 只比較 Approved Dataset 與 Candidate Dataset。
- 以 Domain 正式 ID 配對 Entity，區分 canonical、relation、display、technical、verification 與 unresolved 變化。
- 不修改任一輸入，不讀目前時間，不 fetch；相同輸入必須產生 byte-identical JSON。

### 2.6 Human Review Gate

- `blocked`、conflict、removed、classification change 與 unresolved 必須人工確認。
- reviewer 必須確認玩家影響、Evidence、change type、EntityRef 與版本範圍。
- 未核准 diff 不能交給 Release Builder；審核不能修改 snapshot，資料錯誤需回到 fixture／contract／generator 後重跑。

### 2.7 Release Builder

- 只能讀 validated、已核准的 semantic diff 與 review decisions。
- 產生 Release／ChangeRecord read model，不重新生成 Domain Dataset。
- `approved`／`rejected` 只能來自明確 review decision input；新 diff 工具不自行輸出。

### 2.8 Deployment

- Candidate 不能被網站、Repository 或 UI 當作正式來源。
- 只有通過 validation、human review、Release gate 並提升為 Approved 的 Dataset 才可部署。
- 部署後仍需檢查 Console、Network、deep link、fallback 與既有百科回歸。

## 3. Artifact boundaries

| Artifact | Mutable during run | Player-visible | Owner |
|---|---:|---:|---|
| Source Snapshot | 否 | 否 | Source acquisition |
| Source Manifest | 生成後不可就地改寫 | 否 | Release source |
| Candidate Dataset | 可重建，不可發布 | 否 | Domain pipeline |
| Validation diagnostics | 可重建 | 否 | Validator |
| Semantic release diff | 可重建，未 review | 否 | Semantic Diff |
| Review decision | 僅 reviewer 寫入 | 否 | Human Review Gate |
| Release／ChangeRecord | 由核准結果建立 | 是 | Release Builder |
| Approved Dataset | 發布版本不可就地改寫 | 是 | Domain owner |

## 4. Failure and rollback

- 任一 Stage failure 都停止向後推進，不能沿用上一版成功狀態冒充本次完成。
- Candidate 可刪除並重建；Approved／Published snapshot 不就地改寫。
- rollback 是重新部署先前已核准 artifact，不是把失敗 Candidate 標成 Approved。
- Source、Dataset、Schema、WikiVersion 與 Release identity 必須分欄保存。

## 5. v1-A scope

v1-A 只建立 Monster、Map、DropTable、Equipment 的 semantic comparison foundation、Schema、validator、fixtures 與 Markdown review renderer。它不更新 v3.4.17 fixtures、不生成新版正式 Dataset、不建立 Release，也不接線網站 UI。
