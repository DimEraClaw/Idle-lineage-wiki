# Equipment Stage E1：Equipment Dataset Audit

## 1. 稽核目的與邊界

本文件只回答「目前有哪些裝備資料可以利用」。本次以目前工作區內容進行唯讀盤點，沒有建立 Equipment Contract、Schema、Generator、Validator 或 JSON Dataset，也沒有修改 HTML、CSS、JavaScript、既有資料或 UI。

本次主要來源如下：

| 來源 | 可利用內容 | 定位與限制 |
|---|---|---|
| `js/00-data.js#GAME_VERSION` | `v3.2.79` | 遊戲程式目前宣告的版本；不等於未來 Dataset version |
| `js/00-data.js#DB.items` | item ID、名稱、原始 type、價格、職業、安全值、基礎能力、效果旗標、proc 設定、技能書 skill ID 等 | Equipment canonical source 的首要候選；部分欄位會在後續程式載入時被補值或改寫 |
| `js/00-data.js#DB.sets` 與 `initSetTags()` | 套裝成員與 runtime `.set` 標記 | 套裝關係不是只讀單一 item record 就能完整取得 |
| `wiki.html#EQUIP_DATA` | 目前 Wiki 的 1,019 筆裝備型顯示快照 | 混合 canonical projection、衍生分類、人工文案與 HTML relation；沒有來源 revision 或 generator |
| `js/10-ui-tabs.js` | `WEAPON_TAGS`、裝備 tooltip、武器分類、特效標籤、runtime 欄位補值 | `comboRate`、`ignHardSkin` 等可能在載入後才成為實際值 |
| `js/02-stats-recompute.js` | 裝備能力套用、強化成長、套裝效果、疊加與覆蓋規則 | 許多玩家實際能力是 runtime-derived，不是 item 靜態欄位 |
| `js/03-combat-core.js`、`js/04-combat-attack.js`、`js/06-status-allies.js`、`js/07-skills-cast.js` | proc、狀態、免疫、傷害、冷卻、Buff／Debuff 與模式條件 | 需要追蹤執行路徑才能轉成 Mechanic／Interaction |
| `js/08-items-equip.js` | 裝備實例、詞綴、強化、欄位限制、可裝備判斷 | `en`、`bless`、`anc`、`attr`、`seteff` 屬玩家裝備實例，不是 Equipment Entity 基底資料 |
| `js/14-craft-pandora.js` 與 Craft Dataset | 製作結果、材料關係、部分 runtime 權重變更 | 關係應以 ID 建立，不應複製成裝備自由文字 |
| `data/monster/drop_tables.json` | Base Drop 的 ItemRef 與機率 | 目前 673 個 `EQUIP_DATA` ID 可由 Monster Dataset 反向找到 Base Drop |
| `afk-wiki.js`、`afk-dex.js`、`js/16-equip-book.js`、`js/19-equipment-window.js` | 遊戲內裝備分類、顯示與收集邏輯 | 是顯示／行為證據，不是獨立 canonical Dataset |
| Legacy mapping 文件與 `data/mappings/` | item name 等舊來源的解析規則 | 目前沒有 Equipment 專用 ID mapping；名稱 mapping 不能取代正式 ID |

`equip_wiki.html` 是舊入口，不含另一份 `EQUIP_DATA`，不能視為獨立資料來源。

## 2. 數量與分類

### 2.1 `EQUIP_DATA` 總覽

`EQUIP_DATA` 共 **1,019 筆**。其中真正可穿戴、`category = equipment` 的裝備是 **786 筆**；其餘 233 筆是技能書、魔法娃娃及席琳遺骸部位，雖然沿用 `DB.items`，但不應全部算成 Equipment Entity。

| Wiki 分類 | 數量 | 原始 `DB.items.type` | 判讀 |
|---|---:|---|---|
| 武器 | 309 | `wpn` | 可穿戴 Equipment |
| 防具 | 339 | `arm` | 可穿戴 Equipment |
| 飾品 | 138 | `acc` | 可穿戴 Equipment |
| 技能書 | 175 | `skillbk` | 應由 Item／SkillBook 與 Skill relation 負責，不是可穿戴裝備 |
| 魔法娃娃 | 50 | `acc` | 應獨立為 Doll／Item specialization；不能因 raw type 為 `acc` 就算作飾品 |
| 席琳遺骸部位／set records | 8 | `acc` | `rem_claw` 等動態套裝材料／部位，不是一般飾品 |
| 消耗品 | 0 | — | `EQUIP_DATA` 沒有收錄 potion、scroll、一般 consumable |
| **合計** | **1,019** | `wpn` 309、`arm` 339、`acc` 196、`skillbk` 175 | 可穿戴 Equipment 合計 786 |

