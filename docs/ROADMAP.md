# 開發 roadmap

## 核心百科能力：Knowledge Domain

Knowledge Domain 是角色能力查詢的正式 owner，也是 Equipment、Skill、Interaction 與 Mechanics 的共用知識層；不取代 Monster、Quest、Craft 等 Domain，也不提前實作 Analytics、Build Planner 或 Calculator。Stage K1 先定義 GameConcept、Mechanic、Formula、Research、Evidence 與 WikiDataCore 接入契約；K2 先盤點角色能力與戰鬥數值來源，之後再依序進入 deterministic data pipeline、repositories／search 與受控頁面接線。

保留 Monster C1 契約成果。下一個大型實作階段應在 Monster C2 與 Knowledge K2 中選擇一個最有玩家查詢價值的最小切片，不同時全面展開兩者。詳細順序見 `docs/KNOWLEDGE_DOMAIN_STAGE_K1_PLAN.md`。

## 首要玩家可見功能：Release Hub／版本與更新中心

Release Hub 建議作為第一個面向玩家的首頁功能，優先建立版本可信度與百科入口，再擴充其他首頁內容。正式契約見 `docs/RELEASE_HUB_CONTRACT.md`。

1. 盤點遊戲版本、來源 revision、Wiki 版本與 Schema 版本。
2. 建立 raw diff、semantic Entity diff、人工 review 與假更新過濾規則。
3. 經另行核准後建立 Release、ChangeRecord、SyncStatus 資料、Schema、生成與驗證。
4. 接入 WikiDataCore Releases Dataset、搜尋與 Navigation Helper。
5. 先發布版本 Hero、同步狀態、更新摘要、全站搜尋與快速百科入口。
6. 再加入分類更新、Dataset 狀態、尚待驗證內容與歷史版本。

遊戲版本與 Wiki 同步版本必須分開；任何 partial、review_required、failed、unknown 狀態都不得顯示為已完成同步。

### Release Hub Stage B：版本與基線契約

- 定義 immutable Source Manifest、full SHA、逐檔 SHA-256 與 retrieval policy。
- 第一個 Release 採 bootstrap baseline，不產生虛假的全量 added diff。
- WikiVersion 採獨立 SemVer；SchemaVersion 採 global＋per-Dataset 雙層。
- 建立跨 Domain semantic diff 共通規則，未完成 policy 的 Domain 明確維持 unresolved。
- Stage C 前先完成 P0 Dataset source ownership、input inventory、baseline fixture 與 status 判定。

## 跨階段里程碑：裝備互動與效果相容性

此里程碑依 `docs/EQUIPMENT_INTERACTION_CONTRACT.md` 推進，不改變既有階段優先序，也不得直接跳到 UI：

1. 盤點正式 equipment ID、裝備欄位、效果描述與研究問題。
2. 定義共享狀態、Buff、觸發、冷卻、資源與覆蓋規則的 Mechanic identity。
3. 以 Official、Code、Test、Unresolved 建立 Evidence 與版本差異紀錄。
4. 在另行核准後建立 Interaction 資料、Schema、生成器與驗證器。
5. 接入 WikiDataCore interactions repository、索引與 parity tests。
6. 只有在 Evidence、fallback、Console、Network 與 baseline 完成後，才受控加入裝備詳情呈現。

此里程碑不新增真實裝備 Interaction；任何缺少正式 ID 或 Evidence 的候選關係均維持 unresolved。

## 第一階段：裝備百科
目標：
- 持續整理與補充裝備資料。
- 確保搜尋、篩選與詳細資訊顯示正常。
- 讓裝備百科成為最穩定的入口頁面。

## 第二階段：製作百科
目標：
- 補足製作配方與材料需求資料。
- 建立更完整的 NPC 與配方關聯。
- 提升製作百科的查詢體驗。

## 第三階段：怪物百科
目標：
- 整理怪物、地點與掉落來源。
- 讓怪物查詢與地區資料更易用。
- 強化百科中的來源追蹤能力。

## 第四階段：卡片收藏
目標：
- 補全卡片與怪物關聯資料。
- 支援卡片收集與掉落查詢。
- 讓收藏資訊與怪物資料互相串接。

## 第五階段：資料同步
目標：
- 建立更穩定的資料來源與更新流程。
- 把 Python 整理腳本與網頁資料更好地連動。
- 未來可考慮把資料改為 JSON / 模組化結構，提升維護性。
