# Release Hub Stage A：版本來源與同步基線盤點

## 1. 文件目的與盤點範圍

本文件盤點《放置天堂整合百科》目前可用的遊戲版本、來源修訂、Wiki 版本、Schema 版本、同步流程、Dataset 生成能力與上一版快照，作為 Release Hub Stage B「Semantic diff 設計」的輸入。

盤點日期：2026-07-13（Asia/Taipei）。本次只進行本機唯讀檢查與原作者公開 GitHub 查核，未執行 fetch、pull、下載、同步、生成器、validator、commit 或 push。

## 2. 結論摘要

| 問題 | 結論 |
|---|---|
| 是否有正式遊戲版本？ | 有。遊戲程式的單一真相常數為 `GAME_VERSION = 'v3.2.79'`。 |
| 最可靠的 source revision？ | 原作者 repository `main` 的 commit `9252a99c152bca1256a900c94335cadff52558e9`。 |
| 是否有正式 Release？ | 原作者 GitHub 顯示沒有任何 Release。 |
| 是否有可驗證 tag？ | 本次沒有找到可驗證 tag；不得假定 `v3.2.79` 是 Git tag。 |
| Wiki 是否有正式版本？ | 沒有玩家可用的 Wiki version、tag 或 Release；只有 Git commit SHA。 |
| Schema 是否有版本？ | 沒有專案層 `schemaVersion`；只有 JSON Schema draft 2020-12 宣告。 |
| 哪個 Dataset 可重現生成？ | 目前只有 Craft Dataset 有已知 deterministic generator 與 validator。 |
| 是否有可比較上一版？ | Git 對網站程式有歷史快照；Craft 正式 JSON 只有第一代基線，沒有兩個帶來源 revision 的發布快照。 |
| 能否立即做可靠 semantic diff？ | 不能。缺少來源 manifest、revision 綁定、Domain diff 規則與已發布基線。 |

## 3. 本專案 Git 現況

### 3.1 Remote 與 branch

```text
origin  https://github.com/DimEraClaw/Idle-lineage-wiki.git
branch  main
HEAD    61b2c3f99dbf85ebf5acebdea96b9268d12696b9
tracking origin/main
local   ahead 3
```

盤點時 `origin/main` 指向：

```text
93b4079589f5705fae13d1e16de2841090374386
```

### 3.2 本機 tag 與 describe

- `git tag --list` 無輸出，表示本 Wiki repository 沒有本機 tag。
- `git describe --tags --always --dirty` 只回傳 commit 短 SHA，沒有可用 tag。
- Git commit SHA 可作 Wiki source revision，但目前不能當作玩家 Wiki version。

### 3.3 工作區注意事項

盤點開始前已有未追蹤文件：

```text
docs/EQUIPMENT_INTERACTION_CONTRACT.md
```

它與本次 Release Source Audit 無關，未修改、未暫存。

## 4. 原作者來源位置

### 4.1 Repository