因此後續若稱「裝備總數」，必須同時標明統計口徑：

- Wiki 裝備型紀錄：1,019。
- 可穿戴 Equipment：786。
- `DB.items.type = acc`：196，但其中只有 138 筆是飾品。

### 2.2 細分類

`EQUIP_DATA.equipmentType` 的非空分類如下：

| 群組 | 類型與數量 |
|---|---|
| Weapon 309 | one_hand_sword 71、two_hand_sword 25、dagger 17、blunt 20、two_hand_blunt 18、spear 8、two_hand_spear 18、bow 20、crossbow 12、staff 31、claw 21、dual_blade 19、chain_sword 11、kiringku 11、other_weapon 7 |
| Armor 339 | armor 86、helmet 57、cloak 43、gloves 38、boots 36、tshirt 10、greaves 12、shield 57 |
| Accessory 138 | necklace 31、earring 39、belt 28、ring 40 |

### 2.3 Identity 完整度

- 1,019 個 `EQUIP_DATA.id` 全部唯一，沒有重複 ID。
- 1,019 個顯示名稱全部唯一，沒有同名不同 ID。
- 1,019 筆全部能以相同 ID 對回 `DB.items`。
- 反向檢查 `DB.items` 中 `wpn`、`arm`、`acc`、`skillbk` 的 1,019 筆，也全部存在於 `EQUIP_DATA`。
- 相同 ID 的名稱與 raw type 全部一致；沒有同 ID 不同名稱或不同 type。
- 175 本技能書在 `DB.items` 均有 `sk`，175 個 `sk` 均唯一且可對應目前 `DB.skills`；但 `EQUIP_DATA` 沒有輸出該 skill ID。

目前 `DB.items` key 可作為既有穩定 Item／Equipment ID 候選。這只代表現況 identity coverage 完整，不代表已完成未來 Item 與 Equipment Entity 責任切分。

## 3. `EQUIP_DATA` 原始結構與完整欄位

### 3.1 Top-level 欄位

每筆紀錄目前固定有 17 個 top-level 欄位：

```text
id
name
type
subtype
slot
slot_cn
price
weight
safe
req
desc
rarity
stats
sources
category
equipmentGroup
equipmentType
```

沒有 `aliases`、`entityRef`、`verification`、`version`、`dataStatus`、`mechanicRefs`、`skillRefs`、`setRefs` 或結構化 relations。

### 3.2 `stats` 欄位

`stats` 是由 `DB.items` 的選定 scalar 欄位投影而成，聯集共有 22 個欄位：

| 欄位 | 出現筆數 | 意義 |
|---|---:|---|
| `dmgS` | 309 | 對小型目標基礎傷害 |
| `dmgL` | 309 | 對大型目標基礎傷害 |
| `hit` | 307 | 武器命中 |
| `dmgBonus` | 211 | 武器額外傷害 |
| `ac` | 320 | 原始 AC 值；UI 另做符號顯示轉換 |
| `mr` | 45 | 魔法防禦 |
| `er` | 11 | 遠程迴避 |
| `dr` | 34 | 傷害減免 |
| `mhp` | 90 | 最大 HP |
| `mmp` | 61 | 最大 MP |
| `extraMp` | 18 | 額外魔法消耗／魔力相關原始欄位，實際語意須依程式路徑確認 |
| `mdmg` | 31 | 魔法傷害 |
| `str` | 50 | STR |
| `dex` | 42 | DEX |
| `con` | 27 | CON |
| `int` | 37 | INT |
| `wis` | 36 | WIS |
| `cha` | 23 | CHA |
| `resFire` | 22 | 火屬性抗性 |
| `resWater` | 23 | 水屬性抗性 |
| `resWind` | 15 | 風屬性抗性 |
| `resEarth` | 15 | 地屬性抗性 |

