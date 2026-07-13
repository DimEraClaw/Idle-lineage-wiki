# Upstream Sync Drill #1：Source Audit

## 1. 稽核範圍與限制

本報告只比較原作者來源，不同步工作樹、不生成 Dataset、不修改 JSON／UI，也不執行 generator、validator、commit 或 push。

- 原作者遊戲部署站：`https://shines871.github.io/idle-lineage-class/`
- 原作者 repository：`https://github.com/shines871/idle-lineage-class`
- branch：`main`
- 目前 Wiki 宣告的 bootstrap source baseline 候選：`9252a99c152bca1256a900c94335cadff52558e9`
- 本次取得的最新 upstream：`c3d4f96f13aefabf1453a4a3f1f54d688fd573f6`
- 比較範圍：`9252a99c152bca1256a900c94335cadff52558e9..c3d4f96f13aefabf1453a4a3f1f54d688fd573f6`
- 中間 upstream commits：17

`9252a99...` 是目前契約記錄的基線候選，不是已發布 Source Manifest。故本報告是 source audit，不把比較結果宣稱為玩家更新紀錄或正式 semantic diff。

## 2. 最新來源身分

| 欄位 | 結果 | 證據 |
|---|---|---|
| GameVersion | `v3.4.17` | 最新 `main` 的 `js/00-data.js#GAME_VERSION` |
| Full SHA | `c3d4f96f13aefabf1453a4a3f1f54d688fd573f6` | `refs/heads/main` |
| Commit Date | `2026-07-14T03:53:40+08:00` | Git commit metadata |
| GitHub Pages | HTTP 200；`v3.4.17` | 部署站 `js/00-data.js` |
| Pages Last-Modified | `Mon, 13 Jul 2026 19:55:46 GMT` | HTTP response header |

Pages 的 GameVersion 與最新 `main` 一致，部署時間也晚於最新 commit 約兩分鐘；這是高度一致的 cross-check，但未逐檔 hash，所以不能單憑此證明 Pages 全站 bytes 精確等於該 SHA。

## 3. Raw source diff 摘要

共 2,065 個路徑發生變化：

| 狀態 | 數量 |
|---|---:|
| Modified | 33 |
| Added | 1,951 |
| Deleted | 80 |
| Renamed | 1 |

### 3.1 修改檔案

程式與樣式共 21 個：

- `css/floating-ui.css`
- `css/style.css`
- `index.html`
- `js/00-data.js`
- `js/01-drops-config.js`
- `js/02-stats-recompute.js`
- `js/03-combat-core.js`
- `js/04-combat-attack.js`
- `js/05-kill-progression.js`
- `js/06-status-allies.js`
- `js/07-skills-cast.js`
- `js/08-items-equip.js`
- `js/09-vfx-render.js`
- `js/10-ui-tabs.js`
- `js/11-world-map.js`
- `js/13-shop-save.js`
- `js/14-craft-pandora.js`
- `js/17-audio.js`
- `js/19-equipment-window.js`
- `js/22-pets.js`
- `js/23-summons.js`

資產修改 12 個：

- `assets/character/`：10 個角色圖
- `assets/icons/armors/髒汙的地精靈T恤.png`
- `assets/icons/weapons/冰之女王魔杖.png`

### 3.2 新增檔案

新增 1,951 個檔案，按可審核集合列出：

| 路徑集合 | 數量 | 用途候選 |
|---|---:|---|
| `assets/anim/` | 806 | 新／調整 Monster 動畫、城門與 Boss 動畫 |
| `assets/area/1920x1080/` | 156 | Map／Area 背景替代資產 |
| `assets/bgm/` | 2 | 音樂 |
| `assets/character/` | 7 | 角色圖與血條 |
| `assets/icons/` | 56 | Equipment／Item／Monster 圖示 |
| `assets/npc/` | 899 | NPC sprite 與 `meta.json` |
| `assets/sfx/` | 6 | 音效 |
| `assets/ui/` | 3 | 能力、技能與裝備欄 UI 圖 |
| `public/assets/login/EQ UI/` | 16 | 職業／性別 Equipment UI 圖 |

### 3.3 刪除檔案

刪除 80 個舊資產：

- `assets/area/`：55 個舊 JPG 地區圖。
- `assets/background/`：16 個舊背景 PNG。
- `assets/character/`：6 個舊 JPG 角色圖。
- `assets/icons/monsters/`：3 個舊 Monster icon。

### 3.4 Rename

