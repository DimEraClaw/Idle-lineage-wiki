#!/usr/bin/env python3
"""Generate the deterministic Monster C2-A dataset from current game sources."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "monster"
SCHEMA_VERSION = "1.0.0"

NODE_EXTRACTOR = r'''
const fs=require('fs'),vm=require('vm'),root=process.argv[1],read=p=>fs.readFileSync(root+'/'+p,'utf8');
const c={};vm.createContext(c);
for(const f of ['js/00-data.js','js/01-drops-config.js','js/15-cards.js']) vm.runInContext(read(f),c,{filename:f});
const DB=vm.runInContext('DB',c),drops=vm.runInContext('MOB_DROPS',c),cards=vm.runInContext('CARD_MOB_INFO',c),trial=vm.runInContext('TRIAL_ITEM_CLASS',c);
const world=read('js/11-world-map.js'),m=world.match(/const MAP_REGIONS\s*=\s*(\[[\s\S]*?\n\]);/);
if(!m) throw new Error('MAP_REGIONS not found');
const nav=vm.runInNewContext('('+m[1]+')'),labels={};
for(const group of nav) for(const entry of group.maps||[]) if(DB.maps[entry.v]) labels[entry.v]=entry.t;
console.log(JSON.stringify({mobs:DB.mobs,maps:DB.maps,drops,cardMonsterIds:[...new Set(Object.values(cards).map(x=>x.id))],itemIds:Object.keys(DB.items),trialItems:trial,mapLabels:labels}));
'''


class GenerationError(RuntimeError):
    pass


def extract(root: Path) -> dict[str, Any]:
    for rel in ("js/00-data.js", "js/01-drops-config.js", "js/11-world-map.js", "js/15-cards.js"):
        if not (root / rel).is_file():
            raise GenerationError(f"missing source: {rel}")
    run = subprocess.run(["node", "-e", NODE_EXTRACTOR, str(root.resolve())], capture_output=True, text=True, encoding="utf-8", check=False)
    if run.returncode:
        raise GenerationError(run.stderr.strip() or "source extraction failed")
    return json.loads(run.stdout)


def ref(entity_type: str, entity_id: str) -> dict[str, str]:
    return {"entityType": entity_type, "entityId": entity_id}


def verification(source: str, status: str = "Code", confidence: str = "high") -> dict[str, Any]:
    return {"verificationStatus": status, "source": source, "evidence": [source], "verifiedBy": "generate_monster_data.py", "verifiedVersion": None, "confidence": confidence}


def version() -> dict[str, Any]:
    return {"sourceRevision": None, "gameVersion": None, "schemaVersion": SCHEMA_VERSION, "validFrom": None, "validTo": None}


def relation_refs(*groups: list[dict[str, str]]) -> list[dict[str, str]]:
    values = {(x["entityType"], x["entityId"]): x for group in groups for x in group}
    return [values[key] for key in sorted(values)]


def build(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    mobs: dict[str, Any] = source["mobs"]
    maps: dict[str, list[str]] = source["maps"]
    drops: dict[str, list[list[Any]]] = source["drops"]
    item_ids = set(source["itemIds"])
    card_monsters = set(source["cardMonsterIds"])
    trial_items: dict[str, str] = source["trialItems"]
    name_to_ids: dict[str, list[str]] = {}
    for monster_id, mob in mobs.items():
        name_to_ids.setdefault(mob["n"], []).append(monster_id)

    monster_maps: dict[str, list[str]] = {monster_id: [] for monster_id in mobs}
    map_records = []
    unresolved = []
    for map_id in sorted(maps):
        pool = maps[map_id]
        missing = sorted(set(pool) - set(mobs))
        if missing:
            raise GenerationError(f"map {map_id} has missing monster IDs: {missing}")
        unique_pool = sorted(set(pool))
        for monster_id in unique_pool:
            monster_maps[monster_id].append(map_id)
        normal = [ref("monster", x) for x in unique_pool if not bool(mobs[x].get("boss", False))]
        bosses = [ref("monster", x) for x in unique_pool if bool(mobs[x].get("boss", False))]
        label = source["mapLabels"].get(map_id)
        status = "complete" if label else "partial"
        if not label:
            unresolved.append({"code": "map_display_name_unresolved", "entityRef": ref("map", map_id), "source": "js/00-data.js#DB.maps", "details": "No resolved MAP_REGIONS label; key was not humanized."})
        map_records.append({"mapId": map_id, "displayName": label, "monsterRefs": normal, "bossRefs": bosses, "entityRef": ref("map", map_id), "verification": verification("js/00-data.js#DB.maps"), "version": version(), "status": status})

    owner_to_id: dict[str, str] = {}
    for owner in drops:
        ids = name_to_ids.get(owner, [])
        if len(ids) != 1:
            raise GenerationError(f"drop owner is not uniquely resolvable: {owner!r} -> {ids}")
        owner_to_id[owner] = ids[0]

    table_by_monster: dict[str, str] = {}
    table_records = []
    for owner in sorted(drops, key=lambda x: owner_to_id[x]):
        monster_id = owner_to_id[owner]
        table_id = f"drop_table_monster_{monster_id}_base"
        table_by_monster[monster_id] = table_id
        entries = []
        seen_items: set[str] = set()
        for item_id, rate in drops[owner]:
            if item_id in seen_items:
                raise GenerationError(f"duplicate item {item_id} in drop owner {owner}")
            seen_items.add(item_id)
            if item_id not in item_ids:
                raise GenerationError(f"drop item does not exist: {item_id}")
            entry_id = f"drop_entry_monster_{monster_id}_{item_id}_base"
            conditions = []
            entry_status = "complete"
            if item_id in trial_items:
                conditions = [{"conditionType": "class_and_quest_state", "classKey": trial_items[item_id], "sourceLocation": "js/01-drops-config.js#TRIAL_ITEM_CLASS", "status": "partial"}]
                entry_status = "partial"
                unresolved.append({"code": "drop_runtime_modifier_unresolved", "entityRef": ref("dropEntry", entry_id), "source": "js/05-kill-progression.js#killMob", "details": "Trial gating and forced-100 runtime behavior require a contracted MechanicRef; base probability is preserved separately."})
            entries.append({
                "dropEntryId": entry_id, "dropTableRef": ref("dropTable", table_id), "itemRef": ref("item", item_id), "itemNameText": None,
                "probability": {"value": rate, "unit": "percent", "basis": 100}, "quantity": {"min": 1, "max": 1}, "dropType": "base",
                "bossOnly": None, "conditions": conditions, "runtimeModifiers": [],
                "verification": verification("js/01-drops-config.js#MOB_DROPS + js/05-kill-progression.js#killMob"), "version": version(),
                "entityRef": ref("dropEntry", entry_id), "status": entry_status
            })
        entries.sort(key=lambda x: x["dropEntryId"])
        entry_refs = [ref("dropEntry", x["dropEntryId"]) for x in entries]
        table_records.append({
            "dropTableId": table_id, "owner": ref("monster", monster_id), "ownerType": "monster", "dropType": "base", "rollModel": "independent",
            "entries": entries, "conditions": [], "runtimeModifiers": [], "verification": verification("js/01-drops-config.js#MOB_DROPS"), "version": version(),
            "entityRef": ref("dropTable", table_id), "relations": relation_refs([ref("monster", monster_id)], entry_refs), "status": "partial" if any(x["status"] != "complete" for x in entries) else "complete"
        })

    monster_records = []
    for monster_id in sorted(mobs):
        mob = mobs[monster_id]
        map_refs = [ref("map", x) for x in sorted(monster_maps[monster_id])]
        table_ref = ref("dropTable", table_by_monster[monster_id]) if monster_id in table_by_monster else None
        if monster_id in card_monsters:
            unresolved.append({"code": "card_identity_unresolved", "entityRef": ref("monster", monster_id), "source": "js/15-cards.js#CARD_MOB_INFO", "details": "Card subject is known, but canonical Card ID is not contracted; cardRef remains null."})
        for field, detail in (("mp", "No common MP source"), ("size", f"Raw size code retained: {mob.get('s')!r}"), ("alignment", "No canonical alignment source"), ("bossTier", "No canonical boss tier source"), ("isQuestTarget", "Quest Domain relation not available")):
            unresolved.append({"code": f"monster_{field}_unresolved", "entityRef": ref("monster", monster_id), "source": "js/00-data.js#DB.mobs", "details": detail})
        drop_refs = [table_ref] if table_ref else []
        monster_records.append({
            "monsterId": monster_id, "displayName": mob["n"], "level": mob["lv"], "hp": mob["hp"], "mp": None,
            "stats": {"ac": mob["ac"], "mr": mob["mr"], "hit": mob["hit"], "er": mob.get("er"), "dr": mob.get("dr"), "attackSpeed": mob["atkSpd"], "damageDice": mob["dmg"], "damageBonus": mob["db"], "experience": mob["exp"], "goldMin": mob["goldMin"], "goldMax": mob["goldMax"]},
            "race": mob.get("race"), "size": None, "sizeCode": mob.get("s"), "element": mob.get("e", mob.get("elem")), "alignment": None,
            "boss": bool(mob.get("boss", False)), "bossTier": None, "isQuestTarget": None, "mapRef": map_refs, "dropTableRef": table_ref, "cardRef": None,
            "relations": relation_refs(map_refs, drop_refs), "verification": verification(f"js/00-data.js#DB.mobs.{monster_id}"), "version": version(),
            "status": "partial", "entityRef": ref("monster", monster_id)
        })

    table_records.sort(key=lambda x: x["dropTableId"])
    unresolved.sort(key=lambda x: (x["code"], x["entityRef"]["entityType"], x["entityRef"]["entityId"]))
    return (
        {"schemaVersion": SCHEMA_VERSION, "dataset": "monsters", "records": monster_records},
        {"schemaVersion": SCHEMA_VERSION, "dataset": "maps", "records": map_records},
        {"schemaVersion": SCHEMA_VERSION, "dataset": "drop_tables", "records": table_records},
        {"schemaVersion": SCHEMA_VERSION, "dataset": "monster_unresolved", "records": unresolved},
    )


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")


def generate(source_root: Path, output_dir: Path) -> dict[str, int]:
    monsters, maps, tables, unresolved = build(extract(source_root))
    write_json(output_dir / "monsters.json", monsters)
    write_json(output_dir / "maps.json", maps)
    write_json(output_dir / "drop_tables.json", tables)
    write_json(output_dir / "unresolved.json", unresolved)
    return {"monsters": len(monsters["records"]), "maps": len(maps["records"]), "dropTables": len(tables["records"]), "dropEntries": sum(len(x["entries"]) for x in tables["records"]), "unresolved": len(unresolved["records"])}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(json.dumps(generate(args.source_root, args.output_dir), ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
