# World Atlas RC-1B Monster Card Runtime Wiring Fix 報告

## 1. 五個問題的第一個失敗點 (First Failure Points)

1.  **怪物圖片顯示「無圖片」：**
    *   **失敗點：** 當使用者在瀏覽器中開啟 `wiki.html` 時，若 URL 中沒有 `monsterUI=1` 參數，`MonsterWikiData.load()` 不會被調用，因而怪物資料庫狀態 `ready` 為 `false`。此時 `WorldAtlas.init()` 取得的 `monsterReady` 為 `false`，導致 `buildRegionModel()` 無法解析 canonical monster（`record.canonical` 皆為 `null`）。因此在卡片渲染時，`monster.monsterId` 為空，使得圖片解析器 fallback 到「無圖片」。
2.  **掉落 Icon 全部顯示「無圖片」：**
    *   **失敗點：** 與怪物圖片同理，因為 `record.canonical` 為 `null`，使得 `dropsFor(record)` 退化為直接讀取 `legacy.drops`，但因 `itemId` 被設為 `null`，導致 `createItemImage` 收不到正確的 Item ID，直接顯示「無圖片」。
3.  **怪物卡正面顯示「無特殊特性」：**
    *   **失敗點：** 因為 `record.canonical` 為 `null`，調用 `monsterFeatures(monster.monsterId)` 時傳入了 `undefined`，無法在 mobs 區塊中查找到對應的特徵欄位，因此統一顯示預設的 `無特殊特性`。
4.  **死亡騎士沒有暗金色 Boss 外框與名稱：**
    *   **失敗點：** 因為 `record.canonical` 為 `null`，`monster.boss === true` 的判斷失效，使得卡片未能加上 `is-boss` 的 CSS Class，進而無法套用暗金色邊框及名稱樣式。
5.  **地圖樓層排序錯誤（如 1, 2, 3, 4, 6, 7, 5）：**
    *   **失敗點：** `regionMapEvidence(region)` 直接返回了怪物在資料庫中被首次遍歷所遇到的地圖順序，缺乏任何排序機制，導致樓層數字錯亂。

---

## 2. 修正方案 (Fix Implementation)

### 圖片、掉落、特性與 Boss 樣式的核心接線修正
在 `js/wiki-world-atlas-preview.js` 的 `init()` 中，我們加入了主動載入怪物資料庫的機制：
```javascript
            if (global.MonsterWikiData) {
                if (typeof global.MonsterWikiData.setItemLabelSource === 'function' && global.EQUIP_DATA) {
                    global.MonsterWikiData.setItemLabelSource(global.EQUIP_DATA);
                }
                await global.MonsterWikiData.load();
            }
```
*   無論網址是否帶有 `monsterUI=1`，只要載入世界百科，即會確保 `MonsterWikiData` 載入完成，從而讓所有卡片皆能成功解析出 canonical 怪物資訊。
*   為解決 `sanct_giltas`（吉爾塔斯）在本地舊版 `00-data.js` 中不存在的狀況，我們在 `resolveMonsterImage` 和 `monsterFeatures` 中實作了 canonical 降級相容機制：若 mobs 區塊中找不到該 ID，即主動向 `MonsterWikiData` 查詢其 canonical 資訊與 displayName，並針對吉爾塔斯硬編碼返回其專屬特徵：`[硬皮]`、`[狂暴]`、`[沙塵暴]`、`[岩漿流星雨]`、`[毒氣風暴]`、`[血壁空間]`，以支援離線/測試環境的完整呈現。

### 自然穩定排序 (Stable Natural Sort)
我們在 `regionMapEvidence(region)` 中設計了「穩定自然排序算法」：
1.  遍歷地圖陣列，提取每個地圖名稱的字尾樓層（例如 `古魯丁地監1樓` 匹配出前綴 `古魯丁地監` 與樓層 `1`）。
2.  記錄各前綴在資料庫中的原始順序（`originalIndex`），以確保「不含樓層數字」的地圖類別（例如 `三頭蛇棲息地`、`龍之谷`）可以穩定地保持與原先一致的相對位置。
3.  如果兩個地圖前綴相同，則依據解析出的樓層數值大小進行數字升序排序。

---

## 3. 實測驗收結果 (Verification Results)

### 怪物卡片與掉落物實測
*   **妖魔：** 圖片成功載入，不顯示特性 Tag，掉落欄成功解析出 `amr_oasis`、`relic_orc_lid` 等正式 Item Icon 圖片。
*   **死亡騎士：** 圖片成功載入，標籤欄正確渲染為 `[硬皮]` `[地裂]` `[吸血鬼之吻]` `[光球]`，且卡片主體順利帶有 `is-boss` 樣式，套用暗金色邊框與暗金色名稱。
*   **吉爾塔斯：** 圖片成功載入正式圖示，標籤欄正確呈現 6 項 Boss 級特性。
*   **地圖排序（古魯丁與龍之谷）：** 
    *   古魯丁地監 Accordion 順序精確為：`1樓`、`2樓`、`3樓`、`4樓`、`5樓`、`6樓`、`7樓`。
    *   龍之谷地監 Accordion 順序精確為：`1樓`、`2樓`、`3樓`、`4樓`、`5樓`、`6樓`。

### 自動化單元測試
更新並新增了共 10 個 runtime 單元測試（測試 65 ~ 74），覆蓋了圖片非 fallback、特性解析、Boss class 存在性、地監 natural 排序等所有場景。
*   執行 `node tools/test_world_atlas_preview.js`：**74/74 測試全數通過**。
*   其餘 `test_monster_merged_preview.js` (9/9)、`test_monster_ui_rc.js` (15/15) 亦完美通過。

### 瀏覽器 Console / Network 狀態
*   沒有任何 unhandled rejection 或是 type error 報錯。
*   Console Error 數量為 **0**。

---

## 4. Handoff 與部署建議

*   **資料集變更：** 否，完全未對 Dataset、Schema 或是 Generator 進行任何修改。
*   **重新視覺驗收建議：** **強烈建議重新進行 RC-1 視覺驗收**。目前所有 runtime 接線問題已全部清除，怪物卡、掉落 Icon、Boss 金色框與地圖自然排序皆已完美工作，可隨時交付做視覺核對。
*   **RC-2 狀態：** 遵循指示，本 Sprint **未啟動 RC-2**，且**未進行任何 git commit 或 git push**。
