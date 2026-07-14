#!/usr/bin/env python3
"""Validate legacy entity mapping datasets and audited baseline counts."""
from __future__ import annotations
import argparse,json,re
from pathlib import Path
from typing import Any
from jsonschema import Draft202012Validator
from generate_legacy_entity_mappings import ROOT,SCHEMA_VERSION,encode,extract_source,normalize_display,unique_index

DEFAULT_SCHEMA=ROOT/"schemas"/"legacy-entity-mapping.schema.json"
BASELINE={
 ("monster_name_to_id","resolved"):467,("monster_name_to_id","conflict"):1,
 ("drop_owner_to_monster_id","resolved"):440,("drop_owner_to_monster_id","conflict"):1,
 ("wiki_monster_to_monster_id","resolved"):407,("wiki_monster_to_monster_id","conflict"):1,
 ("craft_monster_to_monster_id","resolved"):364,("craft_monster_to_monster_id","conflict"):1,
 ("craft_monster_to_monster_id","unresolved"):1,("legacy_card_key_to_monster_id","compatibility_only"):408,
 ("legacy_card_key_to_monster_id","conflict"):1,
 ("map_label_to_map_id","resolved"):103,("map_label_to_map_id","missing_target"):19,
 ("wiki_location_to_map_id","resolved"):83,("wiki_location_to_map_id","unresolved"):120,
 ("item_name_to_item_id","resolved"):827,("item_name_to_item_id","unresolved"):18,
 ("legacy_card_key_to_card_candidate","unresolved"):409,
}
TYPE_TARGET={"monster_name_to_id":"monster","drop_owner_to_monster_id":"monster","wiki_monster_to_monster_id":"monster","craft_monster_to_monster_id":"monster","map_label_to_map_id":"map","wiki_location_to_map_id":"map","legacy_card_key_to_monster_id":"monster","legacy_card_key_to_card_candidate":"card","item_name_to_item_id":"item"}
ABS_RE=re.compile(r"(?:[A-Za-z]:[\\/]|/(?:Users|home|var|tmp)/)")
def diag(code,msg,path=None):return {"code":code,"message":msg,"path":path,"blocking":True}
def load(path):
 v=json.loads(path.read_text(encoding="utf-8"));
 if not isinstance(v,dict):raise ValueError("dataset root must be object")
 return v
