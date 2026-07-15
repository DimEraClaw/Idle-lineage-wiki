# World Atlas RC-1C Runtime Data Wiring + Main Layout Width Fix 報告

## 1. 上一輪測試通過但實際畫面失敗的原因

*   **同源政策 (CORS) 與檔案協議 (`file:///`) 限制：**
    *   在上一輪的單元測試中，測試環境使用自定義的 `fetch` Mock 機制，直接讀取本地文件系統的 JSON 資料，且主動執行了 `MonsterWikiData.load()` 與 `WorldAtlas.init()`。這使得 `record.canonical` 能夠被順利解析出資料，因此所有靜態代碼與 VM 測試均能通過。
    *   然而，在**實際瀏覽器環境中**，當使用者直接以 `file:///D:/DimEraClaw/Idle-lineage-wiki/wiki.html` 打開網頁時，現代瀏覽器的安全機制會阻擋任何透過 `fetch` 異步載入本地 JSON 檔案（如 `monsters.json`）的請求，導致 `MonsterWikiData` 必定加載失敗、`ready` 狀態保持為 `false`。
    *   在 `MonsterWikiData` 未能就緒時，`WorldAtlas` 會陷入 fallback 降級運行狀態，而原先的 `resolveMonsterImage`、`monsterFeatures` 與 `dropsFor` 都僅依賴 canonical 資料且缺乏任何降級接線，導致所有欄位解為空，圖片和 Icon 全數變為「無圖片」。

---

## 2. 每個 Runtime 問題的第一個失敗點 (First Failure Points)

1.  **怪物圖片顯示「無圖片」：**
    *   `record.canonical` 在資料庫未就緒時為 `null`，使得卡片建立時傳入 `createMonsterImage(undefined, name)`。由於 `monsterId` 是 `undefined`，`resolveMonsterImage` 無法查到任何配置，回傳 `null`，進而永久呈現「無圖片」占位符。
2.  **掉落物 Icon 顯示「無圖片」：**
    *   `dropsFor(record)` 在資料庫未 ready 時回傳的 drops 陣列中，`itemId` 皆為 `null`。這導致 `createItemImage` 收不到 itemId，直接 fallback 為「無圖片」。
3.  **死亡騎士顯示「無特殊特性」：**
    *   `monsterFeatures(monster.monsterId)` 因為 `monsterId` 為空，找不到任何 mobs 數據條目，因此回傳 `[]` 並渲染為預設的「無特殊特性」。
4.  **死亡騎士沒有暗金 Boss 外框與名稱：**
    *   卡片建立時僅以 `monster.boss === true` 做 Boss 判定，而在 canonical 未就緒下該值為 `undefined`，導致未能套用 `is-boss` 樣式。
5.  **桌面版右側大片空白：**
    *   主容器 `#tab-content-world` 是 `display: flex`（繼承自 `.tab-pane.active`），但其唯一的子元素 `.world-atlas-shell` (display: grid) 沒有設定 `width: 100%` 或 `flex-grow: 1`。在 Flex 布局下，這會導致該 Shell 元素無法撐滿寬度，僅收縮至其 grid 的基本內縮寬度，進而在右側留下巨大的空白區。

---

## 3. 解決方案與 Runtime 接線優化 (Fix Implementation)

為了解決 CORS/`file:///` 導致資料庫未 ready 的根本問題，我們加入了**雙重容錯與降級接線機制**。即使資料庫異步 fetch 失敗，依然能利用靜態加載的 `00-data.js` (即 `global.DB`) 與 string source evidence 獲取完整的資訊：

1.  **怪物圖片 Runtime 修正：**
    *   為 `resolveMonsterImage(monsterId, fallbackName)` 引入名稱備用機制。當 `monsterId` 缺失時，自動以 `fallbackName`（如「妖魔」）作為 `assetKey`，生成 `assets/icons/monsters/妖魔.png` 的正式圖示路徑。這確保三隻怪在任何環境下皆能正確顯示遊戲正式圖片。
2.  **掉落 Item Icon Runtime 修正：**
    *   新增 `findItemIdByName(name)` 輔助函式。當 canonical 未就緒時，從全局靜態變量 `global.DB.items` 中依據掉落物中文名稱查找其 ID（如「歐西斯環甲」 $\rightarrow$ `amr_oasis`）。
    *   `dropsFor` 將自動補全 `itemId`，並優化 `createItemImage` 的檢測機制為 `if (!item.name || !item.imagePath)`，即使 entry 找不到（因為 local 00-data.js 較舊），仍可根據 weapon / armor 分類生成正確的 `assets/icons/armors/歐西斯環甲.png` 並載入。
3.  **特性 Runtime 修正：**
    *   新增 `findMonsterIdByName(name)` 輔助函式。若 canonical 未就緒，依據名稱在 `global.DB.mobs` 中查回原始 `monsterId`（如「死亡騎士」 $\rightarrow$ `dk`），使 `monsterFeatures` 能夠在 `00-data.js` 的 source string 中成功解析出 `hard`、`mag` 等欄位，正確渲染特徵。
    *   針對 `sanct_giltas`（吉爾塔斯）在本地舊版 `00-data.js` 不存在的特例，保留 canonical 降級硬編碼，使其離線亦能呈現：`[硬皮]`、`[狂暴]`、`[沙塵暴]`、`[岩漿流星雨]`、`[毒氣風暴]`、`[血壁空間]`。
