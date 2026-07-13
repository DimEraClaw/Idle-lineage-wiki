# Equipment Stage E2：後續最小實作計畫

## 1. 原則

- 固定維持 786 筆 Equipment identity。
- 不重寫目前可用的 Equipment UI。
- 每階段可獨立驗收、可回退，不把 Schema、生成、Repository 與 UI 切換綁成一次改動。
- Mechanic／Interaction 可逐筆補充；缺少它們不阻止 base Dataset，但必須保持 partial／unresolved。
- 所有關聯使用 ID／EntityRef，不使用中文名稱 fallback。

## 2. E3-A：Dataset foundation fixtures

允許內容：

1. Equipment Schema 草案，只覆蓋本契約 20 個 top-level 欄位。
2. source extraction fixture：固定來源檔、symbol、revision、gameVersion 與 786 allowlist。
3. classification mapping：raw type、slot、legacy subtype、`WEAPON_TAGS`、明示例外到正式 vocabulary。
4. unresolved fixture：safe／req／slot／type／price／description／relation／mechanic／weight diagnostics。
5. 5 筆 price conflict fixture。
6. arrow、pet equipment、armguard、two-hand／offhand 等特殊分類案例。

驗收：

- fixture 不執行 `wiki.html` UI、DOM、player state 或完整遊戲 loop。
- 786 ID 全部 exact resolve，沒有第 787 筆，也沒有 SkillBook／Doll／remains。
- mapping 不使用中文名稱 regex 生成 identity／type。
- missing、null、derived zero、not applicable、unresolved 可區分。
- 此階段不建立正式 Dataset。

## 3. E3-B：deterministic pipeline

允許內容：

1. deterministic generator。
2. validator。
3. 786 筆 Equipment Dataset。
4. unresolved／diagnostic output。
5. deterministic、byte-stability、duplicate ID、invalid ref、scope、mapping coverage、price conflict tests。

Generator 僅重現核准純資料步驟；不執行 UI 或玩家狀態。Validator 至少檢查：Schema、20-field ceiling、ID 唯一、786 scope、EntityRef、自反 identity、vocabulary、field provenance、class keys、safe semantics、relation owner、排序與 byte stability。

驗收：相同 revision 與 fixtures 產生 byte-identical output；Mechanic 未解不阻止 identity 生成，但 Dataset 不得標 complete。

## 4. E3-C：Repository 與 shadow comparison

允許內容：

1. Equipment Repository，只讀正式 Dataset，不操作 DOM。
2. 以 ID、名稱、group、type、slot、class 建索引。
3. 與既有 `EQUIP_DATA` 做 shadow comparison，不切換玩家 UI。
4. 比較 786 筆 identity、分類、搜尋集合、顯示基礎欄位與已知 diagnostics。

驗收：Repository 載入失敗不影響現有 Wiki；shadow mismatch 可定位 field path／source，不以名稱模糊修復。

## 5. E3-D：受控 UI 切換

允許內容：

1. 以 feature flag／受控接線逐步切換既有 Equipment UI data source。
2. 保留舊 `EQUIP_DATA` fallback，直到 parity 與 baseline 通過。
3. 加入穩定 Equipment deep link。
4. 來源跳轉只用 EntityRef／Navigation Helper。
5. 驗證搜尋、分類、Detail、URL、Console、Network 與既有 Craft／Monster／Cards baseline。

不重新設計 CSS、不重寫現有 Equipment UI、不把 unresolved 顯示成已驗證。

## 6. 執行順序與 gates

```text
E3-A fixtures / Schema
  → E3-B generator / validator / Dataset
  → E3-C Repository / shadow comparison
  → E3-D controlled UI switch
```

- E3-A 未覆蓋 786 classification 與特殊 slot，不進 E3-B。
- E3-B 未 byte-stable、validator 未通過，不進 E3-C。
- E3-C 未達 identity／search／classification parity，不進 E3-D。
- E3-D 沒有 fallback、Console=0、Network 404=0 與 baseline，不正式啟用。

## 7. 第一個最小實作

下一步只做 **E3-A：Equipment Schema＋source extraction fixture＋classification mapping＋unresolved fixture**。不先做 generator，不先切 UI。其成果應讓後續 generator 能在不執行完整遊戲的情況下，決定性重建 786 筆 base Equipment。

## 8. E2 階段結論

E2 只新增三份文件，沒有建立或修改 Schema、Generator、Validator、JSON、Repository、WikiDataCore、HTML、CSS、JavaScript、既有 Dataset 或 UI，也不執行 commit／push。