- `assets/icons/armors/鋼鐵塊.png` → `assets/icons/items/鋼鐵塊.png`（100% rename）。

資產新增／刪除大多是搬遷與視覺資源更新，不能直接轉換成 Entity `added`／`removed`。

## 4. Canonical source 差異

### 4.1 Item／Equipment

`DB.items`：2,568 → 2,617，新增 49、移除 0、既有 5 筆改動。

新增 ID：

- 遺物／裝備：`relic_orin_ring`、`relic_tamer_feedbag`、`relic_earth_barrier`、`relic_water_barrier`、`relic_fire_barrier`、`relic_wind_barrier`、`relic_ghoul_fang`、`relic_sparto_shard`、`relic_corpse_needle`、`relic_morph_blade`、`relic_croc_leather`、`relic_kasta_hump`、`relic_pirate_dual`、`relic_lava_fists`、`relic_magic_resist_shirt`、`relic_fireking_blast`、`relic_waterking_caress`、`relic_windking_roar`、`relic_earthking_resist`、`relic_pure_maiden_love`、`relic_rockmage_secret`、`relic_general_swordguard`。
- 黑暗妖精聖地 Item／Material：`item_dk_book`、`item_giltas_seal`、`mat_ascetic_classic`、`mat_summonorb_core`、`mat_summonorb_shard`、`item_summonorb_full`、`mat_emperor_manual`、`mat_de_soul_crystal`、`mat_purify_potion`。
- 黑暗妖精聖地 Equipment：`wpn_giltas_sword`、`wpn_giltas_wand`、`wpn_rotten_longbow`、`wpn_cursed_emperor_blade`、`shd_rebel`、`shd_official`、`amu_pain`、`amu_doom`、`ear_cursed_black`、`rng_sage`、`ear_soul_mage`、`ear_soul_fighter`、`ear_soul_knight`、`clk_emperor`、`amr_emperor`、`hlm_emperor`、`glv_emperor`、`bot_emperor`。

既有 ID 改動：`wpn_laia_wand`、`relic_bombflower_core`、`relic_azt_mirror`、`arm_106`、`shd_redknight`。包含 gacha weight、描述與 `magicDrNonEle` → `resNone` 等欄位語意變更。

新裝備出現 `reqAvatar`、`strictAvatar`、`mrPerWis`、`allLures`、`procStatusSkill`、`counterAllEle`、`hitEchoMagic`、`missGrazeRate`、`hurtRapidfire`、`swordStr` 等目前 Equipment v1 未正式建模的 mechanic／requirement 欄位。

### 4.2 Monster

`DB.mobs`：460 → 469，新增 9、移除 0、既有 9 筆改動。

新增 Monster ID：

- `sanct_hellslave`
- `sanct_cursed_fighter`
- `sanct_cursed_mage`
- `sanct_cursed_knight`
- `sanct_scavenger`
- `sanct_tethys`
- `sanct_wyvern`
- `sanct_giltas`
- `sanct_dantes`

既有改動：`kari`、`wyvern`、`blackelder`、`antaras`、`fafurion`、`valakas`、`lindvior`、`de_elder_kina`、`de_elder_balos`。

### 4.3 Map

`DB.maps`：214 → 217，新增 3、移除 0：

- `dark_elf_sanctuary`
- `cursed_dark_elf_sanctuary`
- `collapsed_elder_council_hall`

`js/11-world-map.js` 同時新增聖地 navigation／NPC／進入規則，並大量調整地圖與 sprite 顯示流程。

### 4.4 Drop

`MOB_DROPS` owner：433 → 441，新增 8、移除 0、既有 31 個 owner 改動。

新增 owner：

- 受詛咒的黑暗妖精鬥士
- 受詛咒的黑暗妖精法師
- 受詛咒的黑暗妖精騎士
- 食腐獸
- 特提斯
- 翼龍
- 吉爾塔斯
- 真‧死亡騎士 冥皇丹特斯

31 個既有 owner 的掉落內容也有差異；`js/05-kill-progression.js` 已修改，因此除 base drop table 外，runtime drop／進度條件也必須重新追蹤，不能只比較顯示列表。

### 4.5 Card

`js/15-cards.js` 本身未修改，但 `CARD_MOB_INFO` 由更新後 Monster 資料求值時有 7 筆結果改變：法利昂、飛龍、黑長者、安塔瑞斯、巴拉卡斯、長老．琪娜、長老．巴洛斯。

這是跨來源 derived impact，歸入「其他／Card」，不能因 `js/15-cards.js` 未變就判定 Card 無影響。

