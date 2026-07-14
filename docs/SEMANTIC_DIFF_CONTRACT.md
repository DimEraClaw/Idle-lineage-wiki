# Semantic Release Diff Contract

## 1. Boundary

Semantic Release Diff 是 Approved 與 Candidate normalized Dataset 之間的 machine-readable review candidate。它不是 Git diff、Release、ChangeRecord 或發布授權；任何 record 在 Human Review Gate 前都不可宣稱為正式玩家更新。

初版 `diffVersion` 為 `1.0.0`，正式支援 `monster`、`map`、`drop`、`equipment`。

## 2. Deterministic input contract

CLI：

```text
python tools/generate_release_diff.py \
  --approved-root <path> \
  --candidate-root <path> \
  --approved-version <version> \
  --candidate-version <version> \
  --approved-source-sha <40-char-lowercase-sha> \
  --candidate-source-sha <40-char-lowercase-sha> \
  --domains monster,map,drop,equipment \
  --output <release-diff.json>
```

- 完全離線、不讀目前時間、不修改輸入。
- root 可使用相對或明確絕對路徑；CLI path 不能含 `..` traversal 或 NUL。
- output 不得與任何輸入 Dataset 是同一檔案。
- SHA 僅接受 40 位 lowercase hexadecimal。
- 輸出為 UTF-8、LF、無 BOM、單一 final newline、sorted-key canonical JSON。
- `generatedFrom` 只保存 Dataset root 內相對 path，不保存本機絕對路徑。

支援兩種 root layout：

```text
<root>/monster/monsters.json        <root>/monsters.json
<root>/monster/maps.json            <root>/maps.json
<root>/monster/drop_tables.json     <root>/drop_tables.json
<root>/equipment/equipments.json    <root>/equipments.json
```

unresolved diagnostics 同樣支援 Domain 子目錄與 fixture 的 `monster-unresolved.json`／`equipment-unresolved.json`。

## 3. Identity

| Domain | Entity type | Identity |
|---|---|---|
| Monster | `monster` | `monsterId` |
| Map | `map` | `mapId` |
| Drop | `dropTable` | `dropTableId` |
| Equipment | `equipment` | `equipmentId` |

- 禁止以中文名稱、displayName、陣列 index、object order 或 runtime hash 配對。
- 缺少正式 ID 的 record 不以名稱補救；跳過 Entity comparison並產生 blocking `formal_identity_missing` diagnostic。
- 重複正式 ID 是 generation failure，不選第一筆。
- DropEntry 使用契約中的 `dropEntryId`；EntityRef 使用 `entityType + entityId`。

## 4. Top-level model

頂層欄位：

- `diffVersion`
- `approvedVersion`、`candidateVersion`
- `approvedSourceRevision`、`candidateSourceRevision`
- `generatedFrom`
- `domains`
- `summary`
- `review`
- `diagnostics`

每個 Domain 包含 `entityType`、兩側 count、`added`、`removed`、`modified`、`unchangedCount`、`unresolvedAdded`、`unresolvedResolved`、`conflicts`、`technicalOnly`。

Change record 包含 `changeId`、Domain／Entity identity、`changeType`、結構化 `fieldChanges`、`reviewStatus`、`blocking`、Evidence 與 notes。新生成結果只可使用 `auto_verified`、`review_required`、`blocked`；`approved`、`rejected` 保留給未來明確 review decision input。

## 5. Change types

支援：`added`、`removed`、`modified`、`relation_changed`、`unresolved_added`、`unresolved_resolved`、`conflict`、`technical_only`、`display_only`、`data_corrected`。

- 新 Entity 可先 `auto_verified`，但仍不代表可發布。
- Equipment removal 預設 `blocked`；其他 removal 至少 `review_required`。
- classification、canonical value、display label 與 relation change 至少 `review_required`。
- conflict 一律 `blocked`。
- `data_corrected` 不由工具猜測，必須在後續 review/mapping 階段有明確決策。

## 6. Field categories

### 6.1 Canonical

- Monster：`level`、`hp`、`boss`、`status` 與其他 contract canonical fields。
- Map：`status` 與非 label、非 relation canonical fields。
- Drop：probability 的 value/unit/basis、quantity、condition、runtime modifier、drop status。
- Equipment：`itemType`、`equipmentGroup`、`equipmentType`、`slot`、`classRequirements`、`rarity`、`baseStats`、`safeEnhance`、`price`、`status`。