def validate(datasets:list[dict[str,Any]],schema:dict[str,Any],entities:dict[str,set[str]],*,check_baseline=True,raw_bytes:list[bytes]|None=None):
 out=[];records=[]
 for di,d in enumerate(datasets):
  for e in Draft202012Validator(schema).iter_errors(d):out.append(diag("invalid_mapping_status" if list(e.absolute_path)[-1:] == ["status"] else "schema_error",e.message,"/".join(map(str,e.absolute_path))))
  records.extend(d.get("mappings",[]) if isinstance(d.get("mappings"),list) else [])
 ids={};keys={};aliases={}
 for i,r in enumerate(records):
  if not isinstance(r,dict):continue
  rid=r.get("id");path=f"mappings/{i}"
  if not isinstance(rid,str) or not re.fullmatch(r"mapping_[a-z0-9_]+",rid):out.append(diag("invalid_mapping_id","mapping id must be stable ASCII",path))
  if rid in ids:out.append(diag("duplicate_mapping",f"duplicate id: {rid}",path))
  ids[rid]=r
  key=(r.get("sourceScope"),r.get("sourceValue"));
  if r.get("status") in ("resolved","compatibility_only"):
   prev=keys.get(key)
   if prev and prev.get("target")!=r.get("target"):out.append(diag("conflicting_mapping",f"multiple resolved targets for {key}",path))
   keys[key]=r
  st=r.get("status");target=r.get("target");cands=r.get("candidates",[])
  if st in ("resolved","compatibility_only"):
   if not target:out.append(diag("missing_mapping_target","resolved mapping lacks target",path))
   if not r.get("evidence"):out.append(diag("missing_mapping_evidence","resolved mapping lacks evidence",path))
  if st in ("ambiguous","conflict") and len(cands)<2:out.append(diag("ambiguous_mapping",f"{st} mapping needs at least two candidates",path))
  if st in ("unresolved","missing_target","ambiguous","conflict") and target:out.append(diag("missing_mapping_target",f"{st} mapping cannot have target",path))
  if target:
   et,eid=target.get("entityType"),target.get("entityId")
   expected=TYPE_TARGET.get(r.get("mappingType"))
   if expected and et!=expected:out.append(diag("invalid_target_type",f"expected {expected}, got {et}",path))
   if eid not in entities.get(et,set()):out.append(diag("missing_mapping_target",f"target does not exist: {et}/{eid}",path))
  replacement=r.get("replacementMappingId")
  if replacement and replacement not in ids:pass
  if r.get("mappingType")=="alias_to_entity_id" and target:aliases[r.get("sourceValue")]=target.get("entityId")
  if ABS_RE.search(json.dumps(r,ensure_ascii=False)):out.append(diag("stale_mapping","record contains a local absolute path",path))
 for r in records:
  rep=r.get("replacementMappingId")
  if rep and rep not in ids:out.append(diag("stale_mapping",f"replacement does not exist: {rep}",r.get("id")))
 for start in aliases:
  seen=set();cur=start
  while cur in aliases:
   if cur in seen:out.append(diag("alias_cycle",f"alias cycle at {start}",start));break
   seen.add(cur);cur=aliases[cur]
 groups={}
 for r in records:groups.setdefault((r.get("mappingType"),r.get("sourceScope"),r.get("normalizedValue")),set()).add(r.get("sourceValue"))
 for key,values in groups.items():
  if len(values)>1:out.append(diag("unsafe_name_normalization",f"normalization collision: {sorted(values)}",str(key)))
 if raw_bytes:
  for n,(d,b) in enumerate(zip(datasets,raw_bytes)):
   if b!=encode(d.get("mappings", [])):out.append(diag("unstable_mapping_order",f"dataset {n} is not canonical UTF-8/LF/sorted output"))
 if check_baseline:
  counts={}
  for r in records:counts[(r.get("mappingType"),r.get("status"))]=counts.get((r.get("mappingType"),r.get("status")),0)+1
  for key,want in BASELINE.items():
   if counts.get(key,0)!=want:out.append(diag("stale_mapping",f"baseline {key} expected {want}, got {counts.get(key,0)}"))
  conflicts=[r for r in records if r.get("status")=="conflict"]
  if any(r.get("sourceValue")!="地獄奴隸" for r in conflicts):out.append(diag("conflicting_mapping","only the audited 地獄奴隸 conflict is accepted in this baseline"))
 return out
def entity_sets(data):return {"monster":{x[0] for x in data["mobs"]},"map":set(data["maps"]),"item":{x[0] for x in data["items"]},"card":set()}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument("--resolved",type=Path,default=ROOT/"data/mappings/legacy-entity-mappings.json");p.add_argument("--unresolved",type=Path,default=ROOT/"data/mappings/unresolved-legacy-mappings.json");p.add_argument("--schema",type=Path,default=DEFAULT_SCHEMA);p.add_argument("--source-root",type=Path,default=ROOT);p.add_argument("--project-root",type=Path,default=ROOT);a=p.parse_args()
 try:
  paths=[a.resolved,a.unresolved];ds=[load(x) for x in paths];errors=validate(ds,load(a.schema),entity_sets(extract_source(a.source_root,a.project_root)),raw_bytes=[x.read_bytes() for x in paths])
 except Exception as e:errors=[diag("schema_error",str(e))]
 print(json.dumps({"valid":not errors,"blockingCount":len(errors),"diagnostics":errors},ensure_ascii=False,indent=2,sort_keys=True));return 1 if errors else 0
if __name__=="__main__":raise SystemExit(main())