上述已輸出的 22 個值與目前 `DB.items` 同名欄位逐筆比對，沒有數值差異。但 `stats` 容器本身是 Wiki 的衍生投影，不是遊戲程式原始結構。

### 3.3 欄位分類與來源

| Wiki 欄位 | 分類 | 實際含義／來源 | 風險 |
|---|---|---|---|
| `id` | Canonical candidate | `DB.items` object key | 可直接沿用既有 ID；仍需在 E2 決定 Item 與 Equipment identity 邊界 |
| `name` | Canonical | `DB.items.n` | 目前 1,019 筆一致；只能顯示／搜尋，不能作外鍵 |
| `type` | Canonical | `DB.items.type` | 是舊 raw item type，不足以區分飾品、娃娃與遺骸 |
| `price` | Canonical candidate | 通常來自 `DB.items.p` | 有 5 筆 Wiki 值與遊戲端不同，不能直接相信 Wiki snapshot |
| `safe` | Mixed／Derived default | 598 筆在 `DB.items` 明定；其餘由 Wiki 補 0 等預設 | 「缺欄位」不必然等於安全值 0，生成規則尚未留存 |
| `req` | Mixed／Derived default | 840 筆在 `DB.items` 明定；179 筆由 Wiki 補值 | class code 是 legacy stable key，不是顯示名稱 |
| `desc` | Mixed | 可穿戴裝備部分直接取 `DB.items.d`；技能書另組技能說明 HTML | 內容混合 canonical prose、derived mechanics 與 markup |
| `stats` | Derived projection | 將 22 個 `DB.items` scalar 欄位搬入子物件 | 省略大量實際生效欄位，不能代表完整能力 |
| `slot` | Mixed | 535 筆在 `DB.items` 明定，其餘由類型／ID／規則推導 | 同一欄位混合 canonical 與 derived 值 |
| `subtype` | Derived／legacy classification | 武器舊分類碼，例如 `sword1h`、`axe`、`dual` | 710 筆空白，且與 `equipmentType` 存在兩套分類 vocabulary |
| `rarity` | Derived | 由 `legend`、`relic`、`skillbk` 等旗標歸類 | 不是遊戲端單一 canonical rarity 欄位 |
| `category` | Derived | equipment／skillbook／doll／set | 正確修正了 raw `acc` 混類，但規則未保存於 generator |
| `equipmentGroup` | Derived | weapon／armor／accessory | 只對 786 筆可穿戴裝備有值 |
| `equipmentType` | Derived | Wiki 部位／武器類型分類 | 部分依 `WEAPON_TAGS`、slot、flag 或 ID mapping，來源分散 |
| `slot_cn` | Editorial label | 中文部位顯示文字 | 只能顯示，不得作 relation key |
| `weight` | Editorial／unverified legacy value | `DB.items` 沒有對應 base field，現有生成來源不可追溯 | 不可先宣告 canonical；需 unresolved／Evidence |
| `sources` | Derived relation projection＋Editorial markup | 掉落、任務、購買、製作、兌換、拆分等文字與 HTML | 不是結構化關係；大量 owner 只用中文名稱 |

Canonical 表示值可直接追到遊戲資料；Derived 表示可由明確輸入與規則重建；Editorial 表示顯示文案或人工整理。Mixed 欄位不可在沒有逐筆 provenance 的情況下整欄指定唯一 owner。

## 4. 缺失與不完整資料

所有 1,019 筆都有上述 17 個 key；以下「缺失」是空字串、空陣列、空物件、來源不明或語意缺口，不是 JSON key 不存在。

| 缺失項目 | 數量 | 分布／說明 |
|---|---:|---|
| `desc` 空白 | 277 | 全部是可穿戴 equipment |
| `sources` 空陣列 | 212 | equipment 162、doll 50 |
| `subtype` 空白 | 710 | equipment 477、set 8、doll 50、skillbook 175 |
| `stats` 空物件 | 254 | equipment 58、set 8、doll 13、skillbook 175 |
| `equipmentGroup` 空白 | 233 | set 8、doll 50、skillbook 175；多數是 scope 不適用，不是單純漏值 |
| `equipmentType` 空白 | 233 | 同上 |
| aliases | 1,019 | 完全沒有歷史名稱或別名欄位 |
| structured effect／proc | 1,019 | Wiki 只有部分 description 文字，沒有完整結構化 effect |
| structured relation | 1,019 | 沒有 DropRef、CraftRef、SkillRef、SetRef、QuestRef、NPCRef |
| verification／version／status | 1,019 | 無法逐欄判斷版本、來源、Evidence 或 unresolved |

