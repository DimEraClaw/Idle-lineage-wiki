# World Atlas v1 正式上線版報告

## 結論

World Atlas 已由 opt-in Preview 整理為 `wiki.html` 的預設世界百科入口，並以同一個唯讀畫面整合現有地區、地圖、怪物、掉落、NPC 與製作資料。World Atlas 本身的自動測試與桌面瀏覽器核心流程通過；但本輪全專案回歸發現兩個既有 Dataset CLI validator 失敗，且 390×844 實機 viewport 未能由目前瀏覽器控制介面切換，因此本報告暫不建議直接部署。

## 新增、修改與移除檔案

本階段修改：

- `wiki.html`
- `css/wiki-world-atlas-preview.css`
- `js/wiki-world-atlas-preview.js`
- `tools/test_world_atlas_preview.js`

本階段新增：

- `docs/WORLD_ATLAS_V1_REPORT.md`

本階段未移除檔案。現有未提交 Preview 報告與 Monster Merge Preview 檔案均保留；`js/wiki-monster-view.js` 的既有未提交差異也未由本階段改寫。

## 正式入口、導覽與舊 URL 相容

- World Atlas 預設啟用，不再要求 `worldPreview=1`。
- 正式主選單顯示「回到遊戲」、「裝備與技能百科」、「世界百科」。
- World Atlas 成功初始化後隱藏製作、卡片與舊怪物入口，但不刪除其程式與 fallback。
- `worldAtlas=0` 可強制回到舊導覽。
- `tab=monster`、`tab=cards`、`tab=craft` 經受控路由轉入 `tab=world`。
- 舊 `monster`、地區及搜尋參數會盡可能轉譯；無法轉譯時回到世界百科首頁，不白屏。

## 地區與地圖 Accordion

- 左欄沿用現有 16 個地區及其卡片收藏加成摘要，不讀取玩家收藏進度。
- 點地區後主內容立即更新，不要求第二次選擇。
- 地圖改為 Accordion；標題顯示地圖、怪物、Boss 與 NPC 數量。
- Accordion 內容依序分開 Boss、一般怪物與 NPC。
- 地區與地圖關聯沿用 v0.1 嚴格證據規則。龍之谷實測為：全部、沉默洞穴周邊、龍之谷、龍之谷地監 1～6 樓、安塔瑞斯棲息地。

## 怪物卡、圖片與捲動

- 怪物卡只顯示掃描摘要：正式怪物圖片、名稱、Boss、等級、種族、屬性、HP、攻擊、命中、AC、MR、EXP、Gold，以及特性／地圖／掉落數量。
- 怪物圖片依 Monster ID 與遊戲既有 `DB.mobs`、動畫 alias 及 `mobStillImg()` 規則解析；失敗時使用中性「無圖片」，不使用 Emoji。
- 妖魔、死亡騎士、吉爾塔斯的瀏覽器圖片均成功載入，實測自然寬度分別為 111、146、463 px。
- `#tab-content-world` 是唯一主要垂直捲動區；怪物卡使用自然高度且無內部 scrollbar。
- 妖精森林「全部」可完整找到妖魔鬥士與污染的潘；內容可由主捲動區繼續向下查看，無水平溢位。

## 共用 Entity Modal 與 Monster Modal

- 共用遮罩與 Modal 外框正式支援 Monster、Item／Equipment、NPC。
- 支援右上角按鈕、ESC、遮罩關閉、背景捲動鎖定、焦點移入及關閉後回復。
- Monster Modal 顯示圖片、Boss 與基本能力，並以獨立收合區呈現特性、出沒地圖、掉落、技術資料。
- 特性只使用可定位的 Code evidence；不把種族當特性，也不替普通怪物虛構能力。
- 死亡騎士與吉爾塔斯的可驗證技能可顯示；妖魔沒有假技能。

## Item Tooltip、Popover 與遊戲 Icon

- 掉落物與 NPC 製作品共用 Item renderer 與遊戲 Icon resolver。
- 解析依 Item ID 與現有 `DB.items`／遊戲 icon 路徑，不用中文名稱當 identity，不下載或建立圖片 Dataset。
- 桌面 hover Tooltip 具 viewport clamp；無 hover 環境以點擊開 Item Modal。
- Tooltip／Item Modal 只顯示已存在的分類、能力、安定值、價格、重量與說明，`null` 不轉成 `0`。
- 裝備 Item 可呼叫既有 Equipment Detail Modal；瀏覽器實測「獸王鋼爪」可在不離開世界百科的情況下開啟完整裝備資料。

