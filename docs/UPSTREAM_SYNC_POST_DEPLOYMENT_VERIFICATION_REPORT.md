# Upstream Sync Post-Deployment Verification Report

本報告記錄在完成公開部署 Sprint RC-1H (Part A) 後，針對作者資料同步能力進行的完整乾跑（Dry-run）與驗證成果。

## 1. 部署身分與正式網址

- **公開部署 Commit**: `fd208776efb30dd0e44381fbfa9cc10568d3c60d`
- **GitHub Pages 正式網址**: [wiki.html](https://dimeraclaw.github.io/Idle-lineage-wiki/wiki.html)
- **驗證時間**: 2026-07-15

## 2. 作者來源與 Revision 追蹤

- **作者來源 Repository**: [shines871/idle-lineage-class](https://github.com/shines871/idle-lineage-class)
- **作者來源分支**: `main`
- **上次 approved revision (bootstrap 基線)**: `9252a99c152bca1256a900c94335cadff52558e9` (GameVersion `v3.2.79`)
- **本次 revision (同步目標基線)**: `c3d4f96f13aefabf1453a4a3f1f54d688fd573f6` (GameVersion `v3.4.17`)

---

## 3. 同步工具與命令

本次同步驗證使用本專案工具鏈進行離線乾跑驗證，主要命令及呼叫流程如下：

### 3.1 來源 Manifest 產生與驗證
```bash
# 產生 Release Source Manifest
python tools/generate_source_manifest.py \
  --source-root temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot \
  --repository-url https://github.com/shines871/idle-lineage-class \
  --branch main \
  --commit-sha c3d4f96f13aefabf1453a4a3f1f54d688fd573f6 \
  --retrieval-method git_archive \
  --file-list temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/source-files.txt \
  --retrieved-at 2026-07-14T06:51:33+08:00 \
  --commit-date 2026-07-14T03:53:40+08:00 \
  --output temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/source-manifest-a.json

# 驗證 Source Manifest
python tools/validate_source_manifest.py \
  --manifest temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/source-manifest-a.json \
  --source-root temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot
```

### 3.2 候選 Dataset 產生
```bash
# 產生 Monster 候選 Dataset
python tools/generate_monster_data.py \
  --source-root temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot \
  --output-dir temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/data/monster \
  --source-revision c3d4f96f13aefabf1453a4a3f1f54d688fd573f6

# 產生 Equipment 候選 Dataset
python tools/generate_equipment_data.py \
  --source-root temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/snapshot \
  --project-root . \
  --output-dir temp_online/u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2/candidate/data/equipment
```

---

## 4. Source Manifest 驗證結果

- **Manifest 狀態**: `passed` (完全有效)
- **阻擋診斷 (blockingCount)**: `0`
- **Manifest 雜湊值 (SHA-256)**: `4b4fa3f587518491f1f6740567d881a4e4a3a6de1cd947413926b55ddc4ccd08`
- **15-File Audit Scope**: 包含 `index.html`、`js/00-data.js`、`js/01-drops-config.js` 等 15 個核心邏輯及資料檔案，無多餘或無關檔案。

---

## 5. Domain Diff 統計與資料狀態

相較於 bootstrap 基線（`v3.2.79`），本次同步至 `v3.4.17` 之各 Domain 差異與資料狀態統計如下：

### 5.1 Raw Source Diff
- 總路徑變化數：`2,065` 個檔案。
  - Modified: 33
  - Added: 1,951 (多為 Monster 動畫、背景替代資產、NPC sprite 等視覺資源)
  - Deleted: 80
  - Renamed: 1 (`assets/icons/armors/鋼鐵塊.png` -> `assets/icons/items/鋼鐵塊.png`)

### 5.2 Canonical Dataset Diff
| Domain | 指標 | 基線 (v3.2.79) | 候選 (v3.4.17) | 增量 (Delta) |
|---|---|---|---|---|
| **Monster** | 怪物總數 | 460 | 469 | +9 |
| **Boss** | 首領總數 | 70 | 72 | +2 |
| **Map** | 地圖總數 | 214 | 217 | +3 |
| **Drop** | 掉落 Table 數 | 433 | 441 | +8 |
| **DropEntry** | 掉落 Entry 數 | 3,655 | 3,812 | +157 |
| **Equipment** | 裝備總數 | 786 | 825 | +39 |

---

## 6. unresolved 與 blocking conflicts 稽核

### 6.1 unresolved (未解析項目)
- **`wpn_giltas_wand` (吉爾塔斯魔杖)**: 由於來源未提供 `isWand` 標記或對應的 `WEAPON_TAGS` 分類，其 `equipmentType` 保持 `unresolved`，未通過名稱猜測分類。
- **Safe Enhance**: 4 筆裝備遺失安全強化值（safeLevel 及 enhanceable 均為 null）。
- **Class Requirements**: 4 筆裝備遺失職業限制。
- **Descriptions**: 277 筆裝備描述在 `DB.items` 中為空，顯示為「尚無說明」。

### 6.2 blocking conflicts (阻擋衝突)
- **「地獄奴隸」DisplayName 衝突**:
  - 新版來源中包含兩個名為「地獄奴隸」的怪物 ID：`de_train_hellslave` 與 `sanct_hellslave`。
  - 由於 drop owner 解析使用 exact name mapping，造成關聯唯一性衝突，在 mapping 中已被標記為 conflict 並妥善隔離，未影響 dataset 的建置。

---

## 7. Validator 與測試套件執行結果

本專案的所有本地測試及驗證程式均順利通過：

### 7.1 JavaScript 測試套件 (Hermes Node)
- **`test_equipment_ui_rc.js`**: `passed` (72/72 tests passed)
- **`test_equipment_view_adapter.js`**: `passed` (71/71 tests passed)
- **`test_monster_merged_preview.js`**: `passed` (9/9 tests passed)
- **`test_monster_ui_beta.js`**: `passed` (21/21 tests passed)
- **`test_monster_ui_rc.js`**: `passed` (15/15 tests passed)
- **`test_wiki_data_core.js`**: `passed`

### 7.2 Python 測試套件
- **`test_equipment_data.py`**: `passed` (30/30 tests passed)
- **`test_equipment_fixtures.py`**: `passed` (25/25 tests passed)
- **`test_equipment_view_payload.py`**: `passed` (30/30 tests passed)
- **`test_legacy_entity_mappings.py`**: `passed` (30/30 tests passed)
- **`test_monster_data.py`**: `passed` (7/7 tests passed)
- **`test_release_diff.py`**: `passed` (45/45 tests passed)
- **`test_source_inventory.py`**: `passed` (18/18 tests passed)
- **`test_source_manifest.py`**: `passed` (22/22 tests passed)

---

## 8. Deterministic 與 Byte Stability 驗證

- **驗證結論**: 裝備與怪物 Dataset 生成流程具有 **100% 的確定性與 Byte Stability**。
- **驗證證據**: 
  - 本次離線乾跑產生的所有 JSON 檔案（`equipments.json`、`monsters.json`、`diagnostics.json` 等）與正式已發布的 Dataset 進行比對，結果為 **完全一致 (Byte-Identical)**。
  - 重複生成兩次的 SHA-256 雜湊值完全相同，且輸出檔案符合 `UTF-8`、`LF` 單一結尾換行的契約規範。

---

## 9. 綜合評估與發布聲明

### 9.1 Candidate 建立與讀取狀態
- **建立狀態**: 成功建立。
- **讀取狀態**: 候選 Dataset 可於 Preview／Shadow 環境下正常讀取並渲染。
- **Dataset Gap**: 無。本次生成的 Dataset 與生產環境 Dataset 零誤差。

### 9.2 明確聲明與發布狀態
> [!IMPORTANT]
> **本次驗證並未發布任何新的 Candidate Dataset。**
> 生產環境的 Dataset 在先前的同步發布中已成功更新至 `v3.4.17` (`c3d4f96...`)。本次作業純屬公開部署後的同步能力完整性驗證，以確保管線在正式部署後依然具備百分之百的 byte-stability 與一致性。

### 9.3 下一次正式資料同步發布建議
- 目前本專案的生產 Dataset 與程式碼已精確對齊作者的最新 Revision `c3d4f96...` (GameVersion `v3.4.17`)。
- 在作者發布新的 upstream 變更或 commit 之前，**不建議也不需要進行下一次正式資料同步發布**。本專案目前處於完全同步且健康的狀態。