`sources` 共 2,625 個 occurrence：掉落 2,496、購買 59、任務 50、兌換 8、拆分 8、製作 4。全部 2,625 筆都含 HTML，2,496 筆掉落使用 `onclick="viewMobInGuide('中文怪物名')"`。因此它是 UI-ready HTML，不是可直接進 Dataset 的資料模型。

目前已有的跨資料覆蓋：

- Monster Drop Dataset：3,655 個 DropEntry 中，673 個唯一 `EQUIP_DATA` item ID 有 Base Drop relation。
- Craft Dataset：227 個唯一 recipe result ID、74 個 requirement ID 可對到 `EQUIP_DATA`。
- 這些應在未來以 EntityRef／Relation 使用，不應把現有 HTML `sources` 當 canonical owner。

### 4.1 已確認的資料衝突

名稱、raw type 與 22 個 `stats` 欄位沒有差異；價格有 5 筆衝突：

| ID | 名稱 | Wiki `price` | `DB.items.p` |
|---|---|---:|---:|
| `relic_strong_femur` | 強韌的大腿骨 | 0 | 10,000 |
| `relic_mandra_spirit` | 曼陀羅之靈 | 0 | 10,000 |
| `relic_scorpion_sting` | 毒蠍的尾刺 | 0 | 10,000 |
| `relic_ska_soul` | 阿茲特獻祭亡靈 | 0 | 10,000 |
| `relic_shadow_stinger` | 來自陰影的刺劍 | 1 | 10,000 |

本 Audit 不直接修正或裁定舊 Wiki 值；E2 應把 `DB.items.p` 視為目前 authoritative candidate，並將差異保存為 Evidence／migration diagnostic。

## 5. 遊戲程式已有、Wiki 未完整呈現的欄位

對這 1,019 個 ID，`DB.items` 基礎定義共出現 201 種欄位。Wiki 只直接／間接投影其中一部分。以下按責任分組列出目前程式已有但未成為 Wiki 結構化欄位的資訊；有些只出現在少數裝備，不能因缺少就補 0 或 false。

### 5.1 物品、分類、限制與顯示 metadata

```text
spd, gachaWeight, c, w2h, oneHand, ranged, rapidfire,
isBow, isArrow, isWand, chainsword, qigu,
legend, relic, unique, remains, doll, dollTier,
noEnhance, maxEn, noSell, noConsume, noJunk,
hardWear, reqAvatar, animFam, classicOk, sk
```

其中 `sk` 可直接把 175 本技能書連到 175 個既有 Skill ID；`spd` 是武器攻擊間隔；`noEnhance`／`maxEn` 才能正確判斷強化，不應只依 Wiki `safe !== 0` 或 description 文字推測。

### 5.2 未投影的能力與成長欄位

```text
hpR, mpR, weightCap, block,
meleeHit, rangedHit, magicHit, extraHit,
meleeDmg, rangedDmg, extraDmg,
atkSpdPct, moveSpeedPct, meleeHaste,
mcrit, mcritDmg, rcrit,
stunHitBonus, stunResist, abnormalResist, freezeResist, sleepResist,
hitstunReduce, crushDr, magicDrNonEle,
mrPerEn, mpROverSafe, mpRPerEn, extraMpPerEn,
meleeHitPerEn, mdmgEnFrom4, mdmgEnFrom7Max3,
lvDmgDiv, lvHitDiv, petAc, petMr, petHit, petHitAll,
petDmg, petDmgAll, petInt, petWis, summonHit, summonDmg
```

這些不是全部可直接放進 `baseStats`：`*PerEn`、`*From*`、`lv*Div` 與 pet/summon 欄位是公式參數或作用目標 metadata，應由 Mechanic／Formula 表達。

### 5.3 效果、proc、狀態與條件欄位

