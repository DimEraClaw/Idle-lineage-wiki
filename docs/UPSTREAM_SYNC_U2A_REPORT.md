# Upstream Sync Stage U2-A Report

## 1. Scope and conclusion

本次只固定新版來源、產生 ignored candidate Source Manifest，並稽核 fixture、Schema、generator、validator 與 mapping 的差異。未生成或覆蓋任何正式 Dataset，未修改正式 fixture、Schema、UI 或程式。

結論：來源快照與 manifest 可以重現；但尚不應直接生成正式 candidate Dataset。Monster 端的「地獄奴隸」同名衝突會使現行 name-only drop owner 解析失去唯一性；Equipment 端尚需處理一個武器分類與數個 requirement／canonical stat 契約缺口。建議先進入 U2-B 做最小 fixture、Schema、generator 與 mapping 修訂，再執行 candidate generation。

## 2. Snapshot identity

| 欄位 | 固定值 |
|---|---|
| Repository | `https://github.com/shines871/idle-lineage-class` |
| Branch | `main` |
| Full SHA | `c3d4f96f13aefabf1453a4a3f1f54d688fd573f6` |
| Commit date | `2026-07-14T03:53:40+08:00` |
| GameVersion | `v3.4.17` |
| Retrieval method | `git_archive` |
| Snapshot path | `temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot/` |
| Candidate path | `temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/` |
| `retrievedAt` fixed input | `2026-07-14T06:51:33+08:00` |

驗證結果：

- archive 精確取自上述 full SHA，不以 GitHub Pages 作唯一來源。
- snapshot 共 117,026 個檔案；所選 15 個 manifest 檔案的 Git blob 全部與該 SHA 相符（15/15，mismatch 0）。
- `js/00-data.js#GAME_VERSION` 為 `v3.4.17`。
- 第一個 archive 嘗試因 Windows binary pipeline 造成 damaged archive，未被採用；保留在 ignored 臨時目錄，不作任何證據。上述 `-v2` 路徑才是有效 snapshot。

## 3. Candidate Source Manifest

### 3.1 File scope

| 路徑 | Domain／角色 |
|---|---|
| `index.html` | 入口載入順序與版本 Evidence |
| `js/00-data.js` | Monster、Map、Item、Equipment canonical owner；GameVersion |
| `js/01-drops-config.js` | base Drop owner／entry canonical owner；Equipment drop evidence |
| `js/02-stats-recompute.js` | Equipment derived stats/runtime Evidence |
| `js/03-combat-core.js` | Monster／Equipment combat mechanics Evidence |
| `js/04-combat-attack.js` | Equipment proc／attack mechanics Evidence |
| `js/05-kill-progression.js` | runtime modified drop／kill flow Evidence |
| `js/06-status-allies.js` | Equipment status／ally interactions Evidence |
| `js/07-skills-cast.js` | Equipment skill/proc interaction Evidence |
| `js/08-items-equip.js` | Equipment equip restrictions與 runtime behavior Evidence |
| `js/10-ui-tabs.js` | `WEAPON_TAGS` classification owner；display Evidence |
| `js/11-world-map.js` | Map label、navigation、spawn/runtime Evidence |
| `js/14-craft-pandora.js` | Craft parity Evidence，不是目前 Monster／Equipment generator owner |
| `js/15-cards.js` | Card identity與 Monster-derived Card Evidence |
| `js/19-equipment-window.js` | Equipment interaction/display Evidence |

未納入 `js/09-vfx-render.js`、`js/13-shop-save.js`、`js/17-audio.js`、`js/22-pets.js`、`js/23-summons.js`：它們不是目前 Monster／Equipment canonical owner，也不是既有 generator 的必要輸入。若未來契約把 VFX、save state、audio、pet 或 summon 納入正式 Mechanics／Interaction Dataset，應另行擴大 scope，不應先放進 minimal manifest。

### 3.2 Validation and determinism

- 使用既有 `tools/generate_source_manifest.py` 以相同固定輸入生成兩次。
- 使用既有 `tools/validate_source_manifest.py` 並提供完整 required input list 驗證。
- Validator：passed；blocking diagnostics：0。
- 兩次輸出 byte-identical。
- 兩份 manifest SHA-256 均為 `4b4fa3f587518491f1f6740567d881a4e4a3a6de1cd947413926b55ddc4ccd08`。
- candidate manifest 只存在 ignored candidate 目錄，未覆蓋 bootstrap example。

