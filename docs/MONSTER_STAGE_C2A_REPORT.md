# Monster Domain Stage C2-A Report

## 1. 範圍與結果

Stage C2-A 已建立 Monster Dataset foundation：Schema、deterministic generator、validator、regression tests，以及由目前遊戲程式只讀生成的 Monster、Map、Base Drop 與 unresolved 資料。本階段沒有修改來源 JavaScript、`DB`、`wiki.html`、UI、Repository、WikiDataCore、Search 或 Feature Flag。

來源與邊界：

- Monster：`js/00-data.js#DB.mobs`。
- Map／spawn candidate pool：`js/00-data.js#DB.maps`。
- 已解析 Map label：`js/11-world-map.js#MAP_REGIONS`；沒有 label 的 key 不做人為美化。
- Base Drop：`js/01-drops-config.js#MOB_DROPS`。
- Probability／quantity／independent roll 證據：`js/05-kill-progression.js#killMob`。
- Card subject candidate：`js/15-cards.js#CARD_MOB_INFO`；Card ID 未定案，因此不建立 CardRef。
- 不納入特殊職業掉落表、卡片掉落、區域額外掉落及 runtime multiplier；它們不可混入 Base Drop。

## 2. 新增檔案

Schema：

- `schemas/monster.schema.json`
- `schemas/map.schema.json`
- `schemas/drop-table.schema.json`
- `schemas/drop-entry.schema.json`

Pipeline：

- `tools/generate_monster_data.py`
- `tools/validate_monster_data.py`
- `tools/test_monster_data.py`

Dataset：

- `data/monster/monsters.json`
- `data/monster/maps.json`
- `data/monster/drop_tables.json`
- `data/monster/unresolved.json`

文件：

- `docs/MONSTER_STAGE_C2A_REPORT.md`

## 3. 統計

| 類型 | 數量 |
|---|---:|
| Monster | 460 |
| Boss Monster | 70 |
| Map | 214 |
| DropTable | 433 |
| DropEntry | 3,655 |
| Unique drop ItemRef | 886 |
| 無 Map relation 的 Monster | 9 |
| 無主 `MOB_DROPS` table 的 Monster | 27 |
| unresolved records | 2,875 |

Map status：100 `complete`、114 `partial`。DropTable status：394 `complete`、39 `partial`；DropEntry status：3,603 `complete`、52 `partial`。

## 4. Identity 與資料決策

- `monsterId` 原樣沿用 `DB.mobs` key，包含既有非 ASCII key；未以名稱或排序另造 ID。
- `mapId` 原樣沿用 `DB.maps` key。
- `dropTableId` 採 `drop_table_monster_<monsterId>_base`，由 canonical owner ID 與固定 layer token 組成，不使用 owner 名稱、陣列 index 或 runtime hash。
- `dropEntryId` 採 `drop_entry_monster_<monsterId>_<itemId>_base`。目前同 table 無重複 item；generator 若發現重複會停止，不會合併或加入排序序號。
- Monster 的 `mapRef` 是排序後的 MapRef array，保留同一 Monster 出現在多 Map 的事實，不選第一張地圖。
- 一個 Monster 在本 base layer 最多一個 `dropTableRef`；無 table 時為 null，不能解讀為「確認不掉落」。
- `cardRef` 固定 null；409 個可辨識 card subject 只進 unresolved，沒有把 Monster ID 或 runtime card item ID冒充 Card ID。
- `sizeCode` 原樣保留；`size` 維持 null，避免用 S／M／L 猜正式語意。
- `version.sourceRevision` 與 `gameVersion` 維持 null；C2-A 不虛構版本，也不把當前 Git HEAD 當遊戲版本。

## 5. Drop 契約實作