```text
eff, comboRate, pierceChance, ignHardSkin, weaponHasBleed/noBleed,
spellProc, procSkill, procStatusSkill, procPoison,
procRateBase, procRatePerEn, procInstakill, procBurstPoison,
procBonusDmg, procDmgReduce, procPoisonRate, procFireSkillRate,
procHealFlat, qiguProc, mpOnHit, mpOnHitBase, mpOnHitAmt,
onHitCastSkill, onHitEleDmg, onHitEleVuln,
onDmgHeal, onDmgHealCd, hurtExplode, thorns, dmgReflect,
immBurn, immFreeze, immParalyze, immPoison, immSlow, immStone,
fireNullify, freeChill, stoneInstakill, instakillFull,
poisonMult, poisonHealMult, poisonedBonusDmg, slowedBonusDmg,
silencedBonusDmg, fullHpMult, fullHpMultTriple, fullHpMpHalf,
lowHpPotionX2, lowMpRegenBonus, heavyMult, heavyRatePct,
hardSkinMult, softMult, physDrGated, raceBonus, raceFlat,
ele, wearerEle, eleWpnMult, unBonus,
equipHaste, hasteStrike, polyAtkSpdPct,
skillDmgMult, autoCastMpMult, autoCastDmgMult,
grantSkills, counterBarrierX2, vanderStunHit, weakExpose,
weakHitBonus, stealth, aggroHide, aggroWeight, lure,
auraDmg, highestAttrPlus, giantBonus, partnerHit,
showMobEle, trackBoost, hotHealMult, selfBreakProc,
shahaBow, shahaArrow, windHelm, dragonStrike,
redSpecter, blueSpecter, strawCurse, dotCrit,
expBonus, goldBonus, potionBonus, relicDropX2,
petSkillDmgMult
```

`lure` 在完整 `DB.items` 中存在，但不在目前 1,019 筆 Equipment snapshot 的基礎欄位聯集；仍可能透過其他 item／runtime 機制影響裝備相關分析，故不能用 Wiki 欄位清單判斷整個遊戲沒有該機制。

### 5.4 套裝與特殊結構

```text
set, armguard, spellProc, procPoison, procStatusSkill, grantSkills
```

- `DB.sets` 的成員在 `initSetTags()` 執行後才反向寫入 item `.set`。
- 真正套裝加成在 `recomputeStats()` 依成員數量套用，不在每件裝備的 `EQUIP_DATA.stats`。
- `armguard`、`spellProc`、`procPoison`、`procStatusSkill` 是 nested object，必須保留結構與條件，不能扁平成 description。

## 6. 必須靠程式分析才能確認的資訊

以下不能只讀 `EQUIP_DATA` 或單一 `DB.items` record：

1. **實際武器類別與特效**：`WEAPON_TAGS`、`isBow`、`isWand`、`chainsword`、名稱 regex 與例外 ID 共同決定。
2. **runtime 補值／改寫**：`comboRate` 會依鋼爪／雙刀標籤補預設；`ignHardSkin` 會批次加入並有例外；Pandora 權重也會在其他檔案改寫。
3. **強化結果**：武器傷害／命中、盔甲 AC、飾品部位加成、`mrPerEn`、`extraMpPerEn`、強化上限與安全值需要公式及裝備實例 `en`。
4. **祝福、遠古、屬性詞綴**：`bless`、`anc`、`attr` 是玩家物品實例狀態，不屬於基底 Equipment Entity。
5. **套裝效果**：需要 `DB.sets`、runtime `.set`、穿戴件數、職業與 `recomputeStats()` 分支。
6. **Buff／Debuff／免疫**：需追蹤狀態 ID、來源、持續時間、刷新、阻擋與 mode 分支。
7. **Proc**：觸發率可能是 base＋每強化值、目標條件、元素、技能、狀態、冷卻或連鎖；description 不足以驗證。
8. **Cooldown／共享狀態**：`onDmgHealCd` 等欄位只有搭配 combat state 才能知道是否共享、覆蓋或獨立。
9. **相容性與疊加**：程式中同時存在加法、`Math.max`、覆寫、flag、互斥 slot 與 class branch；「可同時穿戴」不等於效果疊加。
10. **職業可裝備性**：除了 `req`，還有 `darkEquipOk`、`illusionEquipOk`、`dragonEquipOk`、`warriorEquipOk`、`royalEquipOk` 及武器／副手規則。
11. **Classic／其他模式差異**：`classicMode` 可隱藏或停用部分特效，`classicOk` 又可例外開啟。
12. **實際掉落與取得**：應從 Drop、Craft、Quest、NPC 執行路徑建立 relation，不能只解析 Wiki HTML 文案。

