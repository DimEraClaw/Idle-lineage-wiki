# Release Hub 版本身分契約

## 1. 目的

本文件分開定義 GameVersion、WikiVersion、SchemaVersion 與 source revision，避免把遊戲版本、Wiki 發布、資料契約及 Git SHA 混成同一個字串。

## 2. 四種身分

| 身分 | 回答的問題 | 範例／現況 | 是否玩家主要顯示 |
|---|---|---|---|
| GameVersion | 原作者遊戲是哪一版？ | `v3.2.79` | 是 |
| WikiVersion | Wiki 發布內容是哪一版？ | 第一版規劃 `wiki-v1.0.0` | 是 |
| SchemaVersion | Release/Dataset 契約相容性是哪一版？ | 初版規劃 `1.0.0` | 通常否 |
| source revision | 精確來源是哪個不可變修訂？ | full Git SHA | 診斷／來源詳情 |

這四者必須使用不同欄位；任何一個都不可由另一個自動推算。

## 3. GameVersion

- 由 Source Manifest 內已驗證、已 hash 的權威程式欄位解析。
- Stage A 的可驗證值為 `v3.2.79`。
- 不因 Wiki 發布、資料修正或 Schema 變更而改變。
- commit SHA、commit date、cache token、SAVE_VERSION 都不是 GameVersion。
- 找不到正式版本時為 unknown／unresolved，不自行編號。

## 4. WikiVersion 選型決策

採用獨立語意版本格式：

```text
wiki-v<major>.<minor>.<patch>
```

第一個正式 bootstrap baseline 的建議版本為：

```text
wiki-v1.0.0
```

這是版本規則決策，不代表本階段已發布 `wiki-v1.0.0`。

### 4.1 為何不採日期版

`wiki-2026.07.13` 容易被誤解成資料日期或 GameVersion，且同日多次發布需要額外序號；它適合作 publishedAt，不適合表達相容性與變更程度。

### 4.2 為何不採 GameVersion 綁定版

`game-v3.2.79-wiki.1` 可讀性高，但會讓使用者誤以為 WikiVersion 只能在 GameVersion 改變時前進。Wiki 可能在同一 GameVersion 下修正資料、補 Evidence、擴充 Dataset 或發布首頁功能，因此必須有獨立生命週期。

GameVersion 應在 Release／SyncStatus 旁分開顯示，不嵌入 WikiVersion identity。

## 5. WikiVersion bump 規則

### 5.1 major

下列變更提升 major：

- 破壞玩家可見 canonical URL／EntityRef identity 且無完整相容 mapping。
- 重新定義 WikiVersion、Release identity 或全站 Dataset ownership。
- 大規模 ID 重新編碼，舊引用不能透明解析。
- 移除主要百科能力或發布模型，既有 consumer 無法相容。

major 變更必須有 migration、redirect／alias、回滾與歷史 Release 保留計畫。

### 5.2 minor

下列變更提升 minor：

- 新增玩家可見百科 Domain、主要 Repository 或 Release Hub 功能。
- 新增一批已驗證資料覆蓋，改變同步 scope 或使新 Dataset 成為 required。
- 新增向後相容的 Relation、Search、Navigation 或 Verification 能力。
- 同一 GameVersion 下完成大量新 Dataset baseline。

### 5.3 patch

下列變更通常提升 patch：

- `data_corrected`，且不改 stable ID／契約語意。
- 補充 Evidence、來源定位、描述或非破壞性 metadata。
- 修正錯字、顯示文字或 validator 漏報，但不改公開資料形狀。
- 同一 GameVersion 下小範圍補資料或 unresolved resolution。

若 `data_corrected` 涉及大量 ID、公式、Domain ownership 或公開語意改變，依實際影響提升 minor／major，不能一律 patch。

### 5.4 同一 GameVersion 多次 Wiki 發布

允許且預期：

```text
GameVersion v3.2.79 + WikiVersion wiki-v1.0.0
GameVersion v3.2.79 + WikiVersion wiki-v1.1.0
GameVersion v3.2.79 + WikiVersion wiki-v1.1.1
```

每次發布都有獨立 Release ID、source revision、publishedAt 與 SyncStatus。WikiVersion 不因 Git commit 自動增加，必須經 release review 決定。

## 6. Wiki tag 與 GitHub Release

未來建議：

- Git tag 與 WikiVersion 完全一致，例如 `wiki-v1.0.0`。
- tag 指向發布該 Wiki snapshot 的 full Wiki commit SHA。
- 建立 GitHub Release，title 使用 WikiVersion，正文由已驗證 Release／ChangeRecord 生成或人工整理。
- 不把原作者 GameVersion tag 放在 Wiki repository。
- 不把未發布 branch commit 標成正式 WikiVersion。