## 5. Domain 分類

| Domain | 狀態 | 主要來源／理由 |
|---|---|---|
| Monster | changed | `js/00-data.js`、`js/01-drops-config.js`、`js/03-07`、`js/11-world-map.js`、Monster assets；新增 9 ID、既有 9 筆改動 |
| Equipment | changed | `js/00-data.js`、`js/02-04`、`js/06`、`js/08-items-equip.js`、`js/10-ui-tabs.js`、`js/19-equipment-window.js`；新增裝備及新 mechanics |
| Map | changed | `DB.maps`、`js/11-world-map.js`、area/background assets；新增 3 Map ID |
| Drop | changed | `js/01-drops-config.js`、`js/05-kill-progression.js`；新增 8 owner、31 owner 改動 |
| Item | changed | `DB.items` 新增材料／任務道具／裝備共 49，既有 5 筆改動 |
| Craft | changed | `js/14-craft-pandora.js` 修改，且新增聖地材料／裝備會影響 recipe parity；現有 Wiki Craft generator 不以 upstream `js/14` 為輸入 |
| System | changed | stats、combat、status、skills cast、save、audio、pets、summons、UI 與版本常數均有修改 |
| 其他 | changed | Card derived result、NPC sprites、動畫、BGM/SFX、CSS／首頁與 Equipment UI assets |

## 6. Generator 影響

### 6.1 必須在 Stage U2 受控重跑

| Generator | 原因 | 前置條件 |
|---|---|---|
| `generate_source_manifest.py` | source SHA、GameVersion、檔案 hash 與 input scope 全部變更 | 先把正式 source file scope 從兩檔候選擴充至所有實際 generator inputs |
| `generate_monster_data.py` | 四個輸入中 `js/00-data.js`、`js/01-drops-config.js`、`js/11-world-map.js` 已變更 | 先更新 baseline counts／mapping expectations，並確認 runtime drop semantics |
| `generate_legacy_entity_mappings.py` | `DB.mobs`、`MOB_DROPS`、Map labels 與 Item identity 已變更 | 先接受新增 ID、owner、Map 與 derived Card 影響 |
| `generate_equipment_data.py` | `js/00-data.js` 與 `js/10-ui-tabs.js` 都已變更 | 必須先更新 Equipment allowlist、classification mapping、source fixture 與新 mechanic policy |
| `generate_equipment_view_payload.py` | canonical Equipment Dataset 更新後，index／detail shards 必須重新投影 | 只能在 Equipment canonical Dataset 驗證通過後執行 |

### 6.2 不應立即重跑

- `generate_craft_data.py` 的直接輸入仍是本專案 `wiki.html`，不是 upstream `js/14-craft-pandora.js`。本次 upstream 改動不會自動進入 Craft JSON；應先做遊戲 Craft 與 Wiki Craft parity audit，再決定是否更新 Wiki-local source。未完成前直接重跑只會重現舊 Wiki 資料。

## 7. Schema 影響

| Schema | 判定 | 原因 |
|---|---|---|
| `equipment.schema.json` | review required，可能需 minor contract update | avatar 限制、屬性公式與多種 proc／interaction 欄位超出 v1 的 baseStats／classRequirements 表達能力 |
| `equipment-unresolved.schema.json` | revalidate | 新 mechanic／requirement 會增加 unresolved diagnostic 類型或數量 |
| `equipment-view-index.schema.json` | 先 revalidate，未見必然結構變更 | 若只投影既有 summary 可不升版；若新增玩家可見 mechanic summary 才需調整 |
| `monster.schema.json` | revalidate；目前未證明需升版 | 新 ID 與數值可落在既有最小欄位，但 Boss／技能／特殊規則仍可能落入 unresolved |
| `map.schema.json` | revalidate；目前未證明需升版 | 三個新 Map 可用既有 shape，navigation／進入條件仍未由 Map v1 表達 |
| `drop-table.schema.json`、`drop-entry.schema.json` | review required | base drop 可沿用；聖地條件、Boss state、runtime modifier 必須確認是否超出目前空 runtimeModifiers／conditions 假設 |
| `legacy-entity-mapping.schema.json` | revalidate，預期不需結構變更 | mapping records 增量，非契約形狀改變 |
| `release-source-manifest.schema.json` | revalidate，預期不需結構變更 | 新 SHA／版本／檔案集合是資料變更；file scope 需擴充 |
| Craft schemas | parity audit 後再判定 | upstream Craft 已變，但現有 generator 尚未以該來源為 owner |

