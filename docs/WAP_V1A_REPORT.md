# Wiki Automation Pipeline v1-A Report

## 1. Result

本階段建立可重用、完全離線的 Semantic Diff foundation，正式支援 Monster、Map、DropTable、Equipment。工具只比較 Approved 與 Candidate，不修改輸入、不更新正式 Dataset、不接線網站。

## 2. Added files

- Architecture／contract：`docs/WIKI_AUTOMATION_PIPELINE.md`、`docs/SEMANTIC_DIFF_CONTRACT.md`
- Schema：`schemas/semantic-release-diff.schema.json`
- Tools：`tools/generate_release_diff.py`、`tools/validate_release_diff.py`、`tools/render_release_notes.py`、`tools/test_release_diff.py`
- Small fixtures：`fixtures/releases/semantic-diff-approved.example/`、`fixtures/releases/semantic-diff-candidate.example/`
- Golden output：`fixtures/releases/semantic-release-diff.example.json`
- Report：`docs/WAP_V1A_REPORT.md`

沒有修改既有檔案。

## 3. Pipeline responsibilities

1. Source Snapshot：固定 upstream full SHA，不碰 Wiki Dataset。
2. Source Manifest：保存檔案 hash、size、revision與 input inventory。
3. Domain Generator：只產 Candidate，不能發布。
4. Validator：驗證 Candidate，不修資料。
5. Semantic Diff：以正式 ID比較 Approved／Candidate，不修改兩側。
6. Human Review Gate：blocking、conflict、unresolved、removal與分類變更需人工核准。
7. Release Builder：只讀已核准 Diff，不重跑 Domain Generator。
8. Deployment：只部署 Approved Dataset與已驗證 Release read model。

## 4. Diff model and Domain support

頂層保存 diff/version/source identities、input相對路徑、四個 Domain diff、summary、review與 diagnostics。Change record保存 stable `changeId`、正式 Entity identity、change type、field changes、review status、blocking與 Evidence。

Identity：Monster=`monsterId`、Map=`mapId`、DropTable=`dropTableId`、Equipment=`equipmentId`。displayName、中文名稱、陣列 index、record order與 runtime hash均不作 identity。

## 5. Array／Relation semantics

- EntityRef集合按 `entityType + entityId` 比較。
- DropEntry按 `dropEntryId` 比較，reorder不產生假更新。
- Map membership、Monster map/drop refs、Equipment relations與 refs是 relation-aware。
- 未列為 set的 array保留順序語意。
- object key、JSON formatting、record order、provenance key order無語意。
- null、missing、unresolved與 explicit zero分開；概率單位不自行換算。

## 6. Unresolved／Conflict

新增 unresolved 至少 review_required；required identity/relation/owner是 blocked。unresolved被解析仍需 review並保留原 diagnostic identity。多 target conflict一律 blocked，不選第一筆。

「地獄奴隸」fixture 同時提供 `de_train_hellslave`、`sanct_hellslave` 兩個正式候選。Golden diff輸出 `legacy_monster_name_hellslave` conflict，`reviewStatus=blocked`，沒有把 Drop owner自動指向任何 Monster。

## 7. Validator

驗證項目包含 JSON Schema、40位 lowercase SHA、Domain／change／review vocabulary、唯一 changeId、Entity ID存在、blocking一致性、modified fieldChanges、technical-only purity、summary一致、deterministic ordering、UTF-8/LF/single newline、canonical bytes與本機路徑排除。

Renderer在讀取前執行同一 validator；invalid diff不能產生 Markdown。

## 8. Tests and determinism

- WAP tests：45/45 passed。
- 覆蓋需求列出的36類案例，另含 probability unit、CRLF、canonical JSON、output/input collision與CLI output isolation。
- 相同輸入 byte-identical。
- Domain selection order與 input record order不影響輸出 bytes。
- Markdown renderer byte-stable。
- 正式 `data/` 對自身比較可產生0 semantic change，不修改輸入。

## 9. Release Notes sample

Golden diff的 Markdown結構：

```text
# Release Diff Review: wiki-v1.0.0 → v3.4.17-candidate
## Source revisions
## 更新摘要
## Monster
## Map
## Drop
## Equipment
## 尚待人工確認
## Blocking conflicts
## Technical-only changes
```

Blocked「地獄奴隸」只出現在尚待確認／Blocking區，不會出現在玩家 Domain主更新。Technical-only source revision變化只進技術區。

## 10. Current limitations

- 不自動判定 balanced、fixed、mechanic_changed。
- 尚無 review decision input、Release Builder、tombstone storage、Schema-major migration或正式 alias mapping。
- 工具依賴 Domain Validator先驗證 Candidate Schema與 foreign keys。
- 本階段 fixtures是小型人工案例，不是 v3.4.17資料或正式 Dataset。

## 11. U2-B integration plan

1. U2-B先核准並修改 v3.4.17所需 fixture／Schema／generator。
2. Generator只輸出 ignored candidate roots。
3. Domain validators全部通過後，以目前正式 `data/` 作 Approved root、ignored candidate作 Candidate root。
4. 執行本工具產生 candidate release diff與 Markdown review notes。
5. 先處理「地獄奴隸」mapping conflict、Equipment classification/requirement gaps與所有 blocking diagnostics。
6. Human Review核准後，才另立 Dataset publish與Release Builder階段。

本 foundation可用於 v3.4.17 Candidate整合，但不能繞過 U2-B、Domain validation或人工審核，也不能直接發布。

## 12. Final verification

通過：

- Semantic Diff validator與45/45 tests。
- Source Manifest 22/22。
- Monster validator與7/7 tests。
- Equipment validator與30/30 tests。
- Equipment view payload validator與30/30 tests。
- Legacy Mapping validator與30/30 tests。
- Craft validator。
- WikiDataCore tests。
- Monster UI Beta 21/21、Monster UI RC 15/15。
- Equipment Repository 25/25、Shadow Comparison 32/32。
- `git diff --check`。

既有 Equipment UI test debt：

- `tools/test_equipment_view_adapter.js` 的前58項通過，第59項仍斷言 `EQUIPMENT_DATA_VIEW_ENABLED=false`。
- `tools/test_equipment_ui_rc.js` 第一項同樣斷言預設關閉。
- 正式網站已由後續 Equipment Publish 明確改為 Dataset View預設開啟，並保留 `equipmentData=0` legacy fallback；兩個舊測試仍停留在 E3-D1／RC規格，因此與現行 `wiki.html`、`docs/EQUIPMENT_PUBLISH_REPORT.md` 不一致。
- v1-A未修改這兩份既有測試，也未修改 `wiki.html`。U2-B開始前應另行把發布後的預設模式驗收整理成現行 regression suite。

工作區檢查確認只有本階段新增檔案；沒有修改 `data/monster/`、`data/equipment/`、其他正式 Dataset、fixtures、既有 Schema、Generator、`wiki.html`、CSS或JavaScript。未發布v3.4.17，未commit或push。
