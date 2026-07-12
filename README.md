# Idle Lineage Wiki

## 專案用途
這個專案是一個以靜態網頁形式呈現的「放置天堂 / Idle Lineage 類型遊戲」資料百科站。它的目標是把裝備、製作配方、怪物與卡片資料整理成可查詢的網頁，方便玩家快速查找素材來源與遊戲內容資訊。

## 與原遊戲的關係
本專案不是原遊戲官方內容，而是一個非官方、以網頁為基礎的資料整理與展示專案。內容主要以現有資料集與本地化整理結果為基礎，提供玩家查詢與參考。

## 目前主要入口
目前的主要百科入口是 [wiki.html](wiki.html)。

- [index.html](index.html) 主要是遊戲主體入口。
- [wiki.html](wiki.html) 是目前實際可用的百科主頁，整合了裝備百科、製作百科與怪物/卡片資料。
- [equip_wiki.html](equip_wiki.html)、[craft_wiki.html](craft_wiki.html)、[cards_guide.html](cards_guide.html) 目前為舊入口，會轉導向到 [wiki.html](wiki.html)。

## 目前功能
- 裝備百科：顯示裝備資料、屬性、來源與搜尋篩選。
- 製作百科：顯示製作配方與材料需求。
- 怪物與卡片百科：顯示地區、怪物、掉落與卡片相關資訊。
- 搜尋與篩選：支援關鍵字搜尋、分類篩選與進階篩選。
- 席琳套裝進度：可手動記錄已收集遺骸部位。

## 專案目錄說明
- [index.html](index.html)：遊戲主畫面與主流程入口。
- [wiki.html](wiki.html)：百科主頁與資料展示入口。
- [css/](css/)：網站樣式檔。
- [js/](js/)：主遊戲與百科互動邏輯。
- [download.py](download.py) 與其他 Python 腳本：資料整理與抽取用途。
- [docs/](docs/)：專案文件與開發說明。

## 如何本機開啟
可直接以靜態檔案方式開啟：

1. 雙擊 [index.html](index.html) 或 [wiki.html](wiki.html) 開啟。
2. 或者使用本機簡易伺服器：

```bash
python -m http.server 8000
```

然後在瀏覽器開啟：

```text
http://localhost:8000/
```

## 如何部署 GitHub Pages
1. 將專案推送到 GitHub。
2. 進入 Repository 的 Settings > Pages。
3. 選擇 Deploy from a branch。
4. 選擇 main 分支與 root 目錄。
5. 等待 Pages 建立完成後即可使用 GitHub Pages 連結開啟。

> 本專案目前以靜態 HTML / CSS / JavaScript 方式運作，適合直接部署於 GitHub Pages。