GitHub Release 是發布載體，不是資料真相；正式 Release entity、published snapshot 與 tag/commit 必須互相核對。

## 7. SchemaVersion

### 7.1 雙層版本

採用：

1. **Global SchemaVersion**：Release Hub envelope、EntityRef、共用 verification／sync status 等跨 Dataset 契約的整體相容版本。
2. **Dataset SchemaVersion**：各 Dataset 自己的 payload／entity contract 版本，例如 Craft、Equipment、Releases。

SyncStatus 的 `schemaVersion` 表示 global version；DatasetSyncStatus 應另有 `datasetSchemaVersion`。不能只用單一全域版本掩蓋某個 Dataset 的破壞性變更。

初版規劃：

```text
global schemaVersion = 1.0.0
dataset schemaVersion = 各 Dataset 在 Stage C 定案；未定案者 unresolved
```

本文件不宣告現有 Craft schemas 已是 `1.0.0`；它們目前只有 JSON Schema draft 宣告。

### 7.2 major／minor／patch

**major**：

- 移除／重命名 required 欄位。
- 改變欄位型別、identity、null／missing 語意或 Relation 方向。
- 現有 consumer 無法在不遷移下讀取。

**minor**：

- 向後相容新增 Entity、Relation、optional 欄位或列舉能力。
- 新增 Dataset schema 且不破壞既有 payload。
- 擴充 validation，既有有效資料仍有效；若既有資料可能失效，必須明示 migration/revalidation。

**patch**：

- 修正文檔、錯誤訊息或 validator 實作，使其符合已定契約。
- 不改有效 payload 集合或欄位語意的精確化。

### 7.3 Migration

- major 必須提供 migration plan、fixtures、forward/backward compatibility 與 rollback。
- minor 若新增 required-by-policy 欄位、改變 default 或使既有資料失效，也必須有 migration／revalidation plan。
- patch 原則上不需要資料 migration；若需要，代表版本分類可能錯誤。
- Published snapshots 不就地改寫；以新 SchemaVersion 產生新 snapshot，歷史 Release 保留原版本。

### 7.4 UI 顯示

- 一般玩家首頁不需突出 SchemaVersion。
- Release Hub 可在「資料版本／技術詳情」顯示，或在 schema mismatch、review_required、failed 時提供診斷。
- 不得讓 SchemaVersion 看起來像 GameVersion 或 WikiVersion。

## 8. Release identity 與版本關係

Release 至少引用：

```text
releaseId
gameVersion
wikiVersion
globalSchemaVersion
sourceManifestIdentity
wikiCommitSha
publishedAt
```

- Release ID 穩定且不等同 WikiVersion，但一個正式 WikiVersion 原則上只對應一個 published Release。
- 重新發布相同 payload 不建立新的 WikiVersion；若 published artifact 或內容改變，依變更規則建立新版本。
- Draft／review candidate 不占用正式 tag；可使用內部 candidate ID，不顯示為玩家版本。

## 9. 第一個 Bootstrap Release

第一個 Release：

- 類型是 bootstrap baseline，不是全量 added diff。
- GameVersion 候選 `v3.2.79`。
- Source SHA 候選 `9252a99c152bca1256a900c94335cadff52558e9`。
- WikiVersion 建議 `wiki-v1.0.0`，但只有 Stage C 完成所有發布閘門後才能正式占用。
- Global SchemaVersion 建議 `1.0.0`，但 Dataset versions 必須逐一列出，未知者 unresolved。
- Dataset statuses 按 scope 誠實標示 partial／review_required／unknown；不得因建立 baseline 而全為 up_to_date。
- 不把現有全部 Entity 生成为 `added` ChangeRecord。

## 10. Validation rules

- gameVersion、wikiVersion、schemaVersion、sourceRevision 各有獨立欄位。
- WikiVersion 符合 `wiki-vMAJOR.MINOR.PATCH`。
- source revision 是 full SHA；不得出現在 WikiVersion。
- published WikiVersion 唯一，tag、Release entity、Wiki commit 相符。
- Schema major mismatch 阻止不相容 consumer 載入。
- Dataset SchemaVersion 缺失時 status 不得是 up_to_date。
- publishedAt 不作版本 identity。
- 同一 GameVersion 多次 Wiki release 合法。

## 11. Unresolved

- WikiVersion bump 的 release approver／流程尚未定案。
- GitHub tag／Release 自動化尚未設計。
- 各 Dataset 初始 SchemaVersion 尚未 audit。
- global schema envelope 的具體 Schema 尚未建立。
- Wiki commit SHA 與 published artifact hash 契約尚未定案。

以上問題進入 Stage C 前必須轉成可驗證規則；本階段不得建立 tag 或 Release。