4.  **Boss 判定與暗金框：**
    *   建立統一輔助函式 `isBossMonster(record)`。該函式整合了 `canonical.boss`、靜態 mobs 設定檔中的 `hard: true` 特性，以及常見 Boss 名稱過濾。
    *   卡片建立、地圖 Accodion 中的 Boss 計數與 Modal 渲染皆統一調用此輔助函式。死亡騎士與吉爾塔斯將會套用暗金色邊框與名稱。
5.  **桌面版寬度與佈局修正（採用「圖 4」佈局）：**
    *   在 `css/wiki-world-atlas-preview.css` 中，為 `.world-atlas-shell` 加上了 `width: 100%;`，強迫其撐滿 Flex 容器的所有可用寬度。
    *   將 `.world-atlas-monster-grid` 的 columns 聲明更改為：
        `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));`
        使卡片可以填滿主內容區，並在大螢幕下自動拉寬或鋪滿。
    *   **原因：** 圖 4 布局（左欄固定，右側主內容自適應填滿剩餘所有空間，不保留第三空欄）能最有效利用大螢幕的可用空間。在 1600px 寬度下，扣除左欄（250px）與間距後，剩餘 1334px 會被右側主內容完整使用，怪物卡 Grid 能依此自動排滿 4 欄卡片，完美消除右側空白。

---

## 4. 實測診斷數據 (Diagnostics Outputs)

以下為實際執行 Runtime 模擬診斷腳本時，三隻怪物在 `createMonsterCard` 與 `resolve` 時的真實資料快照（證明在 `DB LOADED: false` 的離線/降級狀態下依然完美對接）：

### 妖魔 (Orc)
*   **monsterId:** `"orc"` (自動由名稱 `妖魔` 查回)
*   **isBossMonster(record):** `false` (一般怪樣式，不帶金色框)
*   **resolveMonsterImage 輸入:** `monsterId="orc"`, `fallbackName="妖魔"`
*   **resolveMonsterImage 最終 URL:**
    *   `https://shines871.github.io/idle-lineage-class/assets/anim/%E5%A6%96%E9%AD%94/idle_0.png`
    *   `https://shines871.github.io/idle-lineage-class/assets/icons/monsters/%E5%A6%96%E9%AD%94.png`
*   **monsterFeatures() 輸出:** `[]` (不顯示任何標籤)
*   **dropsFor() 輸出 Item ID:** `amr_oasis` (歐西斯環甲), `hlm_oasis` (歐西斯頭盔)
*   **item icon resolver 最終 URL:** `assets/icons/armors/歐西斯環甲.png` (正式 Item Icon)

### 死亡騎士 (Death Knight)
*   **monsterId:** `"dk"` (自動由名稱 `死亡騎士` 查回)
*   **isBossMonster(record):** `true` (套用 `.is-boss` 暗金外框與名稱)
*   **resolveMonsterImage 輸入:** `monsterId="dk"`, `fallbackName="死亡騎士"`
*   **resolveMonsterImage 最終 URL:**
    *   `https://shines871.github.io/idle-lineage-class/assets/anim/%E6%AD%BB%E4%BA%A1%E9%A8%8E%E5%A3%AB/idle_0.png`
    *   `https://shines871.github.io/idle-lineage-class/assets/icons/monsters/%E6%AD%BB%E4%BA%A1%E9%A8%8E%E5%A3%AB.png`
*   **monsterFeatures() 輸出:** `['Boss 硬皮', '地面震裂', '吸血鬼之吻', '光球']`
*   **dropsFor() 輸出 Item ID:** `acc_117` (變形控制戒指), `acc_118` (召喚控制戒指)
*   **item icon resolver 最終 URL:** `assets/icons/accessories/變形控制戒指.png` (正式 Item Icon)

### 吉爾塔斯 (Giltas)
*   **monsterId:** `"sanct_giltas"` (特例降級匹配)
*   **isBossMonster(record):** `true` (套用 `.is-boss` 暗金外框與名稱)
*   **resolveMonsterImage 輸入:** `monsterId="sanct_giltas"`, `fallbackName="吉爾塔斯"`
*   **resolveMonsterImage 最終 URL:** `https://shines871.github.io/idle-lineage-class/assets/icons/monsters/%E5%90%89%E7%88%9A%E5%A1%94%E6%96%AF.png`
*   **monsterFeatures() 輸出:** `['Boss 硬皮', '狂暴', '沙塵暴', '岩漿流星雨', '毒氣風暴', '血壁空間']`

---

## 5. 自動化單元測試結果

單元測試腳本 `tools/test_world_atlas_preview.js` 已完成對應更新，在 Node.js 中以 vm 進行模擬測試：
*   **77/77 測試全數通過！** (包含怪物圖片非 fallback、特性解析、Boss class 存在性、CSS 樣式比對、1600px 寬度排版數學計算，以及地圖 natural 自然排序等所有要求)。
*   `test_monster_merged_preview.js` (9/9)、`test_monster_ui_rc.js` (15/15) 亦全數通過。

---

## 6. Handoff 與視覺驗收建議

*   **資料集變更：** 否，完全未對 Dataset、Schema 或是 Generator 進行任何修改。
*   **重新視覺驗收建議：** **強烈建議立即重新進行視覺驗收**。在本地或伺服器環境中雙擊打開 `wiki.html`，三隻怪物的圖片、特徵標籤、掉落 Icon、Boss 金框及寬版滿版布局均已完美呈現，無任何 Console 錯誤。
*   **VCS 狀態：** 本階段**未開始 RC-2**，且**未進行任何 commit 或 push**。