## 7. Evidence、Research、Mechanic、Interaction、Knowledge 分類建議

| 類型 | 適合收錄的目前資料 |
|---|---|
| Evidence | `DB.items` 欄位定位、`WEAPON_TAGS` mapping、`recomputeStats()` 分支、combat proc 分支、DropEntry、Craft recipe、版本 `v3.2.79`、5 筆價格差異紀錄 |
| Research | 欄位語意未明、description 與 code 衝突、runtime mutation 順序、模式差異、未驗證 weight、名稱式來源 mapping、實測觸發率與邊界條件 |
| Mechanic | 強化公式、元素倍率、硬皮貫穿、雙擊／出血／反擊／格檔、proc rate、免疫、套裝門檻、Buff／Debuff、冷卻、資源消耗、職業裝備規則 |
| Interaction | 兩件裝備的疊加／覆蓋／互斥、共享狀態、proc chain、Buff refresh、同 slot 互斥、套裝成員關係；缺 Evidence 一律 unresolved |
| Knowledge | 玩家可理解的 STR／DEX／INT、AC、MR、ER、DR、命中、攻速、武器大小傷害、安全強化、職業限制等概念頁；Knowledge 解釋概念，不擁有裝備數值 |

Equipment Entity 應只引用 Mechanic／Interaction／Knowledge／Evidence，不複製其全文或研究結論。

## 8. Legacy Name、Legacy ID 與 Mapping

### 8.1 已可直接解析

- `EQUIP_DATA.id` 與 `DB.items` key：1,019／1,019 exact ID resolve；目前不需要 name mapping。
- `EQUIP_DATA.name` 與 `DB.items.n`：1,019／1,019 exact match，但名稱仍不可作正式 key。
- 技能書 `DB.items.sk`：175／175 可對到 `DB.skills`，未來應輸出 SkillRef，而不是從技能書中文名稱猜 skill ID。

### 8.2 需要 mapping 或 vocabulary 定案

- `type` 的 `wpn`／`arm`／`acc`／`skillbk` 是 legacy raw item type。
- `subtype` 的 `sword1h`、`axe`、`dual` 等與 `equipmentType` 的 `one_hand_sword`、`two_hand_blunt`、`dual_blade` 是兩套分類。
- `slot` 與 `slot_cn` 是 key／label；中文 label 不得作外鍵。
- `req` 的 `royal`、`knight`、`elf`、`mage`、`dark`、`dragon`、`illusion`、`warrior` 需要固定 Class vocabulary。
- 2,496 個掉落來源以中文 monster name 呼叫 `viewMobInGuide()`；須經既有 Monster mapping 轉 MonsterRef。
- 購買、任務、製作、兌換及拆分來源仍有 NPC／Quest／Recipe 名稱式文字；正式 Entity ID 不存在時保持 unresolved。
- 現有 `sources` 中的 `craft_wiki.html?search=<中文名稱>` 是舊 URL／搜尋相容方式，不是 EntityRef。

### 8.3 目前無法取得

`EQUIP_DATA` 沒有 aliases 或 rename history。即使當前名稱唯一，也不能由此宣告不存在 Legacy Name。若未來需要舊 URL／存檔相容，應由 Git 歷史、正式 mapping 與 Evidence 建立，不得由中文名稱自動產生新 ID。

## 9. `EQUIP_DATA` 是否足夠直接建立 Dataset

**不足以原樣直接成為正式 Equipment Dataset。** 它適合當 migration input 與 parity fixture，但不能當唯一 authoritative source。

可直接利用的部分：

- 786 筆可穿戴裝備的 ID 與名稱。
- raw type、部分 slot／class／safe／price／description。
- 22 個已驗證與 `DB.items` 一致的 base stat projection。
- 衍生分類可作既有 UI parity 參考。
- source HTML 可作 migration evidence，不可直接成 relation。

主要阻擋如下：

