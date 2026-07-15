# World Atlas Preview v0.1 報告

## 範圍

本次只修正 `worldPreview=1` 的三項問題：地區與地圖關聯、怪物正面圖片，以及「特性」的資料語意。未修改 Monster、Map、Drop、Equipment Dataset，未修改正式 Monster UI、正式導航或其他 Domain。

## 問題根因

v0 的 `regionMaps()` 會把地區內每隻怪物的所有 Dataset `mapRefs` 聯集成地區 Map Tabs。當同一怪物也出現在其他地區時，其他地區的地圖便被反向擴張進目前地區；龍之谷因此混入古魯丁、銀騎士村、妖精森林、`pride_f*`、`oblivion_travel` 等無關項目。問題不是 Map Dataset 本身，而是 Preview 將「怪物可能出沒地圖」誤當成「地區正式收錄地圖」。

## 地區／地圖關聯修正

Preview 現在只把該 `REGIONS_DATA` 地區記錄明確列出的 `maps` 作為 Map Tabs 證據。Monster Dataset `mapRefs` 仍可用於判斷怪物與已核准 Map 的交集，但不再反向建立地區 Map。

未出現在地區明確清單、但由共享怪物帶入的 Dataset Map，會以 `shared-monster-mapRef` 記入 Preview runtime diagnostics，不顯示為分頁。這項 diagnostics 不寫回任何 Dataset。

「全部」不受 Map Tabs 收斂影響，仍顯示該地區 `REGIONS_DATA` 的全部已解析怪物。

### 龍之谷固定驗收清單

來源為現有 `REGIONS_DATA.dragonvalley` 的明確 `maps`：

1. 沉默洞穴周邊
2. 龍之谷
3. 龍之谷地監1樓
4. 龍之谷地監2樓
5. 龍之谷地監3樓
6. 龍之谷地監4樓
7. 龍之谷地監5樓
8. 龍之谷地監6樓
9. 安塔瑞斯棲息地

龍之谷「全部」實測仍為 35 隻怪物。已確認不再出現古魯丁周邊、銀騎士村周邊、妖精森林周邊、`pride_f20`、`oblivion_travel` 等錯誤 Map。

另外驗證銀騎士村、說話之島、奇岩三個地區，其分頁分別維持 2、4、5 張明確地圖。

## 怪物圖片來源與解析

v3.4.17 遊戲的正式定位方式來自 immutable snapshot：

- `js/00-data.js`：`DB.mobs.<monsterId>.n` 提供正式 asset key；若有 `img` 則使用明確靜態路徑。
- `js/09-vfx-render.js`：`MOB_ANIM_NAMES`、`MOB_ANIM_8DIR`、`MOB_ANIM_ALIAS` 與 `mobStillImg()` 定義動畫目錄、八方向的 `d6/idle_0.png` 及 alias 規則。
- 動畫正面圖使用 `assets/anim/<asset key>/idle_0.png`；八方向怪使用 `assets/anim/<asset key>/d6/idle_0.png`。
- 非動畫怪依遊戲既有規則使用 `assets/icons/monsters/<asset key>.png`。

Preview 以 `monsterId` 定位 `DB.mobs`，再取得正式 asset key；中文顯示名稱不是關聯鍵。卡片與 Detail 都呼叫同一個唯讀 resolver。資產直接讀取原作者 GitHub Pages，沒有下載圖片，也沒有建立圖片 Dataset。

圖片沒有 descriptor、所有候選路徑均載入失敗時，顯示中性「無圖片」框；Emoji 已移除。圖片框固定為 52 × 52，使用 `object-fit: contain`。

### 圖片驗收

- 妖魔 (`orc`)：`assets/anim/妖魔/idle_0.png`，載入成功，natural width 111。
- 死亡騎士 (`dk`)：`assets/anim/死亡騎士/idle_0.png`，載入成功，natural width 146。
- 吉爾塔斯 (`sanct_giltas`)：`assets/anim/吉爾塔斯/idle_0.png`，載入成功，natural width 463。
- 無法解析 ID：自動測試確認 resolver 回傳無圖片狀態，且不使用 Emoji。

## 「特性」資料來源與語意

特性只讀取 v3.4.17 `DB.mobs.<monsterId>` 的 Code 證據：

- `hard: true`：Boss 硬皮，類型為防禦。
- `rageHpPct`：狂暴，類型為觸發。
- `regenHp`：生命回復，類型為被動。
- `mag`、`mag2`、`mag3`、`mag4`：讀取 `skn` 技能名稱；可確認沉默、中毒、反射等程式欄位時提供保守摘要。

Preview 不把 `boss=true` 自動轉成技能，也不補造未完全驗證的傷害、冷卻或機率。只能確認技能名稱時顯示「詳細機制尚未整理（Code）」。種族只留在基本資訊，不再出現在特性。

### 指定怪物驗收

- 死亡騎士：基本資訊顯示種族「不死」；特性顯示 Boss 硬皮、地面震裂、吸血鬼之吻、光球，沒有「種族：不死」。
- 妖魔：基本資訊顯示種族「妖魔」；沒有程式特性，特性顯示「無」，未虛構技能。
- 新版 Boss 吉爾塔斯：顯示 Boss 硬皮、狂暴、沙塵暴、岩漿流星雨、毒氣風暴、血壁空間；摘要只陳述可由程式欄位確認的狀態或機制。

## 修改檔案

- `js/wiki-world-atlas-preview.js`
- `css/wiki-world-atlas-preview.css`
- `tools/test_world_atlas_preview.js`
- `docs/WORLD_ATLAS_PREVIEW_V01_REPORT.md`

`wiki.html` 不需要為 v0.1 增加修改。

## 自動測試

- JavaScript syntax check：通過。
- World Atlas Preview：15/15 通過。
- Monster Merge Preview：9/9 通過。
- Monster UI Beta：21/21 通過。
- Monster UI RC：15/15 通過。
- Equipment UI RC：72/72 通過。
- WikiDataCore：通過；recipes 279、NPCs 47、items 471。
- `git diff --check`：通過。

## 瀏覽器與資源驗收

- 龍之谷 Map Tabs：固定 9 張；不相關 Map 為 0。
- 龍之谷「全部」：35 隻；切到龍之谷地監1樓後為 6 隻，再切回「全部」恢復 35 隻。
- 圖片：妖魔、死亡騎士、吉爾塔斯均載入遊戲資產，卡片與 Detail 共用 resolver。
- 收合：卡片與 Detail 的特性、出沒地圖、掉落預設關閉並可操作。
- 搜尋、地區切換、Map filter：正常。
- 必要本機資源：`wiki.html`、Preview JS/CSS、monsters/maps/drop_tables JSON 均 HTTP 200。
- 正式模式：不帶 `worldPreview=1` 時沒有 World Atlas shell 或 Preview tab。
- 驗收互動未觀察到 Console Error；必要資源沒有新增 404。

## 已知限制

- 本 Preview 依賴原作者公開站點提供 v3.4.17 圖片與來源腳本；若外站不可用，圖片會降級為「無圖片」，來源解析則回退至本專案現有來源。這不會修改正式 Dataset。
- 特性是 Preview 的唯讀 Code 摘要，不是正式 Mechanic Dataset；複雜公式、冷卻、機率與版本差異仍待後續正式研究流程。
- 地區正式 identity 尚未建立，因此 Map Tabs 嚴格採用現有 `REGIONS_DATA` 明確清單；無法驗證的 Dataset-only 關聯只進 runtime diagnostics。