`null`、missing、unresolved 與 explicit zero 不合併；`null → 0` 是 semantic change。沒有欄位級容差或單位 policy 時精確比較；percent 與 ratio 不互換猜測。

### 6.2 Relation

`mapRef/mapRefs`、`dropTableRef`、`monsterRefs`、`bossRefs`、`relations`、`skillRefs`、`setRefs`、`mechanicRefs`、Drop owner／item refs與 Drop entries 都是 relation-aware paths。純 relation 差異輸出 `relation_changed`；若同一 Entity 同時有 canonical change，保留 `modified` 並在 fieldChanges 標記 relation category。

MechanicRef 新增是 relation change，不等於 base stat 修改。

### 6.3 Display-only

`displayName`、description、editorial label、display sort order 的單獨變化輸出 `display_only` 並進人工 review。顯示名稱不參與 identity。

### 6.4 Technical／verification

只有 verification、version、provenance、source revision、evidence location、deterministic locator 改變，而 canonical value 沒變時輸出 `technical_only`。JSON key order、格式、換行、record order與 set-like array reorder不建立 change。

Source relocation 只有在 semantic value 未變時才能 technical-only；validator 禁止 technical-only record 混入 canonical field change。

## 7. Array and relation semantics

不是所有 array 都使用同一規則：

- 無序集合：aliases、Monster map refs、EntityRef relations、Map monster/boss refs、Equipment class list／refs、conditions與 runtime modifier集合。先以正式 element identity排序比較，重複 identity是 failure。
- Drop entries：以 `dropEntryId` 比較；entry reorder不產生差異。新增、移除與同 entry probability改變分開呈現。
- EntityRef：以 `entityType + entityId` 比較。
- 其他未列為 set 的 array 保留順序語意；reorder是 semantic candidate。
- field provenance依 semantic key比較，object key順序無語意。

## 8. Unresolved and conflict

- Candidate 新 diagnostic：`unresolved_added`，至少 `review_required`；identity、relation、owner 或明示 blocking欄位為 `blocked`。
- Approved diagnostic消失：`unresolved_resolved`，保留原 diagnostic ID／fieldPath identity並要求 review。
- 同一 legacy key有多個正式 target：`conflict` + `blocked`；不能選第一筆。
- diagnostic 有明示穩定 `id` 時使用該 ID；否則只以 code、正式 EntityRef與 fieldPath組合 identity，不以中文 sourceValue建立 target ID。
- 無正式 Entity ID 的 source record只進 blocking diagnostic，不能建立假的 Entity change。

Fixture `legacy_monster_name_hellslave` 保存「地獄奴隸」sourceValue與兩個候選 `de_train_hellslave`、`sanct_hellslave`。輸出是 blocked conflict，沒有自動 target。

## 9. Summary and review

Summary 提供 added、removed、modified、relation changed、unresolved added/resolved、conflicts、blocking、review required及 per-Domain統計。它統計 semantic records與 blocking diagnostics，不是 raw line diff。

`review.status` 聚合規則：

1. 任一 blocking change／diagnostic → `blocked`。
2. 無 blocking但有待審 record → `review_required`。
3. 其餘 → `auto_verified`。

任何狀態都不是發布批准；Human Review Gate另行決定。

## 10. Validator and renderer

Validator 檢查 Schema、full SHA、唯一 ID、Domain與狀態 vocabulary、blocking一致性、change shape、technical-only purity、summary、排序、UTF-8/LF/canonical bytes與本機路徑。

Release Notes renderer只接受 validated diff。玩家 Domain區排除 blocked、conflict、unresolved與 technical-only；它們分別列在「尚待人工確認」、「Blocking conflicts」與技術區。Markdown同輸入必須 byte-stable。

## 11. Limitations

- v1-A 不判定 `balanced`、`fixed` 或 `mechanic_changed`；這些需要 Code／Official／Test Evidence與人工 review。
- 未實作 review decision輸入、Release Builder、tombstone storage、Schema-major migration與跨 Domain alias mapping。
- ordered collection policy仍只覆蓋四個 Domain的第一版欄位；新增欄位必須先更新契約與 fixtures。
- Diff工具不驗證 Candidate本身的 Domain Schema／foreign keys；它假設 Domain Validator已先通過。