- DropOwner 使用 Monster EntityRef；433／433 owner 均以目前唯一名稱映射至既有 Monster ID。名稱只在 generator extraction 階段解析，不輸出成 FK。
- `MOB_DROPS` rate 保存為 `{ value, unit: "percent", basis: 100 }`。
- `killMob` 對每個 entry 獨立判定，因此 `rollModel=independent`。
- `killMob` 明示 `gainItem(itemId, 1)`，因此 base quantity 保存 `{min:1,max:1}`。
- Boss owner context 可由 MonsterRef 反查；沒有明示 entry-level Boss-only 條件，因此 `bossOnly` 保持 null，不以 owner boss flag冒充 entry condition。
- 52 個試煉物品 entry 保存 class／quest condition source，狀態為 partial；forced-100、倍率與 gating 尚無正式 MechanicRef，因此沒有覆寫 base probability。

## 6. Unresolved

| code | 數量 | 原因 |
|---|---:|---|
| `monster_mp_unresolved` | 460 | 無通用 canonical MP source |
| `monster_size_unresolved` | 460 | 只有 raw `s` code，正式語意未定案 |
| `monster_alignment_unresolved` | 460 | 無 canonical alignment source |
| `monster_bossTier_unresolved` | 460 | 無正式 boss tier source |
| `monster_isQuestTarget_unresolved` | 460 | Quest Domain relation 尚未建立 |
| `card_identity_unresolved` | 409 | Card subject 可辨識，但 canonical Card ID 尚未定案 |
| `map_display_name_unresolved` | 114 | `DB.maps` key 無 resolved navigation label；未自行美化 key |
| `drop_runtime_modifier_unresolved` | 52 | 試煉 gating／forced-100 等 runtime 規則缺正式 MechanicRef |

Unresolved 不使已驗證 Monster／Map／Base Drop identity 消失，但相關 record 保持 partial，不得顯示為完整同步。

## 7. Validator

Validator 已檢查：

- 四個正式 Schema（Monster、Map、DropTable、DropEntry）。
- Monster、Map、DropTable、DropEntry ID 唯一性。
- EntityRef 必須回指自身 identity。
- MapRef、DropTableRef、DropOwner、DropEntryRef、ItemRef 外鍵存在且型別正確。
- CardRef 在 Card contract 前不得被假解析。
- Map→Monster 與 Monster→Map 反向一致。
- Boss／normal pool 不重疊。
- records、refs、entries 與 unresolved 使用正式鍵穩定排序。
- gold range、probability、quantity 與 DropTable／DropEntry ownership。
- checked-in JSON 與重新生成結果逐 byte 相同。

驗證結果：Schema passed；Validator passed；deterministic／byte stable passed。

## 8. Tests

`tools/test_monster_data.py` 共 7 項：

1. Generator baseline counts。
2. Validator success path。
3. Deterministic repeated generation。
4. Duplicate ID rejection。
5. Invalid MapRef rejection。
6. Schema missing-field rejection。
7. Byte stability 與 checked-in parity。

結果：7／7 passed。

## 9. Byte hashes

| File | SHA-256 |
|---|---|
| `monsters.json` | `233b96b037d2008d1ef814cb97878594d5c48677795092e73263d4e0de6cb4b7` |
| `maps.json` | `103501d2d2f9adebdf6cf9d3c8d145183167fd9002bbc02b1f8c72d65f35e6ac` |
| `drop_tables.json` | `842287c2a5766975086547fa088b95a5dac2d93ea148cf4a15cfb027c44ced84` |
| `unresolved.json` | `26bd226f1d4387c7f37fab09d6dc54af19c10915e64c5e6c027c20dd064a1237` |

## 10. 下一步建議

先做 C2-B 的契約收斂與 unresolved 最小切片，不直接進 Repository／UI：

1. 定案 S／M／L size code 語意與欄位級 Verification。
2. 為 Condition、RuntimeModifier 與 MechanicRef 建立正式 Schema，覆蓋 52 個試煉 entry。
3. 決定 Map label 的正式來源策略，不以 key 自動產生顯示名稱。
4. Card Contract 定案後再解析 409 個 CardRef。
5. Quest Domain 可用後再處理 `isQuestTarget`。
6. 另行核准後才評估特殊掉落表與 area／card/runtime layers；不得合併進 base table。

C2-A 不應直接跳到 Monster UI、Repository、WikiDataCore 或 Search。
