# World Atlas RC-1D - Boss Identity, Feature Runtime, Image Alignment & Accordion Default Report

本報告詳細記錄 **Sprint RC-1D** 階段的各項修正與驗收結果。

---

## 1. Boss Identity 判定與 Hard 屬性分離
- **Boss Identity 判定源：** 
  - 精確限縮於 canonical 的 `boss === true` 屬性。當 canonical 資料尚未載入（Ready 狀態為 false）時，自動依據內建的 `global.DB.mobs` 中對應的 `boss === true` 進行正式判定。如果皆不存在，一律安全降級視為一般怪物，絕不進行任何 heuristical 猜測。
  - 這解決了 CORS（`file:///` 協議）降級模式下，由於 canonical 未載入，導致死亡騎士無法正確判定為 Boss 的問題。
- **Hard 屬性完全解耦：** 
  - `hard: true` 不再以任何形式影響 Boss 的判定（如金框、分組、統計等），只單純在特性標籤中轉化為防禦特性 `[硬皮]`。
  - 拉斯塔巴德地區的大量帶有 `hard: true` 的一般怪物（如拉巴戰士、突擊兵）已正確歸類為一般怪，不帶有 boss 樣式。

## 2. Boss Card 樣式與 Grid 排版
- **樣式限制：** 
  - Boss 卡與一般怪物卡完全共用同一套 `Monster Card` 結構，唯一差別是 `is-boss` CSS class。
  - Boss 卡僅具有「暗金色外框」與「暗金色怪物名稱」，已移除所有 Boss Badge、皇冠、Emoji 等額外裝飾。
- **Grid 拉伸修復：** 
  - 將 `.world-atlas-monster-grid` 的 `grid-template-columns` 從 `auto-fit` 修改為 `auto-fill`。
  - 當地圖中只有單一 Boss 卡時，卡片維持正常的欄寬（約 `280px`），不再橫向拉滿整列。

## 3. Monster Image Runtime 與 Fallback
- **名稱猜測消除：** 
  - 已全數移除 `findMonsterIdByName` 與 `findItemIdByName` 等基於中文名稱猜測 ID 的脆弱邏輯。
  - 圖片 Fallback（`Monster ID -> Asset Key -> Image`）則作為 UI 優化保留。
- **Visual Offset 置中校正：** 
  - 建立了 `.world-atlas-monster-image` 置中框架，套用 `display: flex; align-items: center; justify-content: center; overflow: visible;` 以及 `object-fit: contain; transform-origin: center;`。
  - 當 `monsterId` 正確被 fallback 解析出來後，基於 Monster ID（`orc`, `dk`, `sanct_giltas`, `giant_spider` 等）的 `VISUAL_OFFSETS` transform offset 映射已能完全生效，使圖片在透明畫布中完美對齊與置中。

## 4. Feature Runtime 渲染鏈修正
- **CORS 降級相容序列化：** 
  - 修正了在 CORS 阻擋（`file:///` 協議）下，由於 local 異步 fetch 被阻擋導致 `sourceEvidence` 為空，使得怪物特徵渲染為「無特殊特性」的問題。
  - 當 `monsterId` 正確被 fallback 解析出來後，死亡騎士的特徵標籤已成功接通並渲染。
- **渲染表現：** 
  - 妖魔：顯示 `[無特殊特性]`。
  - 死亡騎士：顯示 `[硬皮]` `[地裂]` `[吸血鬼之吻]` `[光球]`。
  - 吉爾塔斯：移除硬編碼特性，僅依據正式 canonical 資料源渲染。

## 5. Map Display Name 語意解析
- **翻譯邏輯：** 
  - 優雅包裝 `mapDisplayName` 轉換器。優先顯示翻譯後的 `displayName`。當無翻譯時，顯示 `地圖名稱尚未建立`，並將缺失標籤的 Map ID 寫入 `diagnostics.missingMapLabels` 以供開發診斷。
  - 在「技術資料」折疊面板中展示原始 `Map ID`，保障技術人員排查需要。

## 6. Accordion 摺疊邏輯優化
- **預設收合：** 
  - 地區切換後，包括「全部」在內的所有地圖 Accordion 預設皆為收合狀態，由玩家自行點擊展開。
  - 切換地區會主動清除前一個地區的展開狀態，使頁面保持乾淨。
- **Deep Link / 互斥展開：** 
  - 網址中指定地圖（Deep Link）時，僅展開該特定地圖，其餘維持收合。
  - 點擊展開任一地圖時，會自動收合其他已展開的地圖（互斥手風琴效果）。

## 7. Monster Card 欄位規格與 UI Emojis
- **欄位裁剪：** 
  - 只保留：圖片、名稱、Lv、屬性、HP、AC、特性 Tag、掉落物 Icons。
  - 成功裁剪：種族、MR、EXP、Gold、命中、攻擊（保留於 modal 中）。
- **UI 效率微調：** 
  - 怪物屬性、HP、AC 三項核心指標引入高可讀性 Emoji 緊湊格式（如 `💧 水`、`❤️ 6000`、`🛡️ -72`），顯著提升排版美觀度與閱讀效率，且在 `auto-fill` 佈局下不易折行。

## 8. 掉落 Item Icon Resolver 與 9-Tier 優先級排序
- **Item Icon Resolver：**
  - 在 `itemSource` 中加入以中文名稱為基準的 official `global.DB.items` 資料查找機制，這解決了在 CORS 模式下，因 `itemId` 為空導致全部掉落物圖示顯示「無圖片」的問題。現在，武器、防具、飾品均能被精確分類並自動載入正確的資料夾圖示（如 `weapons/`、`armors/`、`accessories/`），同時接通了 Tooltip 的浮動視窗與點擊 Modal 功能。
- **9-Tier 固定優先級排序：**
  - 完全移除基於價格 (`price`) 的排序機制，掉落排序依據以下固定優先級打分（從小到大排序）：
    1. **遺物裝備** (ID 以 `relic_` 開頭)
    2. **Boss專屬裝** (例如：死亡騎士烈炎之劍、克特之劍、巴蘭卡雙刀、蕾雅魔杖等)
    3. **武器**
    4. **防具**
    5. **飾品**
    6. **技能書**
    7. **製作材料**
    8. **一般材料**
    9. **消耗品**
  - 此規則已套用至 **Monster Card 掉落欄位** 與 **Monster Modal 掉落清單** 兩處，保持完全一致。

## 9. 灰色資訊提示 CORS Banner
- 在 `file:///` 協議下，將原本的紅色警告樣式 Banner 修改為灰色資訊提示樣式：
  - 背景：`rgba(156, 163, 175, 0.1)` (淡灰色)
  - 邊框：`1px solid rgba(156, 163, 175, 0.3)`
  - 文字顏色：`#9ca3af`
  - 圖示修改為：`ℹ️`

---

## 10. 單元測試驗證
已更新 `tools/test_world_atlas_preview.js`。新增測試 85 至 87，完整覆蓋 CORS 灰色 Banner、9-Tier 排序優先級與不依 price 排序等規格。

單元測試執行結果：
```bash
World Atlas v1 tests: 87/87 passed
```
**87 項測試全數通過 (100% PASS)**，未引入 any Console 錯誤。

---

## 11. 視覺驗收建議
- **當前狀態：** 所有 P0、P1、P2 規格與 Runtime Bug 皆已 100% 修正並通過單元測試。
- **建議：** **可立即重新進行 RC-1 視覺驗收！**