- 原作者 repository：[`shines871/idle-lineage-class`](https://github.com/shines871/idle-lineage-class)
- 預設 branch：`main`
- GitHub Pages：[`https://shines871.github.io/idle-lineage-class/`](https://shines871.github.io/idle-lineage-class/)
- Repository 公開頁面顯示專案名稱「放置天堂經典版」與 Git 歷史。

### 4.2 可驗證最新 source revision

原作者公開 commit history 在盤點時顯示最新 commit：

```text
full SHA   9252a99c152bca1256a900c94335cadff52558e9
short SHA  9252a99
date       2026-07-12（GitHub commit history 顯示日期）
branch     main
```

Commit 頁面：[`9252a99c152bca1256a900c94335cadff52558e9`](https://github.com/shines871/idle-lineage-class/commit/9252a99c152bca1256a900c94335cadff52558e9)

該 commit 的 `index.html` 將核心資源 cache token 更新到 `v3.2.79-*`，並修改 `js/00-data.js`、`js/03-combat-core.js`、`js/13-shop-save.js`。這使 commit SHA 成為目前最可靠、可重取且可比較的 source revision。

### 4.3 Tags 與 Releases

- 原作者 GitHub Releases 頁面明確顯示「There aren’t any releases here」。
- Repository 頁面也顯示「No releases published」。
- 本次未取得任何可驗證 tag 清單或 tag 指向；因此 tag 狀態列為「未找到／無法確認」，不可把程式版本字串當成 tag。
- Commit history 可用，公開頁面盤點時顯示 425 commits。

## 5. 目前同步方式

### 5.1 `download.py`

目前明確的原作者同步工具是根目錄 `download.py`：

- 來源固定為原作者 GitHub Pages URL。
- 逐檔下載指定 `js/*.js` 與 `afk-*.js`，直接覆寫本專案同名檔案。
- 不 clone 原作者 repository。
- 不指定 commit SHA、tag 或 immutable URL。
- 不下載 `index.html`、CSS、assets 或所有後續新增檔案。
- 不記錄下載時間、HTTP metadata、content hash 或 source revision。
- 單檔失敗只印出錯誤並繼續，沒有完整性 manifest 或 transaction。
- 沒有驗證下載內容是否都來自同一個 deploy／revision。

因此，此腳本只能視為「從目前部署站抓取選定檔案」的人工同步工具，不能證明同步到哪個 Git revision，也不能獨立重現歷史版本。

### 5.2 Git 歷史中的同步事件

本 Wiki Git history 有一筆可辨識同步 commit：

```text
3129429f6534a56d891dd846f0a2ae79c014f51e
Update: Sync game scripts and compiled unified wiki to version v3.2.79
2026-07-12T16:52:08+08:00
```

此 commit 同步多個遊戲 JS、CSS、`index.html` 與 `wiki.html`，可作本 Wiki 的工程快照；但 commit 內容與訊息沒有記錄原作者 full SHA，不能證明它精確對應原作者哪一個 commit。

### 5.3 同步來源風險

- GitHub Pages 是 mutable deployment endpoint；同一 URL 日後可返回不同內容。
- 檔案逐一抓取可能跨越部署時間點，形成混合 revision。
- cache token 可提示模組版本，但不是 immutable revision，也不是全站一致 build number。
- 本專案 `origin` 是 Wiki repository，不是原作者 remote；無法用本機 remote tracking 直接判斷原作者最新狀態。

## 6. 版本與發布標記盤點

### 6.1 遊戲版本字串

在 `js/00-data.js` 找到：

```js
const GAME_VERSION = 'v3.2.79';
```

`js/14-craft-pandora.js` 會把 `GAME_VERSION` 顯示到登入頁版本欄位，且程式註解稱其為「單一真相來源」。因此 `v3.2.79` 可列為直接驗證的 GameVersion 候選。

`index.html` 中 `v2.4.0` 只是 JavaScript 失效時的後備文字，不是目前版本。

### 6.2 Module cache tokens

`index.html` 的 script URL 含多個不同 token，例如：

```text
v3.2.79-neckslot
v3.2.78-catchupbudget
v3.2.74-squadsig
20260702a
```

這些值適合工程 cache busting 與模組變更追蹤，不是全站 GameVersion，也不應直接顯示為玩家版本。

### 6.3 其他 version 常數

- `SAVE_VERSION = 2`：存檔格式／migration 版本，不是遊戲版本。
- `window.__afkm.version = '1.0.0'`、`afk-offline.js` 的 `1.1.0`、`AFK_SLOTINFO.version = '1.0.0'`：附加模組版本，不是 GameVersion。
- WikiDataCore Dataset `version: 1`：核心註冊／adapter 的資料版本值，不是 Wiki release 或 Schema version。

### 6.4 Build number

未找到全站正式 build number。日期型 cache token、commit SHA、模組版本與 `SAVE_VERSION` 都不應被重新命名成 build number。

### 6.5 Release date

- 遊戲程式內未找到可驗證的 `releaseDate` 常數。
- 原作者最新 commit history 顯示日期 2026-07-12；這是 source revision date，不自動等於遊戲正式 release date。

### 6.6 Changelog／更新紀錄

- 原作者沒有 GitHub Release notes。
- 本專案沒有正式 CHANGELOG 或 release data。
- Git commit history 與大量程式內 `vX.Y.Z` 註解可協助研究，但屬工程證據，不能直接當玩家更新紀錄。
- 本 Wiki commit messages 是 Wiki 工程更新，不是原作者遊戲 changelog。

## 7. Wiki 版本與 Schema 版本現況

### 7.1 Wiki version

目前沒有：

- Wiki version 常數。
- Wiki tag。
- GitHub Release。
- `data/releases/*` 發布資料。
- Release Hub 的 latest／sync-status read model。

目前 Wiki HEAD `61b2c3f99dbf85ebf5acebdea96b9268d12696b9` 只能列為 Wiki source revision。第一個 Wiki version 的命名規則尚未定案，不得以該 SHA 或 `v3.2.79` 冒充玩家 Wiki version。

### 7.2 Schema version

Craft schemas 宣告：

```json
"$schema": "https://json-schema.org/draft/2020-12/schema"
```

這只代表採用的 JSON Schema dialect，不是本專案 schemaVersion。目前 schemas 沒有 `$id`、版本常數、manifest 或 migration history，故正式 Schema version 缺失。

## 8. Dataset 同步與生成現況

### 8.1 Dataset 總覽

| Dataset／領域 | 目前來源 | 可重現生成 | Validator | source revision | 判定 |
|---|---|---:|---:|---:|---|
| Craft recipes/items/npcs/drops/unresolved | `wiki.html` 內嵌 `CRAFT_DATA`、`EQUIP_DATA`、`NPC_ORDER` | 是 | 是 | 否 | 可自動重建，但不能證明遊戲來源版本 |
| Equipment | `index.html`／`js/00-data.js` 與 `wiki.html` 內嵌資料 | 否 | 否 | 否 | 直接內嵌／鏡像資料，需先盤點 owner 與 extractor |
| Skill | `js/00-data.js` 等遊戲程式與 Wiki 內嵌資料 | 否 | 否 | 否 | 直接內嵌，缺正式 Dataset |
| Monster／Drop | `js/00-data.js`、`js/01-drops-config.js`、Wiki 資料 | 否 | 否 | 否 | 多來源直接程式資料，需 Domain 正規化 |
| Recipe（遊戲端） | `js/14-craft-pandora.js` 與 Wiki Craft 資料 | 否 | 否 | 否 | 兩套來源需先確認權威與 parity |
| NPC／Quest | `js/11-world-map.js`、`js/12-npc-quests.js`、Wiki 內嵌資料 | 否 | 否 | 否 | 直接程式資料，缺正式 Entity Dataset |
| Card | `js/15-cards.js` 與 `wiki.html` | 否 | 否 | 否 | 直接內嵌，缺 deterministic generator |
| System／Mechanics | 多支遊戲 JS | 否 | 否 | 否 | 程式解析與研究為主，尚無正式資料模型實作 |
| Research／Interactions | 文件規劃 | 否 | 否 | 不適用 | 尚未建立資料 |
| Releases | 文件規劃 | 否 | 否 | 不適用 | 本階段禁止建立 |

### 8.2 Craft 可重現範圍

`tools/generate_craft_data.py`：

- 從指定 `wiki.html` 以限制式 parser 讀取 `CRAFT_DATA`、`EQUIP_DATA`、`NPC_ORDER`。
- 產出 deterministic、排序固定的五個 Craft JSON。
- 有固定數量 regression assertions。
- 不執行 JavaScript。

`tools/validate_craft_data.py`：

- 驗證 Schema、ID、references、索引、cycle、yield、unresolved 與固定基線。
- 計算輸出檔 SHA-256。

但兩者都沒有記錄：

- 原作者 repository URL。
- source commit SHA／tag。
- source snapshot hash manifest。
- generator version。
- Schema version。
- generatedAt／publishedAt。

所以 Craft 是目前唯一「可由本專案輸入重建」的 Dataset，但不是「可由原作者 revision 端到端重建」的 Dataset。

### 8.3 直接內嵌資料

目前仍直接存在 HTML／JavaScript 的主要資料包括：

- `js/00-data.js`：遊戲核心 DB、`GAME_VERSION` 與大量 Equipment／Skill／Monster 等資料。
- `js/01-drops-config.js`：掉落、設定與存檔版本資料。
- `js/11-world-map.js`、`js/12-npc-quests.js`：NPC、地圖與任務規則。
- `js/14-craft-pandora.js`：遊戲端製作規則。
- `js/15-cards.js`：卡片資料與行為。
- `wiki.html`：Wiki 的 Equipment、Craft、Cards 等內嵌資料與 UI 邏輯。

這些檔案雖受 Git 追蹤，但缺少正式 generator、Schema、Dataset manifest 與 semantic diff 契約。

## 9. 上一版快照現況

### 9.1 可用的工程快照

Git history 保存 `index.html`、遊戲 JS、`wiki.html` 的歷史版本，因此可在 commit 間做工程比較。例如同步 commit `3129429...` 與其 parent 可比較檔案內容。

這些歷史 commit 的限制：

- 未綁定原作者 full SHA。
- 可能混合原作者同步、Wiki 編輯與人工修正。
- 沒有 Dataset manifest 指出各檔案是否來自同一來源版本。
- 沒有區分 source snapshot、normalized snapshot 與 published snapshot。

因此它們可當研究材料與 bootstrap baseline，不能直接宣稱為完整的上一版 GameVersion snapshot。

### 9.2 Craft snapshot

Craft JSON 首次在 Wiki commit `6ccd57fea874d82be78750402d8f7a8a562056b7` 納入 Git。後續 Git commit 可重取該份資料，但目前沒有兩個已發布且帶不同 source revision 的 Craft snapshots。

結論：

- **有**目前 Craft baseline。
- **沒有**可直接做 release-to-release semantic diff 的前一個正式 Craft release snapshot。
- 第一個 Release 應建立 bootstrap baseline，不應假造「上一版玩家更新」。

## 10. 版本資料分類

### A. 可直接驗證的版本資料

- 遊戲 `GAME_VERSION = 'v3.2.79'`，來源 `js/00-data.js`。
- 原作者 repository 與預設 `main` branch。
- 原作者最新 commit full SHA `9252a99c152bca1256a900c94335cadff52558e9`。
- 原作者 commit history 顯示該 commit 日期為 2026-07-12。
- 原作者沒有 GitHub Release。
- Wiki HEAD、branch、origin 與 Git commit dates。
- 本 Wiki 沒有 tag。

### B. 只能作為 source revision 的資料

- 原作者 commit SHA 與 commit date。
- Wiki commit `3129429...` 的「同步 v3.2.79」工程快照。
- Wiki HEAD `61b2c3f...`。
- GitHub Pages 當下下載內容的檔案 hash（目前尚未記錄）。
- 各 script cache-busting token。

這些資料可定位來源或工程狀態，但不等於玩家 GameVersion／WikiVersion／releaseDate。

### C. 缺少或無法確認的資料

- 原作者可用 tag。
- 原作者正式 releaseDate。
- 原作者 changelog／release notes。
- Wiki 正式版本與發布標記。
- 專案 schemaVersion。
- 全站 build number。
- 現有本機鏡像精確對應的原作者 full SHA。
- 每個 Dataset 的 source revision、lastSyncAt 與 sync status。
- 可作正式上一版的 published Dataset snapshot。
- Equipment、Skill、Monster、NPC、Quest、Card、Mechanics 的 semantic diff 規則。

### D. 不應顯示給玩家的工程資訊

- raw Git diff、檔案數、增刪行數。
- Wiki branch ahead／behind 數量。
- 本機 dirty status、未追蹤檔案與絕對路徑。
- cache-busting suffix（如 `neckslot`、`catchupbudget`）。
- `SAVE_VERSION`、AFK 模組版本、WikiDataCore Dataset version。
- generator regression assertions、檔案 hash、Schema dialect。
- download.py 的逐檔成功／失敗 log。
- 原作者 commit message 未經人工確認的內容。

以上資訊可用於 Evidence、診斷與追溯，但不能直接成為首頁玩家更新內容。

## 11. Semantic diff 前置條件

Stage B 必須先定案：

1. **Immutable source identity**：每次同步指定原作者 full SHA，而不是 mutable GitHub Pages latest。
2. **Source manifest**：記錄 repository、branch、commit SHA、commit date、取得方式、檔案清單與 content hash。
3. **Snapshot layers**：分開 source snapshot、normalized Dataset snapshot、published Wiki snapshot。
4. **Baseline selection**：第一個 bootstrap baseline 的 Git commit、source revision 與 Dataset hashes。
5. **Domain ownership**：Equipment、Skill、Monster、Recipe、NPC、Quest、Card 的正式 owner 與 EntityRef。
6. **Stable IDs**：不得用中文名稱合併跨版本 Entity。
7. **Field semantics**：逐 Domain 定義有序／無序 collection、derived field、display-only field、玩家可見 field。
8. **Normalization**：忽略 object key order、格式、換行、非語意排序及生成時間。
9. **Rename／remove rules**：renamed 必須有 identity evidence；removed 必須能保留 tombstone／歷史 EntityRef。
10. **Evidence workflow**：raw diff → entity diff → human review → ChangeRecord。
11. **Version contracts**：GameVersion、WikiVersion、SchemaVersion 的 ID 與發布規則。
12. **Dataset status aggregation**：必要 Dataset 清單與 failed／partial／review_required 優先序。

目前只有 Craft 較接近 normalized semantic diff，但仍缺來源 manifest 與兩個正式發布 snapshot。其他 Domain 尚不足以做可靠 semantic diff。

## 12. Unresolved 問題

### 12.1 Source 與版本

- `v3.2.79` 是否有對應官方 tag？本次無法驗證。
- 原作者是否把每個 `GAME_VERSION` commit 視為正式 release？沒有 Release notes 可確認。
- GitHub Pages 當下內容是否精確對應 commit `9252a99...`？現行流程未保存證據。
- Wiki 同步 commit `3129429...` 來自原作者哪一個 full SHA？未記錄。
- 原作者 commit 的精確 timestamp／timezone 尚未寫入本機 manifest；公開 history 只足以確認日期。

### 12.2 Wiki 與 Schema

- 第一個 WikiVersion 採獨立版本號、Release ID 或 commit-based revision，尚未定案。
- SchemaVersion 的變更條件與 migration 規則尚未定案。
- 哪些 Dataset 是 Release Hub `up_to_date` 的必要集合，尚未定案。

### 12.3 Dataset

- `wiki.html` Craft 資料與原作者遊戲端 `js/14-craft-pandora.js` 的權威關係未驗證。
- Equipment／Skill／Monster 等資料的 owner、extractor 與 stable ID coverage 未完成。
- 內嵌資料是否含 Wiki 人工補充，不能一律視為原作者 source mirror。
- 歷史 Git snapshot 中哪些 commit 可當乾淨同步點，需要人工稽核。

## 13. 第一個 Release 建立方式

第一個 Release 應是 **bootstrap baseline release**，不是「從不存在的上一版推導出的完整更新紀錄」。

建議步驟：

1. 選定並保存一個可重取的原作者 full SHA；現階段最佳候選為 `9252a99c152bca1256a900c94335cadff52558e9`。
2. 從該 SHA 建立 immutable source manifest，記錄 commit date 與所需檔案 hash。
3. 驗證該 source 中 `GAME_VERSION`；若仍為 `v3.2.79`，以此作 GameVersion，不以 commit date 當 releaseDate。
4. 定義第一個 WikiVersion 與 SchemaVersion；在決策完成前保持 unresolved，不自行編號。
5. 對 Craft 執行可重現生成與 validator，保存 normalized hashes；本 Stage A 不實際執行。
6. 對其他 Domain 只標記 `partial`／`review_required`／`unknown`，不得宣稱已完成。
7. 第一個 Release 的 ChangeRecord 只收錄有 EntityRef、Evidence 與人工確認的項目。
8. 無可靠上一版時，不產生「新增 N 項／調整 N 項」的全量歷史推論；可將 Release 描述為「建立同步基線」。
9. 發布前驗證 SyncStatus 聚合，只有必要 Dataset 全部完成才可顯示 `up_to_date`。

## 14. Stage B 前阻擋問題

### Blocking

1. 尚未建立原作者 immutable source manifest 與 source SHA 綁定流程。
2. 尚未選定正式 bootstrap source snapshot；`9252a99...` 只是目前最佳候選。
3. WikiVersion 與 SchemaVersion identity 尚未定案。
4. 除 Craft 外沒有 normalized Dataset snapshot 與 deterministic generator。
5. Craft 生成來源未綁定原作者 revision，且與遊戲端 Recipe 權威關係未確認。
6. 沒有兩個正式 published Dataset snapshots 可直接比較。
7. 各 Domain 的 semantic normalization、有序欄位、derived fields 與玩家可見欄位尚未定義。

### Non-blocking but required before player release

- 原作者沒有 tag／Release，可用 full commit SHA 作 source revision，不阻止建立基線。
- 正式 releaseDate 缺失時可為 null，不得用 commit date代替。
- 部分 Dataset 可先標記 partial／unknown，不阻止工程原型，但阻止全站 `up_to_date`。

## 15. 是否可以進入 Stage B

**可以進入 Stage B 的契約設計與 fixture 規劃，但不能直接進入自動同步、資料生成或玩家發布實作。**

Stage B 的第一項工作必須是定義 source manifest、bootstrap baseline、GameVersion／WikiVersion／SchemaVersion identity，以及各 Domain semantic diff policy。若 Stage B 被理解為立即產生 Release JSON 或首頁內容，則目前仍被上述 Blocking 問題阻擋。