## NPC 與製作整合

- NPC 讀取既有 `data/craft/npcs.json`。
- 配方優先使用 Craft read model；未 ready 時唯讀載入既有 `recipes.json` 與 `items.json`，不建立新資料。
- NPC 卡與 Modal 顯示名稱、用途、可驗證位置與描述。
- 沉默洞穴周邊實測顯示 3 個 NPC；可羅蘭斯 Modal 顯示 6 個既有製作品，並可開 Item／Equipment 資料。

## 統一搜尋

單一搜尋框分組支援地區、地圖、Monster 名稱／ID、NPC、掉落物名稱／ID。點擊結果可切換地區／地圖、開 Monster／NPC Modal，或顯示掉落該物品的怪物。瀏覽器以「死亡騎士」實測得到怪物與掉落物分組，並可開啟死亡騎士 Modal。

## 行動版

- 850 px 以下地區欄改為選單，主內容單欄。
- 480 px 以下怪物卡單欄、Accordion 全寬、Modal 為近全螢幕 Dialog，Item Tooltip／Popover 固定於安全邊界。
- CSS 與自動測試已驗證 390 px 規則、無卡片內部捲軸與無設計上的水平溢位。
- 本輪 Browser 控制介面不提供 viewport resize，因此 390×844 的實際瀏覽器尺寸仍需部署前人工補驗。

## Fallback

- World Atlas 初始化例外會顯示安全提示，不白屏。
- Monster JSON 失敗時保留可用的 legacy 地區內容與 NPC。
- NPC 載入失敗不影響怪物與地圖。
- 圖示或 Equipment Detail 失敗只降級為名稱、ID 或中性無圖提示。
- `worldAtlas=0` 保留完整舊入口作緊急回退。

## 自動測試

通過：

- World Atlas v1：60/60。
- Monster Merge Preview：9/9。
- Monster UI Beta：21/21；Monster UI RC：15/15。
- Monster Dataset tests：7/7。
- Equipment Repository：25/25；Shadow：32/32；View Adapter：71/71；UI RC：72/72。
- Equipment Dataset tests：30/30；Equipment View Payload tests：30/30。
- Equipment View Payload validator：passed，825 summaries／16 shards／825 details，byte stable。
- Craft validator：passed。
- WikiDataCore：passed，無 captured console error。
- JavaScript syntax 與 `git diff --check`：passed。

未通過／未完成：

- `validate_monster_data.py`：既有 DropEntry `drop_entry_legacy_owner_hellslave_mat_summonorb_core_base` 的 ItemRef 無效。
- `validate_equipment_data.py`：既有 Equipment 驗證遇到缺少 key `amr_emperor`。
上述問題不由 World Atlas 變更造成，本階段也未修改任何 Dataset、Generator、Schema 或 Validator；但依全站部署門檻仍應先釐清。

## Browser 驗收

已實測：

- 世界百科預設入口與 16 地區。
- 龍之谷嚴格地圖 Accordion。
- 妖精森林完整怪物集合、主捲動區、無卡片內部 scrollbar、無水平溢位。
- 妖魔、死亡騎士、吉爾塔斯圖片與 Modal。
- Monster Modal 遮罩、捲動鎖定、基本資料與收合區。
- 沉默洞穴 NPC、可羅蘭斯與 6 個製作品。
- Item Modal 與既有 Equipment Detail 串接。
- 單一搜尋、Deep Link、Reload、舊 URL 導向與 `worldAtlas=0`。
- 必要本機資源均為 HTTP 200：HTML、World Atlas CSS／JS、Monster 三份 JSON、Equipment index、NPC／Recipe／Item JSON。
- 測試期間未觀察到未處理 Console Error，必要資源沒有 404；三個怪物正式圖片均實際載入。

尚需人工補驗：390×844 實際 viewport、實體滑鼠 hover Tooltip 的視覺位置，以及瀏覽器工具列 Back／Forward（程式 popstate 與自動測試已涵蓋）。

## 部署建議

World Atlas 功能範圍已達 RC 水準，但目前不建議直接正式部署。部署前最小阻擋為：釐清兩個既有 Dataset validator 失敗，以及補做 390×844、hover Tooltip、Back／Forward 的人工瀏覽器驗收。完成後不需新增架構即可重新判定。
