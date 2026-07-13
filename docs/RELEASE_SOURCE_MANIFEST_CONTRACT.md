# Release Source Manifest 契約

## 1. 目的與決策狀態

Source Manifest 用來證明一次同步所使用的原作者來源、不可變 revision、取得時間、檔案集合及檔案內容。它是 source snapshot 的 identity 與完整性證據，不是 Release、玩家更新紀錄或 published Wiki snapshot。

本文件只定義契約，不建立 manifest JSON、不取得來源檔案，也不執行同步。

## 2. 正式模型

```json
{
  "sourceRepository": "https://github.com/shines871/idle-lineage-class",
  "branch": "main",
  "commitSha": "9252a99c152bca1256a900c94335cadff52558e9",
  "commitDate": null,
  "gameVersion": "v3.2.79",
  "retrievedAt": "ISO-8601 timestamp",
  "retrievalMethod": "git_archive",
  "files": [
    {
      "path": "js/00-data.js",
      "sha256": "64 lowercase hexadecimal characters",
      "size": 0
    }
  ],
  "manifestSchemaVersion": "1.0.0"
}
```

以上 SHA 與 GameVersion 是 Stage A 已驗證的 bootstrap 候選；本階段不代表已建立對應 snapshot。

## 3. 欄位契約

| 欄位 | 必要性 | 規則 |
|---|---|---|
| `sourceRepository` | 必填 | canonical HTTPS repository URL，不使用 Pages URL代替 |
| `branch` | 必填 | 取得 revision 時的 branch context；不構成 immutable identity |
| `commitSha` | 必填 | 精確 40 位 lowercase Git full SHA；唯一 source revision identity |
| `commitDate` | 可空 | commit 的 ISO-8601 時間；無法可靠取得時為 null |
| `gameVersion` | 必填或 unresolved | 從 manifest 內已 hash 的權威來源解析，不由 commit message 推測 |
| `retrievedAt` | 必填 | 取得 snapshot 的 UTC／含 offset ISO-8601 時間 |
| `retrievalMethod` | 必填 | `git_archive`、`git_checkout`、`github_raw`、`github_pages` |
| `files` | 必填 | 完整列出 snapshot 納入檔案，依 path 穩定排序 |
| `manifestSchemaVersion` | 必填 | Source Manifest 契約版本，初版規劃 `1.0.0` |

### 3.1 commitSha

- 必須是 full SHA，不接受短 SHA、branch 名、tag、cache token 或 GameVersion。
- branch 可移動，因此 `branch + retrievedAt` 不能取代 full SHA。
- tag 即使存在也可能移動；必須解析並保存其 target full SHA。
- manifest 的 immutable identity 由 `sourceRepository + commitSha + files content hashes` 組成。

### 3.2 commitDate、retrievedAt 與 releaseDate

- `commitDate`：Git commit metadata 的時間。
- `retrievedAt`：Wiki 同步流程取得來源的時間。
- `releaseDate`：原作者正式發布日期，若無 Release／官方證據則為 null。
- 三者不可互相代用；首頁不得把 retrievedAt 或 commitDate 顯示為遊戲 releaseDate。

### 3.3 gameVersion

- 目前權威候選是 `js/00-data.js` 的 `GAME_VERSION`。
- 該檔必須包含在 `files` 且 hash 驗證成功後，才可解析 gameVersion。
- `index.html` cache token 只能作 cross-check，不是權威 GameVersion。
- 若權威來源缺失、解析失敗或與其他明示版本矛盾，manifest validation 必須 blocking fail；不得採用較新的字串猜測。

## 4. Retrieval method

### 4.1 `git_archive`

從指定 full SHA 產生 archive。建議作為正式 release pipeline 的首選：來源不可變、檔案集合可重現，且不需保留工作樹 metadata。

### 4.2 `git_checkout`

從已驗證 repository checkout 指定 full SHA。可接受，但必須確認工作樹無額外修改，且 manifest 只 hash tracked source files。

### 4.3 `github_raw`

只有 URL 明確包含 full SHA 時可作 immutable retrieval。以 branch 名或 `main` 建立的 raw URL 不可作正式 identity。

### 4.4 `github_pages`