### 3.3 Source Manifest fixture delta

目前 `bootstrap-source-files.txt` 只有 `index.html` 與 `js/00-data.js`，明確標示為 candidate bootstrap scope，無法代表 Monster／Equipment 的完整可重現來源。U2-B 應：

1. 將上述 15 檔定義為新版完整 candidate scope，或新增具版本的正式 source inventory fixture；不要把 runtime Evidence 誤稱 canonical owner。
2. 更新 example manifest 的範例 SHA、GameVersion、commit date、固定 retrievedAt 與 file hashes，但保留 `example` 身分，不把它當作已發布 Release。
3. 將 `js/00-data.js`、`js/01-drops-config.js`、`js/10-ui-tabs.js`、`js/11-world-map.js` 分別標明 canonical／classification owner；其餘程式檔標明 runtime Evidence。

## 4. Equipment fixture delta

### 4.1 Counts

`DB.items` 從 2,568 增為 2,617，共新增 49 個 ID：

| Candidate group | 數量 |
|---|---:|
| A. 可穿戴 Equipment candidate | 39 |
| B. SkillBook | 0 |
| C. Doll | 0 |
| D. 獨立 Set／remains Entity | 0 |
| E. Material／Quest／Other Item | 10 |
| F. 無法判定 | 0 |

五件 `set: "emperor"` 物品本身是可穿戴 Equipment；此處的 D 指獨立 Set／remains Entity，因此不重複計數。`ear_cursed_black` 雖然顯示名稱含「耳環」，raw `type` 是 `etc` 且沒有 slot，不得用中文名稱推定成 Accessory。

### 4.2 Complete 49-item candidate list

表中 `—` 代表來源未提供。所有 evidence 的 canonical item source 均為 `js/00-data.js#DB.items.<itemId>`；武器細分類若註明 tags，另使用 `js/10-ui-tabs.js#WEAPON_TAGS`。分類不使用中文名稱 regex。