1. **Domain scope 混合**：1,019 筆同時包含 Equipment、SkillBook、Doll 與遺骸／set records。
2. **authoritative owner 未定**：`DB.items`、runtime mutation、`EQUIP_DATA` 人工補充與其他 Dataset 的責任尚未逐欄定案。
3. **不可重現**：沒有 Equipment generator、來源清單、生成規則、source revision、deterministic／byte-stable baseline。
4. **效果資料缺口**：Wiki 沒有結構化 proc、Mechanic、Interaction、套裝、技能與公式資料。
5. **runtime snapshot 問題**：單讀 `DB.items` 宣告值會漏掉 load-order mutation；直接執行所有遊戲程式又可能混入玩家／DOM state。
6. **關係不是資料**：`sources` 是含 onclick 與中文名稱的 HTML，不能作正式 Drop／NPC／Quest／Craft 外鍵。
7. **已知衝突與未知 provenance**：5 筆價格不同；`weight` 無可定位 owner；safe／req／slot 混合明定與預設。
8. **缺 Verification／version／unresolved**：目前無法表達欄位可信度、版本範圍或待研究狀態。

最大的單一阻擋不是 ID，而是**無法從一個可重現、版本化的流程確定「最終 runtime 值、原始 canonical 值、Wiki editorial 補充」各自的 owner 與合併順序**。

## 10. 第一版 Equipment Dataset 最小欄位建議

第一版只收 786 筆可穿戴 Equipment；SkillBook、Doll 與 EquipmentSet／遺骸另外建模。建議最多 20 個 top-level 欄位：

| # | 欄位 | 最小用途 |
|---:|---|---|
| 1 | `equipmentId` | 沿用已驗證 `DB.items` key |
| 2 | `displayName` | 玩家顯示名稱，不作外鍵 |
| 3 | `itemType` | 保留原始 `wpn`／`arm`／`acc` lineage |
| 4 | `equipmentGroup` | weapon／armor／accessory |
| 5 | `equipmentType` | 正規化武器／部位類型 |
| 6 | `slot` | 正規化裝備欄位 |
| 7 | `classRequirements` | 結構化 class keys |
| 8 | `rarity` | 由可驗證 flag 衍生並記 provenance |
| 9 | `baseStats` | 只放靜態 base scalar，不放強化後數值 |
| 10 | `safeEnhance` | 明定值或 unresolved；不可盲目以 0 補缺 |
| 11 | `price` | 使用當前 authoritative candidate 並保存差異 Evidence |
| 12 | `description` | 純文字／可控 rich text，不能混入 relation onclick |
| 13 | `skillRefs` | 裝備授予／觸發／技能書等已驗證 SkillRef |
| 14 | `setRefs` | EquipmentSet membership refs |
| 15 | `mechanicRefs` | 強化、proc、免疫、特效等 MechanicRef |
| 16 | `relations` | Drop、Craft、Quest、NPC、Release、Interaction 等 EntityRef |
| 17 | `verification` | source、Evidence、confidence、verifiedVersion |
| 18 | `version` | Dataset／source version scope |
| 19 | `status` | complete／partial／unresolved 等資料狀態 |
| 20 | `entityRef` | `{ entityType: "equipment", entityId }` |

不建議第一版直接加入 `weight`：目前沒有可驗證程式 owner。也不建議把所有 201 個 `DB.items` 欄位扁平搬入 Equipment；公式參數、proc、玩家實例、Mechanic 與 Interaction 應由各自 owner 管理。

## 11. E2 前置結論

建議可以進入 **E2 的資料契約與來源優先序設計**，但不建議直接進 Generator／JSON。

E2 最小要先定案：

1. Equipment Dataset 是否只收 786 筆可穿戴裝備。
2. Item、Equipment、SkillBook、Doll、EquipmentSet 的 identity 與 owner 邊界。
3. `DB.items` base definition、load-order mutation、Wiki editorial 與 cross-domain relation 的合併優先序。
4. `safe`／`req`／`slot` 缺欄位的正式 default 規則。
5. `equipmentType` 的 deterministic mapping，並淘汰重複 subtype vocabulary。
6. 5 筆價格差異與 `weight` 的 unresolved／Evidence 處理。
7. base stat、formula parameter、Mechanic、Interaction 與 player item instance 的分界。

上述決策完成後，才適合規劃 Schema、Generator、Validator 與 Dataset。
