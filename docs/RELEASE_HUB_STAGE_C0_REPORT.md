# Release Hub Stage C0 實作報告

## 1. 階段範圍與完成狀態

Stage C0 已完成 Source Manifest 的最小可執行骨架：JSON Schema、offline deterministic generator、validator、bootstrap candidate fixture 與自動測試。本階段沒有建立 Release、ChangeRecord、SyncStatus、WikiVersion／SchemaVersion 實際資料，也沒有執行網路同步或 Domain semantic diff。

新增檔案：

- `schemas/release-source-manifest.schema.json`
- `tools/generate_source_manifest.py`
- `tools/validate_source_manifest.py`
- `tools/test_source_manifest.py`
- `fixtures/releases/bootstrap-source-manifest.example.json`
- `fixtures/releases/bootstrap-source-files.txt`
- `docs/RELEASE_HUB_STAGE_C0_REPORT.md`

既有網站、Craft 資料、Craft 工具、HTML、CSS、JavaScript 與 JSON 均未修改。

## 2. Schema 設計

Schema 使用 JSON Schema draft 2020-12，固定 HTTPS `$id`：

```text
https://dim-era-claw.github.io/idle-lineage-wiki/schemas/release-source-manifest.schema.json
```

根物件禁止額外欄位，要求：

- `sourceRepository`：HTTPS repository URL。
- `branch`：非空且符合 Git branch 基本安全字元限制。
- `commitSha`：40 位 lowercase hexadecimal。
- `commitDate`：ISO-8601 date-time 或 null。
- `gameVersion`：非空字串或 null；generator 正常輸出必為解析值。
- `retrievedAt`：ISO-8601 date-time。
- `retrievalMethod`：`git_archive`、`git_checkout`、`github_raw`、`github_pages`。
- `files`：至少一筆 source file。
- `manifestSchemaVersion`：SemVer，Stage C0 支援 `1.0.0`。

每個 source file 要求相對 POSIX path、64 位 lowercase SHA-256、非負整數 byte size。Schema 阻擋絕對路徑、Windows drive path、`..` segment、反斜線與重複 slash；跨項目的 path uniqueness、排序及實體檔案安全由 validator 補足。

## 3. Generator CLI

```text
python tools/generate_source_manifest.py \
  --source-root <isolated-source-root> \
  --repository-url https://github.com/shines871/idle-lineage-class \
  --branch main \
  --commit-sha <40-char-full-sha> \
  --retrieval-method git_archive \
  --file-list <source-files.txt> \
  --retrieved-at <ISO-8601> \
  [--commit-date <ISO-8601>] \
  [--game-version-path js/00-data.js] \
  --output <manifest.json>
```

CLI 不提供 URL、fetch、clone、pull 或 archive 下載能力。呼叫端必須先準備隔離 source root，並明確提供 repository、full SHA、retrieval method、file list 與時間。

Generator：

- 驗證 full lowercase SHA、SemVer、時間與 retrieval method。
- 讀取 UTF-8 file list，忽略空行與 `#` comment。
- 阻擋 duplicate、絕對路徑、`..`、反斜線、source-root escape、缺檔、目錄與 symlink。
- 每個檔案按原始 bytes 計算 SHA-256 與 size。
- 依 path 排序後輸出。
- 只寫 `--output` 指定檔案；output 不可位於 source root 內。

## 4. GAME_VERSION parser

Parser 只接受單一 literal 宣告：

```js
const GAME_VERSION = 'v3.2.79';
```

雙引號 literal 亦可。以下情況阻擋生成：

- `js/00-data.js` 未列入 manifest scope。
- 權威檔不是 UTF-8。
- 找不到 literal `GAME_VERSION`。
- 出現兩個以上 literal 宣告。
- 使用函式、template expression 或其他非 literal expression。

Parser 不會從註解、cache-busting token 或「看起來較新」的其他版本字串猜值。

## 5. Path traversal 與 symlink policy

- source path 必須是 repository-relative POSIX path。
- 每一層 path component 都檢查 symlink；Stage C0 一律 blocking，不追蹤 symlink。
- `resolve(strict=True)` 後必須仍在 resolved source root 內。
- validator 會阻擋多個 manifest path 指向同一實體檔案。
- manifest 不得把自身列為 source file。
- generator output 必須位於 source root 外，避免 output 成為輸入或污染 snapshot。

此政策偏保守；symlink／submodule 若未來確有需求，必須先擴充契約、Schema、manifest metadata 與測試。

## 6. Deterministic output

- `retrievedAt` 不由工具讀取系統時間，必須由 CLI 明確提供。
- 同一 source bytes、metadata 與 timestamps 產生相同 manifest bytes。
- JSON 使用 UTF-8、LF、兩空格 indent、排序 key、保留 Unicode、單一結尾 newline。
- files 永遠依 path 排序。
- 不輸出絕對路徑、temp path、host name 或其他本機資訊。
- 測試已驗證反向 file-list 輸入仍產生 byte-identical output。

## 7. Validator 與 diagnostics

Validator CLI：

```text
python tools/validate_source_manifest.py \
  --manifest <manifest.json> \
  --source-root <source-root> \
  [--schema schemas/release-source-manifest.schema.json] \
  [--required-input <relative-path>] \
  [--required-input-list <file-list.txt>]
```