| itemId | displayName | type / slot | req | safe / enhance | subtype與 relevant flags | group | candidate type / slot | method | status／unresolved |
|---|---|---|---|---|---|---|---|---|---|
| `amr_emperor` | 真．冥皇鎧甲 | arm / armor | royal,knight,dark,dragon,warrior | 0 / normal | legend,set | A | armor / armor | raw type+slot | resolved candidate |
| `amu_doom` | 厄運項鍊 | acc / amulet | all | 0 / normal | hitstunReduce,mpR | A | accessory / necklace | raw type+slot | resolved candidate |
| `amu_pain` | 苦痛項鍊 | acc / amulet | all | 0 / normal | hpR,stunResist | A | accessory / necklace | raw type+slot | resolved candidate |
| `bot_emperor` | 真．冥皇鋼靴 | arm / boots | royal,knight,dark,dragon,warrior | 0 / normal | legend,set | A | armor / boots | raw type+slot | resolved candidate |
| `clk_emperor` | 真．冥皇披風 | arm / cloak | royal,knight,dark,dragon,warrior | 0 / normal | legend,set | A | armor / cloak | raw type+slot | resolved candidate |
| `ear_cursed_black` | 受詛咒的黑色耳環 | etc / — | — | — | — | E | — | raw type; no name inference | excluded: non-equipment item |
| `ear_soul_fighter` | 靈魂耳環(鬥士) | acc / ear | dark,warrior | 0 / normal | meleeDmg,mhp,mmp | A | accessory / earring | raw type+slot | resolved candidate |
| `ear_soul_knight` | 靈魂耳環(騎士) | acc / ear | royal,knight,dragon | 0 / normal | hpR,meleeHit,mhp | A | accessory / earring | raw type+slot | resolved candidate |
| `ear_soul_mage` | 靈魂耳環(法師) | acc / ear | mage,illusion,elf | 0 / normal | mdmg,mmp,mpR | A | accessory / earring | raw type+slot | resolved candidate |
| `glv_emperor` | 真．冥皇護手 | arm / gloves | royal,knight,dark,dragon,warrior | 0 / normal | legend,set | A | armor / gloves | raw type+slot | resolved candidate |
| `hlm_emperor` | 真．冥皇面甲 | arm / helm | royal,knight,dark,dragon,warrior | 0 / normal | legend,set | A | armor / helmet | raw type+slot mapping | resolved candidate |
| `item_dk_book` | 死亡騎士之書 | etc / — | — | — | noUse,noSell | E | — | raw type/flags | excluded: quest/access item |
| `item_giltas_seal` | 吉爾塔斯的封印 | etc / — | — | — | noUse,noSell | E | — | raw type/flags | excluded: quest/access item |
| `item_summonorb_full` | 完整的召喚球 | etc / — | — | — | noUse,noSell | E | — | raw type/flags | excluded: other item |
| `mat_ascetic_classic` | 修行者經典 | etc / — | — | — | — | E | — | raw type+ID source | excluded: material |
| `mat_de_soul_crystal` | 黑暗妖精的靈魂水晶 | etc / — | — | — | — | E | — | raw type+ID source | excluded: material |
| `mat_emperor_manual` | 真．冥皇製作防具秘笈 | etc / — | — | — | noSell | E | — | raw type+flags | excluded: material/recipe item |
| `mat_purify_potion` | 淨化藥水 | etc / — | — | — | — | E | — | raw type+ID source | excluded: material |
| `mat_summonorb_core` | 召喚球之核 | etc / — | — | — | — | E | — | raw type+ID source | excluded: material |
| `mat_summonorb_shard` | 召喚球碎片 | etc / — | — | — | — | E | — | raw type+ID source | excluded: material |
| `relic_corpse_needle` | 屍毒之針 | wpn / — | knight,elf,dark,illusion | — / noEnhance | isBow,oneHand,ranged,procStatusSkill | A | weapon / bow | explicit flags | resolved candidate; mechanic diagnostic |
| `relic_croc_leather` | 巨大鱷魚的皮革盔甲 | arm / armor | elf,dark,dragon,illusion | — / noEnhance | dr,mhp,weightCap,relic | A | armor / armor | raw type+slot | resolved candidate |
| `relic_earth_barrier` | 地元素屏障 | arm / shield | royal,knight,elf,mage,illusion | — / noEnhance | mr,resEarth,relic | A | armor / shield | raw type+slot | resolved candidate |
| `relic_earthking_resist` | 地精靈王的抗拒 | wpn / — | elf,illusion | — / noEnhance | isBow,w2h,ranged,hurtRapidfire | A | weapon / bow | explicit flags | resolved candidate; mechanic diagnostic |
| `relic_fire_barrier` | 火元素屏障 | arm / shield | royal,knight,elf,mage,illusion | — / noEnhance | mr,resFire,str,relic | A | armor / shield | raw type+slot | resolved candidate |
| `relic_fireking_blast` | 火精靈王的爆焰 | wpn / — | royal,knight,dragon | — / noEnhance | w2h,hitEchoMagic,eff,ele | A | weapon / two_hand_sword | ID-based WEAPON_TAGS | resolved candidate; mechanic diagnostic |
| `relic_general_swordguard` | 將軍愛用的握劍護腕 | arm / gloves | all | — / noEnhance | swordStr,relic | A | armor / gloves | raw type+slot | resolved candidate; mechanic diagnostic |
| `relic_ghoul_fang` | 兇殘惡鬼的毒牙 | wpn / — | royal,knight,elf,mage,dark,dragon | — / noEnhance | eleBonusDmg,relic | A | weapon / one_hand_sword | ID-based WEAPON_TAGS | resolved candidate |
| `relic_kasta_hump` | 妖鬼王的畸形背瘤 | arm / cloak | all | — / noEnhance | hpR,relic | A | armor / cloak | raw type+slot | resolved candidate |
| `relic_lava_fists` | 熔岩灼燒的雙拳 | wpn / — | warrior | — / noEnhance | procBurn,unBonus,ignHardSkin | A | weapon / blunt | ID-based WEAPON_TAGS | resolved candidate |
| `relic_magic_resist_shirt` | 魔力阻抗襯衫 | arm / tshirt | all | — / noEnhance | mrPerWis,relic | A | armor / tshirt | raw type+slot | resolved candidate; formula gap |
| `relic_morph_blade` | 不定形的變幻劍 | wpn / — | dragon | — / noEnhance | chainsword,w2h,counterAllEle | A | weapon / chain_sword | explicit flag | resolved candidate; mechanic diagnostic |
| `relic_orin_ring` | 與歐林的定情之戒 | acc / ring | all | — / noEnhance | mdmg,extraMp,mpR,mmp | A | accessory / ring | raw type+slot | resolved candidate |
| `relic_pirate_dual` | 傳說海賊的迷幻雙刀 | wpn / — | dark | — / noEnhance | comboRate,w2h,eff,ele | A | weapon / dual_blade | ID-based WEAPON_TAGS | resolved candidate |
| `relic_pure_maiden_love` | 純潔少女的憐愛 | acc / amulet | elf | — / noEnhance | reqAvatar,strictAvatar,dex,int,mpR | A | accessory / necklace | raw type+slot | resolved identity; requirement gap |
| `relic_rockmage_secret` | 破岩法師的秘術 | wpn / — | mage,illusion | — / noEnhance | isWand,procSkill,procRateBase/PerEn | A | weapon / staff | explicit flag | resolved candidate; mechanic diagnostic |
| `relic_sparto_shard` | 殘暴骸骨的破片 | wpn / — | royal,knight,elf,mage,dark,dragon | — / noEnhance | unBonus,relic | A | weapon / one_hand_sword | ID-based WEAPON_TAGS | resolved candidate |
| `relic_tamer_feedbag` | 馴獸師的飼料袋 | acc / ring | all | — / noEnhance | allLures,relic | A | accessory / ring | raw type+slot | resolved candidate; interaction diagnostic |
| `relic_water_barrier` | 水元素屏障 | arm / shield | royal,knight,elf,mage,illusion | — / noEnhance | mr,resWater,con,relic | A | armor / shield | raw type+slot | resolved candidate |
| `relic_waterking_caress` | 水精靈王的撫摸 | wpn / — | dark | — / noEnhance | comboRate,missGrazeRate,eff,ele | A | weapon / claw | ID-based WEAPON_TAGS | resolved candidate; mechanic diagnostic |
| `relic_wind_barrier` | 風元素屏障 | arm / shield | royal,knight,elf,mage,illusion | — / noEnhance | mr,resWind,dex,relic | A | armor / shield | raw type+slot | resolved candidate |
| `relic_windking_roar` | 風精靈王的狂嘯 | wpn / — | mage | — / noEnhance | isWand,windSpellProcRate | A | weapon / staff | explicit flag | resolved candidate; mechanic diagnostic |
| `rng_sage` | 賢者之戒 | acc / ring | all | 0 / normal | int,wis,mhp | A | accessory / ring | raw type+slot | resolved candidate |
| `shd_official` | 武官之盾 | arm / shield | knight,dragon | 6 / normal | hpR,mhp | A | armor / shield | raw type+slot | resolved candidate |
| `shd_rebel` | 反叛者的盾牌 | arm / shield | royal,knight | 4 / normal | dmgReduceProc,hitstunReduce,legend | A | armor / shield | raw type+slot | resolved candidate |
| `wpn_cursed_emperor_blade` | 受詛咒的真．冥皇執行劍 | wpn / — | royal,knight,elf,mage,dark | 6 / normal | legend,hpR,ignHardSkin | A | weapon / one_hand_sword | ID-based WEAPON_TAGS | resolved candidate |
| `wpn_giltas_sword` | 吉爾塔斯之劍 | wpn / — | knight,dragon | 0 / normal | w2h,legend,eff,ignHardSkin | A | weapon / two_hand_sword | explicit w2h + source semantics | resolved candidate |
| `wpn_giltas_wand` | 吉爾塔斯魔杖 | wpn / — | mage,illusion | 0 / normal | w2h,legend,eff,int,wis,mpR | A | weapon / unresolved | raw type proves Equipment; no `isWand` or ID tag | unresolved classification |
| `wpn_rotten_longbow` | 腐壞的長弓 | wpn / — | elf,illusion | 6 / normal | isBow,w2h,ranged,rapidfire | A | weapon / bow | explicit flags | resolved candidate |

