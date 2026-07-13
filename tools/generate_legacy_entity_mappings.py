#!/usr/bin/env python3
"""Generate deterministic legacy entity mappings from the local source tree."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RESOLVED = ROOT / "data" / "mappings" / "legacy-entity-mappings.json"
DEFAULT_UNRESOLVED = ROOT / "data" / "mappings" / "unresolved-legacy-mappings.json"

TYPE_TOKEN = {
    "monster_name_to_id": "mnid", "drop_owner_to_monster_id": "drop",
    "wiki_monster_to_monster_id": "wikimob", "craft_monster_to_monster_id": "craftmob",
    "map_label_to_map_id": "maplabel", "wiki_location_to_map_id": "wikiloc",
    "legacy_card_key_to_monster_id": "cardmob", "legacy_card_key_to_card_candidate": "cardcandidate",
    "item_name_to_item_id": "itemname", "alias_to_entity_id": "alias",
}
SCOPE_TOKEN = {
    "game:DB.mobs": "dbmobs", "game:MOB_DROPS": "mobdrops", "wiki:REGIONS_DATA.monsters": "wikimobs",
    "craft:drops.monsterNameText": "craftdrops", "game:MAP_REGIONS": "mapregions",
    "wiki:REGIONS_DATA.locations": "wikilocations", "game:CARD_MOB_INFO": "cardindex",
    "save:cardDex": "carddex", "wiki:REGIONS_DATA.items": "wikiitems",
}
MANUAL_VARIANTS = {
    "精靈墓穴怪物": "elf_grave_group", "大洞穴隱遁者地區": "hidden_cave_area",
    "風木地監": "windwood_dungeon_label", "無生命實驗室": "lifeless_lab_label",
    "封印精靈地監": "sealed_spirit_dungeon_label", "暗殺軍王之室": "assassin_king_room_label",
    "魔獸軍王之室": "beast_king_room_label", "法令軍王之室": "law_king_room_label",
    "冥法軍王之室": "necro_king_room_label", "底比斯沙漠": "thebes_desert_label",
    "底比斯金字塔內部": "thebes_pyramid_label", "底比斯歐西里斯祭壇": "thebes_temple_label",
}
TARGET_VARIANTS = {"侏儒": "monster_dwarf_legacy"}

class GenerationError(RuntimeError):
    pass

def normalize_display(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()).translate(str.maketrans("【】（）", "[]( )".replace(" ", "")))

def variant_for(value: str, target_id: str | None = None) -> str:
    if target_id:
        token = re.sub(r"[^a-z0-9_]+", "_", target_id.lower()).strip("_")
        if token:
            return token
        if target_id in TARGET_VARIANTS:
            return TARGET_VARIANTS[target_id]
    if value in MANUAL_VARIANTS:
        return MANUAL_VARIANTS[value]
    m = re.fullmatch(r"傲慢之塔\s*(\d+)\s*樓", value)
    if m: return f"pride_floor_{int(m.group(1)):03d}"
    m = re.fullmatch(r"傲慢之塔\s*(\d+)\s*~\s*(\d+)\s*樓", value)
    if m: return f"pride_range_{int(m.group(1)):03d}_{int(m.group(2)):03d}"
    m = re.fullmatch(r"item_pride_(scroll|sealed)_(\d+)", value)
    if m: return f"pride_{m.group(1)}_{int(m.group(2)):03d}"
    raise GenerationError(f"no controlled mapping ID assignment for unresolved value: {value}")

def mapping_id(mapping_type: str, scope: str, variant: str) -> str:
    return f"mapping_{TYPE_TOKEN[mapping_type]}_{SCOPE_TOKEN[scope]}_{variant}"

def record(mapping_type: str, scope: str, value: str, location: str, *, target_type: str | None = None,
           target_id: str | None = None, status: str = "resolved", method: str = "exact_name",
           candidates: list[dict[str, str]] | None = None, notes: list[str] | None = None,
           target_location: str | None = None, variant: str | None = None) -> dict[str, Any]:
    target = {"entityType": target_type, "entityId": target_id} if target_id else None
    evidence = []
    if target_id:
        evidence = [{"evidenceType": "data" if location.endswith(".json") else "code", "sourceLocation": location},
                    {"evidenceType": "code", "sourceLocation": target_location or location}]
    return {"id": mapping_id(mapping_type, scope, variant or variant_for(value, target_id)),
            "mappingType": mapping_type, "sourceScope": scope, "sourceValue": value,
            "normalizedValue": normalize_display(value), "target": target, "candidates": candidates or [],
            "status": status, "matchMethod": method, "sourceLocation": location, "evidence": evidence,
            "versionScope": {"validFrom": None, "validTo": None}, "replacementMappingId": None,
            "notes": notes or []}

NODE_EXTRACTOR = r'''
const fs=require('fs'),vm=require('vm'),root=process.argv[1],read=p=>fs.readFileSync(root+'/'+p,'utf8');
const c={};vm.createContext(c);for(const f of ['js/00-data.js','js/01-drops-config.js','js/15-cards.js'])vm.runInContext(read(f),c);
const DB=vm.runInContext('DB',c),D=vm.runInContext('MOB_DROPS',c),CM=vm.runInContext('CARD_MOB_INFO',c);
let ms=read('js/11-world-map.js').match(/const MAP_REGIONS\s*=\s*(\[[\s\S]*?\n\]);/),MR=vm.runInNewContext('('+ms[1]+')');
let line=read('wiki.html').split(/\r?\n/).find(x=>x.includes('const REGIONS_DATA =')),g=line.slice(line.indexOf('=')+1).trim(),W=JSON.parse(g.slice(0,-1));
let craft=JSON.parse(read('data/craft/drops.json')),base={};vm.createContext(base);vm.runInContext(read('js/00-data.js'),base);let B=vm.runInContext('DB',base);
console.log(JSON.stringify({mobs:Object.entries(DB.mobs).map(([id,x])=>[id,x.n]),drops:Object.keys(D),cards:Object.keys(CM),maps:Object.keys(DB.maps),nav:MR.flatMap(r=>r.maps.map(m=>[m.v,m.t])),wikiMobs:[...new Set(W.flatMap(r=>r.mobs.map(m=>m.name)))],wikiLoc:[...new Set(W.flatMap(r=>r.mobs.flatMap(m=>m.maps||[])))],wikiItems:[...new Set(W.flatMap(r=>r.mobs.flatMap(m=>(m.drops||[]).map(d=>d.name))))],items:Object.entries(B.items).map(([id,x])=>[id,x.n]),craftMobs:[...new Set(craft.flatMap(r=>(r.sources||[]).map(s=>s.monsterNameText).filter(Boolean)))]}));
'''

def extract_source(source_root: Path) -> dict[str, Any]:
    needed = ["js/00-data.js", "js/01-drops-config.js", "js/11-world-map.js", "js/15-cards.js", "wiki.html", "data/craft/drops.json"]
    for name in needed:
        if not (source_root / name).is_file(): raise GenerationError(f"missing source: {name}")
    run = subprocess.run(["node", "-e", NODE_EXTRACTOR, str(source_root.resolve())], capture_output=True, text=True, encoding="utf-8", check=False)
    if run.returncode: raise GenerationError(run.stderr.strip() or "source extraction failed")
    return json.loads(run.stdout)

def unique_index(pairs: list[list[str]]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for entity_id, name in pairs: out.setdefault(name, []).append(entity_id)
    return out

def build_mappings(data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    result: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    mobs, items = unique_index(data["mobs"]), unique_index(data["items"])
    map_ids = set(data["maps"]); labels: dict[str, list[str]] = {}
    for map_id, label in data["nav"]: labels.setdefault(label, []).append(map_id)
    def add_names(values, mtype, scope, loc, index, etype, target_loc, compat=False):
        for value in sorted(set(values)):
            ids=index.get(value,[])
            if len(ids)==1:
                result.append(record(mtype,scope,value,loc,target_type=etype,target_id=ids[0],status="compatibility_only" if compat else "resolved",target_location=f"{target_loc}.{ids[0]}"))
            elif len(ids)>1:
                unresolved.append(record(mtype,scope,value,loc,status="ambiguous",method="unresolved",variant=variant_for(value, sorted(ids)[0]),candidates=[{"entityType":etype,"entityId":x} for x in sorted(ids)],notes=["exact name is not unique"]))
            else:
                unresolved.append(record(mtype,scope,value,loc,status="unresolved",method="unresolved",notes=["no existing target with an exact unique name"]))
    add_names(mobs.keys(),"monster_name_to_id","game:DB.mobs","js/00-data.js#DB.mobs",mobs,"monster","js/00-data.js#DB.mobs")
    add_names(data["drops"],"drop_owner_to_monster_id","game:MOB_DROPS","js/01-drops-config.js#MOB_DROPS",mobs,"monster","js/00-data.js#DB.mobs")
    add_names(data["wikiMobs"],"wiki_monster_to_monster_id","wiki:REGIONS_DATA.monsters","wiki.html#REGIONS_DATA",mobs,"monster","js/00-data.js#DB.mobs")
    add_names(data["craftMobs"],"craft_monster_to_monster_id","craft:drops.monsterNameText","data/craft/drops.json",mobs,"monster","js/00-data.js#DB.mobs")
    add_names(data["cards"],"legacy_card_key_to_monster_id","game:CARD_MOB_INFO","js/15-cards.js#CARD_MOB_INFO",mobs,"monster","js/00-data.js#DB.mobs",True)
    for value in sorted(set(data["cards"])):
        mid=mobs[value][0]
        unresolved.append(record("legacy_card_key_to_card_candidate","save:cardDex",value,"js/12-npc-quests.js#CARDDEX_KEY",status="unresolved",method="unresolved",variant=variant_for(value,mid),notes=[f"monster candidate: {mid}","canonical Card ID is not defined"]))
    for map_id,label in sorted(data["nav"],key=lambda x:(x[1],x[0])):
        if map_id in map_ids:
            result.append(record("map_label_to_map_id","game:MAP_REGIONS",label,"js/11-world-map.js#MAP_REGIONS",target_type="map",target_id=map_id,target_location=f"js/00-data.js#DB.maps.{map_id}"))
        else:
            unresolved.append(record("map_label_to_map_id","game:MAP_REGIONS",label,"js/11-world-map.js#MAP_REGIONS",status="missing_target",method="unresolved",variant=variant_for(label,map_id),notes=[f"navigation value {map_id} is not a DB.maps key"]))
    for value in sorted(set(data["wikiLoc"])):
        if value in map_ids:
            result.append(record("wiki_location_to_map_id","wiki:REGIONS_DATA.locations",value,"wiki.html#REGIONS_DATA",target_type="map",target_id=value,method="exact_id",target_location=f"js/00-data.js#DB.maps.{value}"))
        elif len(labels.get(value,[]))==1 and labels[value][0] in map_ids:
            target=labels[value][0];result.append(record("wiki_location_to_map_id","wiki:REGIONS_DATA.locations",value,"wiki.html#REGIONS_DATA",target_type="map",target_id=target,target_location=f"js/00-data.js#DB.maps.{target}"))
        else:
            unresolved.append(record("wiki_location_to_map_id","wiki:REGIONS_DATA.locations",value,"wiki.html#REGIONS_DATA",status="unresolved",method="unresolved",notes=["no exact unique DB.maps target"]))
    add_names(data["wikiItems"],"item_name_to_item_id","wiki:REGIONS_DATA.items","wiki.html#REGIONS_DATA",items,"item","js/00-data.js#DB.items")
    key=lambda r:(r["mappingType"],r["sourceScope"],r["sourceValue"],r["id"])
    return sorted(result,key=key),sorted(unresolved,key=key)

def encode(records: list[dict[str, Any]]) -> bytes:
    return (json.dumps({"schemaVersion":SCHEMA_VERSION,"mappings":records},ensure_ascii=False,indent=2,sort_keys=True,allow_nan=False)+"\n").encode("utf-8")

def main() -> int:
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--source-root",type=Path,default=ROOT);p.add_argument("--resolved-output",type=Path,default=DEFAULT_RESOLVED);p.add_argument("--unresolved-output",type=Path,default=DEFAULT_UNRESOLVED);a=p.parse_args()
    try:
        resolved,unresolved=build_mappings(extract_source(a.source_root))
        for path,payload in [(a.resolved_output,encode(resolved)),(a.unresolved_output,encode(unresolved))]:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload)
    except (GenerationError,OSError,json.JSONDecodeError) as exc:p.exit(1,f"error: {exc}\n")
    print(json.dumps({"resolvedOutputRecords":len(resolved),"unresolvedOutputRecords":len(unresolved)},sort_keys=True));return 0
if __name__=="__main__":raise SystemExit(main())