- GitHub Pages 是 mutable deployment endpoint，不能單獨作 immutable source identity。
- 若暫時只能使用 Pages，仍必須另外保存已驗證 commitSha，並逐檔比對 SHA-256。
- 任一 Pages 檔案無法與該 commit 的相同 path/hash 對應，manifest 必須 `failed`，不得發布。
- Pages 可作部署觀察或 fallback evidence，不建議作 bootstrap baseline 的正式取得方法。

## 5. File manifest

每個納入 source snapshot 的檔案都必須記錄：

```json
{
  "path": "relative/posix/path",
  "sha256": "...",
  "size": 123
}
```

規則：

- `path` 相對於 repository root，使用 `/`，不得含 `..`、絕對路徑或本機使用者路徑。
- `sha256` 對原始 bytes 計算，不先改換行、編碼或格式。
- `size` 是原始 byte length，不是字元數。
- files 依 path code-point order 穩定排序。
- 每個 path 唯一；symlink、submodule 或不支援檔案類型必須有明確 policy，未定案前 blocking。
- snapshot 使用的所有輸入檔都必須列出；不得只 hash `GAME_VERSION` 檔而忽略生成資料所用其他檔案。

### 5.1 Hash mismatch

下列任一情況都是 blocking：

- 實際檔案 SHA-256 與 manifest 不符。
- size 不符。
- manifest 有檔案但 snapshot 缺失。
- snapshot 有被 generator 使用的檔案但 manifest 未列。
- 相同 `sourceRepository + commitSha` 出現不同內容 hash。
- gameVersion 權威檔 hash 正確，但解析值與 manifest 不一致。

不得自動改寫 manifest 以「修正」mismatch。必須重新取得來源或建立新的、可解釋的 manifest candidate。

## 6. Snapshot identity 與保存

Source Manifest 應與 source snapshot 一起保存，並在 normalized snapshot、published snapshot 與 Release read model 中以 immutable manifest identity 引用。

概念 identity：

```text
sourceManifestIdentity = sha256(canonical manifest payload)
```

canonical payload 規則須在 Stage C Schema／validator 階段定案；在此之前不得自行產生正式 identity。

- manifest 一旦成為 published baseline 的來源證據即不可就地修改。
- metadata 修正若改變語意，建立新 manifest revision 並保留舊紀錄。
- manifest 本身應進 Git；完整 source snapshot 是否進 Git 取決於大小、授權與重取能力，但 published baseline 必須能由 manifest 所指 full SHA 重建。
- 若 source snapshot 不進 Git，至少保存 manifest、取得程序、repository、full SHA 與所有輸入 hash。

## 7. Bootstrap source file scope

第一個 baseline 的 file scope 不應直接等同整個 repository，也不應沿用 `download.py` 的歷史清單而不審核。應按 Dataset input 建立明確集合：

- Core game version：`js/00-data.js`。
- HTML module manifest／cache cross-check：`index.html`。
- P0 Dataset 所需 JS：由 Equipment、Skill、Craft、Monster、Card 的 extractor/input audit 決定。
- Craft Wiki generator input 若仍是 `wiki.html`，該檔屬 Wiki source input，不是原作者 source snapshot；必須另外記錄 Wiki input revision，不可混入原作者 manifest 假裝同源。

這個來源分離是 blocking：原作者 source manifest 與 Wiki-local generated input manifest 不可混成同一 repository/revision。

## 8. 驗證與 diagnostics

建議 diagnostic codes：

- `invalid_full_sha`
- `source_file_missing`
- `source_hash_mismatch`
- `source_size_mismatch`
- `unmanifested_generator_input`
- `game_version_missing`
- `game_version_mismatch`
- `mutable_source_without_revision`
- `mixed_source_revision`
- `unsupported_source_file_type`

任何完整性、revision 或 GameVersion identity 問題皆為 blocking。commitDate、releaseDate 缺失可為 unresolved/non-blocking，但不得顯示假日期。

## 9. Stage C 前未解事項

- source manifest 實際 JSON path 與檔名尚未定案。
- canonical JSON serialization 與 manifest identity hash 尚未定案。
- bootstrap P0 完整輸入檔清單尚未完成 Domain audit。
- symlink／submodule policy 尚未定案。
- 原作者 commit `9252a99...` 的精確 commitDate ISO timestamp 尚未寫入可信 manifest。
- Craft 的 Wiki-local source revision 必須採 Wiki Git SHA 或獨立 input manifest，尚未定案。

以上均標記 unresolved；不得以本文件中的範例值建立正式 manifest。