`maxEn` 與 `subtype` 在 49 個新增項目皆未提供。

### 4.3 Allowlist and classification recommendations

建議加入 Equipment allowlist 的 39 個 ID，即上表所有 A 組。為避免把「Equipment identity」與「已完整分類」混為一談：

- 38 個可同時加入 resolved classification fixture。
- `wpn_giltas_wand` 可加入 allowlist，但 classification 必須保持 unresolved，直到以 ID-based mapping 確認其 `equipmentType`；不得因中文名稱含「魔杖」而自動分類。
- 10 個 E 組 ID 不應加入 Equipment Dataset：`ear_cursed_black`、`item_dk_book`、`item_giltas_seal`、`item_summonorb_full`、`mat_ascetic_classic`、`mat_de_soul_crystal`、`mat_emperor_manual`、`mat_purify_potion`、`mat_summonorb_core`、`mat_summonorb_shard`。
- 新版 expected Equipment identity baseline 為 825（786 + 39）；這只是候選 baseline，不得在 U2-A 更新 validator。

## 5. Equipment mechanic and requirement gaps

| 欄位 | Equipment ID | 分類 | Schema／diagnostic | View impact | 是否阻擋 | 最小契約處理 |
|---|---|---|---|---|---|---|
| `reqAvatar` | 既有 `hlm_icequeen_charm`,`amr_icequeen_charm`,`bot_icequeen_charm`；新增 `relic_pure_maiden_love` | canonical requirement parameter | 現行 `classRequirements` 無法表達；需 Schema/contract 欄位 | Detail 應顯示；index 不必 | 阻擋完整 fidelity；可允許 partial candidate | 新增結構化 avatar requirement，不把顯示文字當 ID |
| `strictAvatar` | `relic_pure_maiden_love` | requirement modifier | 與 `reqAvatar` 同一 requirement 契約 | Detail | 同上 | 作為 avatar requirement 的明確 boolean，不轉成自由文字 |
| `mrPerWis` | `relic_magic_resist_shirt` | formula parameter | 不應塞入 baseStats；未有正式 Mechanic ID 時先 diagnostic | Detail；index 不必 | 不阻擋 identity，阻擋完整 mechanics | 保留 raw evidence與 unresolved MechanicRef candidate |
| `allLures` | `relic_tamer_feedbag` | mechanic／interaction | diagnostic／MechanicRef 即可，暫不擴 base schema | Detail | non-blocking partial | 連結未來 capture/lure mechanic；不得自造 ID |
| `procStatusSkill` | 新增 `relic_corpse_needle`；來源中另有 21 個既有 item | mechanic，含 Skill/Status relation | 既有 diagnostic pattern 可承接 | Detail | non-blocking partial | 保留 raw `{skill/status, rate}` evidence，待正式 Skill/Status ID review |
| `counterAllEle` | `relic_morph_blade` | mechanic | diagnostic／MechanicRef | Detail | non-blocking partial | 保留 raw boolean evidence，待公式契約 |
| `hitEchoMagic` | `relic_fireking_blast` | trigger mechanic／formula | diagnostic／MechanicRef | Detail | non-blocking partial | 記錄觸發點與來源位置，不把描述推成公式 |
| `missGrazeRate` | `relic_waterking_caress` | formula parameter／mechanic | diagnostic／MechanicRef | Detail | non-blocking partial | 保留數值與 runtime evidence，待命中公式契約 |
| `hurtRapidfire` | `relic_earthking_resist` | reactive mechanic | diagnostic／MechanicRef | Detail | non-blocking partial | 保留 raw evidence，待 combat interaction 契約 |
| `swordStr` | `relic_general_swordguard` | conditional formula parameter | diagnostic／MechanicRef | Detail | non-blocking partial | 條件依正式 weapon type；不得由名稱推斷 |
| `magicDrNonEle` → `resNone` | `relic_azt_mirror`,`arm_106`,`shd_redknight` | canonical non-elemental resistance scalar | `baseStats` 尚無 `resNone`，需 Schema／generator migration | Detail；index 可不顯示 | 阻擋完整 canonical fidelity | 將 `resNone` 加入 canonical base stats，保留 source-revision migration evidence |

