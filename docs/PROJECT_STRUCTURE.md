# 專案架構說明

## 1. 入口頁
### [index.html](index.html)
- 主要作為遊戲主體入口。
- 包含角色創建、遊戲介面、遊戲流程與主畫面 UI。
- 透過一系列 JavaScript 檔案載入遊戲邏輯。

### [wiki.html](wiki.html)
- 目前是主要百科入口。
- 整合了裝備百科、製作百科、怪物與卡片資料。
- 內建搜尋、分類、篩選、詳細資料 modal 與掉落來源 drawer。

### 舊 wiki 頁面
- [equip_wiki.html](equip_wiki.html)
- [craft_wiki.html](craft_wiki.html)
- [cards_guide.html](cards_guide.html)

這些頁面目前主要是為了兼容舊網址，實際上會轉導向到 [wiki.html](wiki.html)。

## 2. 樣式與介面
### [css/](css/)
- [css/style.css](css/style.css)：主樣式。
- [css/floating-ui.css](css/floating-ui.css)：浮動 UI 樣式。
- [css/tailwind-built.css](css/tailwind-built.css)：已編譯的 Tailwind 樣式。

## 3. JavaScript 模組
### [js/](js/)
目前主要按功能分成多個模組，例如：
- [js/00-data.js](js/00-data.js)：核心資料與儲存層。
- [js/01-drops-config.js](js/01-drops-config.js)：掉落設定。
- [js/02-stats-recompute.js](js/02-stats-recompute.js)：數值重算。
- [js/03-combat-core.js](js/03-combat-core.js)：戰鬥核心。
- [js/04-combat-attack.js](js/04-combat-attack.js)：戰鬥攻擊邏輯。
- [js/05-kill-progression.js](js/05-kill-progression.js)：擊殺與進度。
- [js/06-status-allies.js](js/06-status-allies.js)：隊伍與夥伴狀態。
- [js/07-skills-cast.js](js/07-skills-cast.js)：技能施放。
- [js/08-items-equip.js](js/08-items-equip.js)：物品與裝備。
- [js/09-vfx-render.js](js/09-vfx-render.js)：特效渲染。
- [js/10-ui-tabs.js](js/10-ui-tabs.js)：UI 分頁與介面。
- [js/11-world-map.js](js/11-world-map.js)：地圖。
- [js/12-npc-quests.js](js/12-npc-quests.js)：NPC 與任務。
- [js/13-shop-save.js](js/13-shop-save.js)：商店與儲存。
- [js/14-craft-pandora.js](js/14-craft-pandora.js)：製作與潘朵拉相關。
- [js/15-cards.js](js/15-cards.js)：卡片系統。
- [js/16-equip-book.js](js/16-equip-book.js)：裝備書。
- [js/17-audio.js](js/17-audio.js)：音效與音樂。
- [js/18-misc-book.js](js/18-misc-book.js)：雜項書籍。
- [js/19-equipment-window.js](js/19-equipment-window.js)：裝備視窗。
- [js/20-warehouse-window.js](js/20-warehouse-window.js)：倉庫視窗。
- [js/21-relic-book.js](js/21-relic-book.js)：遺物書。
- [js/22-pets.js](js/22-pets.js)：寵物。
- [js/23-summons.js](js/23-summons.js)：召喚。

## 4. 其他腳本
### 根目錄 Python 工具
- [download.py](download.py)
- [find_affixes.py](find_affixes.py)
- [find_bian.py](find_bian.py)
- [find_defines.py](find_defines.py)
- [get_combat_attack_evade.py](get_combat_attack_evade.py)
- [get_combat_hit_miss.py](get_combat_hit_miss.py)
- [search.py](search.py)
- [search_affix_lines.py](search_affix_lines.py)
- [search_bloody.py](search_bloody.py)
- [search_er.py](search_er.py)

這些腳本主要用來整理與抽取資料，為百科與遊戲內容提供來源。

## 5. GitHub Pages 部署
- 專案為靜態站點，適合直接部署於 GitHub Pages。
- 主要頁面為 [index.html](index.html) 與 [wiki.html](wiki.html)。
- 若要維持較好的相容性，建議以根目錄為部署來源。