不得因 source 數量改變就自動升 SchemaVersion；只有 payload shape／欄位語意改變時才升版。

## 8. Fixture 與固定基線影響

### 8.1 Equipment

下列 fixtures 必須在 Equipment generator 前重新稽核：

- `fixtures/equipment/equipment-allowlist.json`：目前固定 786，需決定新增 upstream equipment 的 scope；不可只按名稱自動加入。
- `fixtures/equipment/equipment-classification-mapping.json`：為納入的新 Equipment ID 建立以正式 ID 為鍵的分類 mapping。
- `fixtures/equipment/equipment-source-fixture.json`：GameVersion `v3.2.79` 與舊 source revision 已過期，需改成可驗證的 upstream full SHA／Wiki-local revision 分離模型。
- `fixtures/equipment/equipment-special-cases.json`：需加入 avatar-only、strict avatar、WIS scaling、conditional weapon mechanics 等候選案例。
- `fixtures/equipment/equipment-price-conflicts.json`：重新比對既有 5 筆及新裝備價格，但不得在沒有衝突時虛構紀錄。
- `fixtures/equipment/equipment-unresolved.example.json`：若新增 diagnostic 類型，更新 example；它不是 canonical data。

### 8.2 Monster／Map／Drop

目前沒有獨立的版本控制 `fixtures/monster/` 或 `fixtures/drop/`。實際固定基線藏在 validator／tests 的 counts 與 sample assertions，Stage U2 必須把下列預期更新或抽成正式 fixture：

- Monster count：460 → 469。
- Map count：214 → 217。
- DropTable owner count：433 → 441。
- DropEntry count：需由受控 dry-run 計算，本 Stage 不生成所以保持 unresolved。
- 新 Monster／Map／Drop owner 的 ID、外鍵與順序 fixtures。
- 31 個既有 Drop owner 的 semantic comparison fixture。
- Card derived-impact fixture：7 筆。

### 8.3 Legacy Mapping

- Mapping validator 的固定數量 assertions 必須更新。
- 新增 Monster、Map、Drop owner、Item 與 Card derived records 必須先產出 candidate diff，再人工確認 resolved／unresolved；不得用中文名稱建立正式關聯鍵。

### 8.4 Source Manifest

- `fixtures/releases/bootstrap-source-manifest.example.json`：更新候選 SHA／GameVersion／commit date 只可作 example，不得冒充正式 manifest。
- `fixtures/releases/bootstrap-source-files.txt`：目前只有 `index.html`、`js/00-data.js`，不足以覆蓋 Monster、Drop、Map、Equipment 與 runtime evidence。Stage U2 至少需審核 `js/00-data.js`、`js/01-drops-config.js`、`js/05-kill-progression.js`、`js/10-ui-tabs.js`、`js/11-world-map.js`、`js/14-craft-pandora.js`、`js/15-cards.js` 及 `index.html`；最終清單以實際 generator input inventory 為準。

## 9. Stage U2 前阻擋與建議

### Blocking

1. Equipment allowlist／classification 仍鎖定舊 786 筆，不能直接生成新版 Equipment Dataset。
2. Monster／Drop／Mapping validators 含舊固定數量，直接重跑預期會失敗或產生大幅 candidate diff。
3. 新 Equipment mechanics 與 avatar restriction 尚未決定放入 canonical 欄位、Mechanic／Interaction relation 或 unresolved。
4. Drop runtime semantics 需要連同 `js/05-kill-progression.js` 審核，不能只抽取 `MOB_DROPS`。
5. Craft upstream source與 Wiki-local `CRAFT_DATA` 的 owner／parity 尚未建立。
6. Source Manifest 的 bootstrap file scope 仍不完整。

### 建議

建議進入 **Stage U2：immutable source snapshot／manifest candidate、fixture delta 與 generator dry-run design**，但不要直接發布或覆寫正式 Dataset。U2 的順序應是：

1. 固定 `c3d4f96...` source snapshot 與完整 input manifest。
2. 產生只供審核的 raw／normalized candidate diff，不覆寫 checked-in Dataset。
3. 先更新／審核 fixtures 與 mapping，再處理 Schema gap。
4. 依序驗證 Monster／Map／Drop、Equipment、Legacy Mapping。
5. Craft 先做 parity audit，不能把 upstream `js/14` 直接併入 Wiki Craft。

本 Drill 不生成任何 Dataset，所有新 DropEntry 數量、Equipment 最終納入數量與 unresolved 數量保持未決。