補充：U2-B 應同步檢查 generator 的 `MECHANIC_SIGNAL_FIELDS`，否則 `allLures`、`counterAllEle`、`hitEchoMagic`、`missGrazeRate`、`hurtRapidfire`、`swordStr` 等新 signal 可能被漏掉。未有足夠證據前，不建立正式 Mechanic ID。

## 6. Monster, Map and Drop fixture delta

### 6.1 New Monster candidates

來源：`js/00-data.js#DB.mobs`、`DB.maps` 與 `js/01-drops-config.js#MOB_DROPS`。

| monsterId | displayName | type | boss | map relation | drop owner relation | expected mapping／unresolved |
|---|---|---|---:|---|---|---|
| `sanct_hellslave` | 地獄奴隸 | Monster | false | `dark_elf_sanctuary` | name-only `地獄奴隸` | conflict：與 `de_train_hellslave` 同名，owner 不可唯一解析 |
| `sanct_cursed_fighter` | 受詛咒的黑暗妖精鬥士 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_cursed_mage` | 受詛咒的黑暗妖精法師 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_cursed_knight` | 受詛咒的黑暗妖精騎士 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_scavenger` | 食腐獸 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_tethys` | 特提斯 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_wyvern` | 翼龍 | Monster | false | `dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_giltas` | 吉爾塔斯 | Monster | true | `cursed_dark_elf_sanctuary` | unique exact name | resolved candidate by existing target ID |
| `sanct_dantes` | 真‧死亡騎士 冥皇丹特斯 | Monster | true | `collapsed_elder_council_hall` | unique exact name | resolved candidate by existing target ID |

`dark_elf_sanctuary` 另包含既有 `de_necro_omheavy`。新版本 Monster expected baseline：469；Boss expected baseline：72。

### 6.2 New Map candidates

| mapId | displayName | source | relation state | unresolved |
|---|---|---|---|---|
| `dark_elf_sanctuary` | 黑暗妖精聖地 | `DB.maps` + `SANCTUARY_MAP_NAMES` | new Monsters + existing `de_necro_omheavy` | 未列於 `MAP_REGIONS`，現行 generator 取不到 label |
| `cursed_dark_elf_sanctuary` | 受詛咒的黑暗妖精聖地 | `DB.maps` + `SANCTUARY_MAP_NAMES` | `sanct_giltas` | 同上 |
| `collapsed_elder_council_hall` | 崩壞的長老會議廳 | `DB.maps` + `SANCTUARY_MAP_NAMES` | `sanct_dantes` | 同上 |

Map ID 是穩定 `DB.maps` key；`SANCTUARY_MAP_NAMES` 是 label evidence，不應把中文 label 當正式 identity。expected Map baseline：217。

### 6.3 Drop candidates

新增 8 個 owner 名稱：`受詛咒的黑暗妖精鬥士`、`受詛咒的黑暗妖精法師`、`受詛咒的黑暗妖精騎士`、`食腐獸`、`特提斯`、`翼龍`、`吉爾塔斯`、`真‧死亡騎士 冥皇丹特斯`。這 8 個名稱在新版 Monster 集合中各有唯一 target ID，可列 resolved mapping candidate。

`地獄奴隸` owner 本來已存在，所以 owner 數只增加 8；但新版新增同名 Monster 後，它從唯一 match 變為 conflict。expected raw baselines：

| 指標 | 現行 | 新版 expected | delta |
|---|---:|---:|---:|
| Monster | 460 | 469 | +9 |
| Boss | 70 | 72 | +2 |
| Map | 214 | 217 | +3 |
| DropTable／owner | 433 | 441 | +8 |
| raw DropEntry | 3,655 | 3,812 | +157 |
| Card | 409 | 409 | 0 |

這些只是 audit expected baseline；U2-A 未修改 validator counts。

### 6.4 Existing changed records

9 個既有 Monster changed fields：

- `kari`: `dmg`,`db`,`mag`,`mag2`
- `wyvern`: `dmg`,`db`,`mag`
- `blackelder`: `dmg`,`db`,`mag`,`mag2`
- `antaras`,`fafurion`,`valakas`: `dmg`,`db`,`mag`,`mag2`,`mag3`
- `lindvior`: `dmg`,`db`,`mag2`,`mag3`
- `de_elder_kina`: `mag`
- `de_elder_balos`: `db`,`mag2`

31 個既有 Drop owner 都是新增 entry、沒有移除 entry：

- `德雷克`、`黑暗妖精將軍`、`拉斯塔巴德馴獸師`、`地獄奴隸`
- 地／水／火／風四元素守護者
- 八位長老
- 夢幻之島地／水／火／風精靈王
- `巴土瑟`、`熔岩高崙`、`獨角獸`、`紅鬼魂`、`西瑪`
- `殘暴食屍鬼`、`殘暴史巴托`、`受詛咒妖魔殭屍`、`遺忘島變形怪`、`巨大鱷魚`、`妖鬼王卡士達`

其中 `地獄奴隸` 新增 `shd_official`、`blt_dark`、`mat_holy_relic`、`mat_summonorb_core`、`mat_summonorb_shard`，但 owner target 現在 ambiguous，不能直接歸到任一 Monster ID。

7 個 Card derived impact：`法利昂`、`飛龍`、`黑長者`、`安塔瑞斯`、`巴拉卡斯`、`長老．琪娜`、`長老．巴洛斯`。`js/15-cards.js` 的 Card key/count 未改；差異來自 `CARD_MOB_INFO` 讀入 changed Monster data，因此屬 derived refresh，不是新 Card identity。

## 7. Legacy mapping delta

| Candidate class | Delta |
|---|---|
| resolved candidate | 8 個唯一新 Monster name→ID；8 個唯一新 Drop owner→Monster ID；3 個 Map label 只有在 generator 明確採用 `SANCTUARY_MAP_NAMES` 後才能列 resolved |
| compatibility_only candidate | 既有 Card keys 維持 compatibility-only；7 筆只更新 derived Monster evidence，不改 Card identity |
| unresolved candidate | `wpn_giltas_wand` equipmentType；3 個目前 extractor 無法取得的 Map label；未建立正式 ID 的 mechanics；既有 unresolved Card/location/item candidates維持 unresolved |
| missing_target candidate | 本次未確認新增 missing target；現有 18 個 unresolved wiki item candidate 與 49 個新 displayName exact match 為 0 |
| conflict candidate | `地獄奴隸` 同時對應 `de_train_hellslave` 與 `sanct_hellslave` |

`地獄奴隸` 目前在正式 mapping 中已有 5 類 resolved record：`craft_monster_to_monster_id`、`drop_owner_to_monster_id`、`legacy_card_key_to_monster_id`、`monster_name_to_id`、`wiki_monster_to_monster_id`，都指向 `de_train_hellslave`。新版不能沿用 exact name 的唯一性假設；這 5 類都需 mapping review，相關 Card candidate note 也不得再默認單一 target。

新版 469 Monster ID 只有 468 個 unique displayName。若其餘來源維持唯一，候選 expected 分布是：

- `monster_name_to_id`: 467 resolved + 1 ambiguous name record。
- `drop_owner_to_monster_id`: 440 resolved + 1 ambiguous owner record。
- exact name 只能記為 match method；正式 target identity 仍是來源既有 Monster ID。

新 Item ID 不會自動產生 legacy item mapping；mapping 應由實際 legacy source key 與 canonical target evidence 驅動。新 Map 有穩定 ID，但未進 `MAP_REGIONS`，需先修正 label source inventory。

## 8. Gap and blocking classification

| 問題 | 分類 | Monster candidate | Equipment candidate | UI candidate test | 判定 |
|---|---|---|---|---|---|
| 39 個新 Equipment identity 未進 allowlist | fixture_update_required | — | blocking | blocking | U2-B 必須處理 |
| 38 resolved + 1 unresolved equipment classification | fixture_update_required, mapping_review_required | — | blocking full set | blocking | `wpn_giltas_wand` 不可用名稱猜測 |
| `reqAvatar`／`strictAvatar` | schema_update_required | — | blocking complete fidelity | blocking relevant detail | 可允許 partial candidate但須明示 unresolved |
| `resNone` migration | schema_update_required, generator_update_required | — | blocking complete fidelity | blocking relevant detail | canonical base stat 不應遺失 |
| 新 mechanic signal fields | mechanic_review_required, generator_update_required | — | non-blocking partial | non-blocking if diagnostics shown | 不建立無證據 Mechanic ID |
| `地獄奴隸` 同名兩 ID | mapping_review_required, generator_update_required | blocking | — | blocking Monster/drop test | 第一個 Monster 失敗點 |
| 3 Map labels只在 `SANCTUARY_MAP_NAMES` | generator_update_required, fixture_update_required | blocking complete Map label | — | blocking relevant detail | ID 已穩定，label extractor需擴充 |
| Monster/Map/Drop 新 counts | validator_baseline_update_required | blocking validator after generator fix | — | indirect | 只在 candidate output核對後更新 |
| 8 unique new drop owner mappings | fixture_update_required, mapping_review_required | blocking complete Drop refs | — | blocking drop detail | target ID 可唯一驗證 |
| 7 Card derived changes | no_change_required / fixture refresh if asserted | non-blocking | — | non-blocking | identity不變 |
| 15-file manifest scope | source_manifest_update_required | blocking reproducibility | blocking reproducibility | non-blocking runtime | U2-B 建立正式 input inventory |
| upstream `js/14-craft-pandora.js` 與 Wiki Craft owner差異 | craft_parity_required | non-blocking current Monster | non-blocking current Equipment | non-blocking current UI | 另立 parity audit，不在此階段混入 |
| 10 non-equipment Items | no_change_required | — | non-blocking | non-blocking | 明確排除 Equipment Dataset |
| 既有 unresolved candidates | non_blocking_unresolved | non-blocking unless target被引用 | non-blocking | non-blocking | 保持 unresolved |

## 9. Stage U2-B minimum formal change scope

U2-B 應保持小步驟，先修訂輸入與契約，再生成 ignored candidate；建議最小正式範圍如下：

1. Source inventory fixtures：
   - `fixtures/releases/bootstrap-source-files.txt`
   - `fixtures/releases/bootstrap-source-manifest.example.json`
2. Equipment fixtures／contract implementation：
   - `fixtures/equipment/equipment-allowlist.json`
   - `fixtures/equipment/equipment-classification-mapping.json`
   - `fixtures/equipment/equipment-source-fixture.json`
   - `fixtures/equipment/equipment-special-cases.json`（只放已核准的 requirement/mechanic policy）
   - `schemas/equipment.schema.json`（`reqAvatar`/`strictAvatar` structured requirement 與 `resNone`）
   - `tools/generate_equipment_data.py`
   - 對應 Equipment validator/tests 的 expected assertions
3. Monster／Map／Drop extraction與 mapping：
   - `tools/generate_monster_data.py`（`SANCTUARY_MAP_NAMES` 與 ambiguous owner handling）
   - `tools/generate_legacy_entity_mappings.py`
   - legacy mapping fixture/source inventory與對應 validator/tests
   - Monster validator/tests 的 candidate baseline assertions；只有 candidate 驗證通過後才更新正式 baseline
4. 文件：新增 U2-B report，記錄 approved fixture delta、candidate paths、unresolved 與 byte-stability。

U2-B 仍不應直接覆蓋 `data/equipment/`、`data/monster/` 或正式 mapping JSON。先把 generator output 放 ignored candidate 目錄，完成 semantic diff、Schema、foreign key、determinism 與 byte-stability 驗證後，才另開發布階段。

## 10. Readiness

- Snapshot：ready and immutable。
- Candidate Source Manifest：ready, valid and deterministic。
- Fixture／contract update：not yet applied。
- Monster candidate generation：目前 blocked（同名 owner + Map label extractor）。
- Equipment candidate generation：可做 identity-level dry run，但 complete Dataset blocked（classification + requirement/base stat contract）；不建議在 U2-B 修訂前開始正式 candidate generation。
- 建議：進入 Stage U2-B，且只做本報告列出的最小正式修訂與 ignored candidate generation；不要進入 Dataset publish 或 UI release。