輸出為 structured JSON：

```json
{
  "valid": true,
  "blockingCount": 0,
  "diagnostics": []
}
```

每筆 diagnostic 包含 `code`、`severity`、`blocking`、`path`、`message`。已支援／保留的主要 code：

- `invalid_full_sha`
- `source_file_missing`
- `source_hash_mismatch`
- `source_size_mismatch`
- `unmanifested_generator_input`
- `game_version_missing`
- `game_version_mismatch`
- `mutable_source_without_revision`
- `mixed_source_revision`（契約保留；單一離線 snapshot 無法單靠 manifest 自動推導）
- `unsupported_source_file_type`
- `unsafe_source_path`
- `duplicate_source_path`
- `unsorted_source_files`
- `schema_error`
- `unsupported_manifest_schema_version`

blocking diagnostic 使 CLI exit code 為 1。`gameVersion: null` 另產生 non-blocking warning，但正常 generator 不產生 null。

## 8. 測試結果

執行：

```text
python -m py_compile tools/generate_source_manifest.py tools/validate_source_manifest.py tools/test_source_manifest.py
python tools/test_source_manifest.py
```

結果：22／22 通過。

覆蓋：

1. valid manifest。
2. short SHA。
3. uppercase SHA。
4. missing source file。
5. hash mismatch。
6. size mismatch。
7. duplicate path。
8. unsorted files。
9. absolute／Windows path。
10. `../` traversal。
11. symlink。
12. GAME_VERSION missing。
13. duplicate GAME_VERSION。
14. non-literal GAME_VERSION。
15. GAME_VERSION mismatch。
16. github_pages without full SHA。
17. unmanifested generator input。
18. deterministic、UTF-8、LF output。
19. output inside source root。
20. CLI only writes requested output。
21. file-list sorting／uniqueness。
22. source-root escape。

既有回歸測試：

- `python tools/validate_craft_data.py`：通過；279 recipes、47 NPC、471 items source closure、cycle/yield/hash baselines 正常。
- `node tools/test_wiki_data_core.js`：通過；parity、immutability、duplicate diagnostic、reset isolation 正常，Console errors 為 0。

## 9. Bootstrap fixture 性質

`bootstrap-source-files.txt` 目前只有：

```text
index.html
js/00-data.js
```

這是刻意縮小的 C0 candidate scope，只驗證 manifest pipeline 與 GameVersion extraction，不代表完整 P0 source file inventory。

example manifest 使用：

```text
sourceRepository  https://github.com/shines871/idle-lineage-class
branch            main
commitSha         9252a99c152bca1256a900c94335cadff52558e9
gameVersion       v3.2.79
retrievalMethod   github_pages
```

檔案 hash 來自 Stage C0 執行時的本機鏡像 `index.html` 與 `js/00-data.js`。它通過對目前本機 source root 的 hash、size 與 GAME_VERSION 驗證，但沒有在本階段從原作者 commit archive 重新取得檔案，故不能證明這些 bytes 等於該 commit。

因此 fixture 明確是：

- example／candidate。
- 測試 fixture。
- 不是正式 source manifest。
- 不是 immutable source archive 的證據。
- 不是 published bootstrap baseline。
- 不可用來把 P0 Dataset 標為 up_to_date。

`wiki.html` 未納入原作者 source manifest。Craft generator 的 Wiki-local input 未來必須使用獨立 Wiki input manifest／Wiki commit revision，不可混成原作者 repository source。

## 10. Git tracking 與 provenance 狀態

Stage C0 新增的 Schema、工具、fixture 與報告目前皆在工作區、尚未 commit。fixture 只有在未來 commit 後才具有 Wiki Git revision；即使 commit，也仍只是 candidate，除非另有原作者 immutable archive hash 驗證及發布審核。

本階段沒有 tag、GitHub Release、Release entity 或 published snapshot。

## 11. 是否修改網站或既有資料

否。本階段未修改：

- `wiki.html`
- `index.html`
- CSS／JavaScript
- `data/craft/*.json`
- 既有 Craft generator／validator
- WikiDataCore
- Release JSON／latest／sync-status

所有測試只讀既有專案檔；測試暫存目錄在結束時移除。

## 12. 下一步與阻擋問題

Stage C0 骨架可進入 code review，但尚不能建立正式 baseline。下一步應依序：

1. 從原作者 full SHA 建立真正隔離的 `git_archive`／`git_checkout` source root。
2. 完成 P0 Dataset source input inventory，不只兩個檔案。
3. 用 archive bytes 重新生成 manifest，與 candidate hashes 比較。
4. 取得並記錄可信 commitDate；releaseDate 無官方證據時維持 null。
5. 為 Wiki-local Craft input 建立獨立 source/input manifest 契約。
6. Stage C0 Schema／validator review 通過後才建立正式 baseline candidate。
7. 未完成 Equipment、Skill、Monster、Card generator／validator／semantic policy 前，整站不得 up_to_date。

後續仍不得直接跳到 Release、ChangeRecord、SyncStatus、首頁或跨 Domain semantic diff 實作。
