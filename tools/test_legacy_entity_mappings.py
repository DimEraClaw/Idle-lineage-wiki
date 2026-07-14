#!/usr/bin/env python3
"""Regression tests for the legacy entity mapping pipeline."""
from __future__ import annotations
import copy,hashlib,json,tempfile,unittest
from pathlib import Path
from generate_legacy_entity_mappings import ROOT,build_mappings,encode,extract_source,mapping_id,normalize_display
from validate_legacy_entity_mappings import entity_sets,load,validate
SCHEMA=load(ROOT/"schemas/legacy-entity-mapping.schema.json")
SOURCE_ROOT=ROOT/"temp_online"/"u2a-c3d4f96f13aefabf1453a4a3f1f54d688fd573f6-v2"/"snapshot"
DATA=extract_source(SOURCE_ROOT,ROOT);ENTITIES=entity_sets(DATA)
def datasets():
 r,u=build_mappings(copy.deepcopy(DATA));return {"schemaVersion":"1.0.0","mappings":r},{"schemaVersion":"1.0.0","mappings":u}
def codes(ds,baseline=False):return {x["code"] for x in validate(list(ds),SCHEMA,ENTITIES,check_baseline=baseline)}
class Tests(unittest.TestCase):
 def test_01_valid(self):self.assertEqual(codes(datasets(),True),set())
 def test_02_duplicate_id(self):
  r,u=datasets();r["mappings"].append(copy.deepcopy(r["mappings"][0]));self.assertIn("duplicate_mapping",codes((r,u)))
 def test_03_conflicting_scope_value(self):
  r,u=datasets();x=copy.deepcopy(r["mappings"][0]);x["id"]+="_x";x["target"]["entityId"]="goblin";r["mappings"].append(x);self.assertIn("conflicting_mapping",codes((r,u)))
 def test_04_ambiguous_needs_two(self):
  r,u=datasets();x=copy.deepcopy(u["mappings"][0]);x["status"]="ambiguous";x["candidates"]=[];u["mappings"][0]=x;self.assertIn("ambiguous_mapping",codes((r,u)))
 def test_05_resolved_target_required(self):
  r,u=datasets();r["mappings"][0]["target"]=None;self.assertIn("missing_mapping_target",codes((r,u)))
 def test_06_evidence_required(self):
  r,u=datasets();r["mappings"][0]["evidence"]=[];self.assertIn("missing_mapping_evidence",codes((r,u)))
 def test_07_unresolved_no_target(self):
  r,u=datasets();u["mappings"][0]["target"]={"entityType":"monster","entityId":"orc"};self.assertIn("missing_mapping_target",codes((r,u)))
 def test_08_missing_target_resolved_fails(self):
  r,u=datasets();x=next(x for x in u["mappings"] if x["status"]=="missing_target");x["status"]="resolved";x["target"]={"entityType":"map","entityId":"town_aden"};x["evidence"]=[{"evidenceType":"code","sourceLocation":"fixture"}];self.assertIn("missing_mapping_target",codes((r,u)))
 def test_09_normalized_collision(self):
  r,u=datasets();x=copy.deepcopy(r["mappings"][0]);x["id"]+="_collision";x["sourceValue"]=" other ";x["normalizedValue"]=r["mappings"][0]["normalizedValue"];r["mappings"].append(x);self.assertIn("unsafe_name_normalization",codes((r,u)))
 def test_10_alias_cycle(self):
  r,u=datasets();base={"mappingType":"alias_to_entity_id","sourceScope":"x","normalizedValue":"","candidates":[],"status":"resolved","matchMethod":"verified_alias","sourceLocation":"fixture","evidence":[{"evidenceType":"data","sourceLocation":"fixture"}],"versionScope":{"validFrom":None,"validTo":None},"replacementMappingId":None,"notes":[]}
  for a,b in [('a','b'),('b','a')]:x=copy.deepcopy(base);x.update(id=f"mapping_alias_x_{a}",sourceValue=a,normalizedValue=a,target={"entityType":"monster","entityId":b});r["mappings"].append(x)
  ents=copy.deepcopy(ENTITIES);ents["monster"]|={'a','b'};self.assertIn("alias_cycle",{x['code'] for x in validate([r,u],SCHEMA,ents,check_baseline=False)})
 def test_11_replacement_exists(self):
  r,u=datasets();r["mappings"][0]["replacementMappingId"]="mapping_missing";self.assertIn("stale_mapping",codes((r,u)))
 def test_12_target_type(self):
  r,u=datasets();r["mappings"][0]["target"]["entityType"]="item";self.assertIn("invalid_target_type",codes((r,u)))
 def test_13_chinese_not_in_id(self):self.assertRegex(mapping_id("craft_monster_to_monster_id","craft:drops.monsterNameText","elf_grave_group"),r"^[\x00-\x7f]+$")
 def test_14_source_reorder_stable_ids(self):
  a=build_mappings(DATA);d=copy.deepcopy(DATA);d["mobs"].reverse();d["wikiItems"].reverse();b=build_mappings(d);self.assertEqual({x['id'] for z in a for x in z},{x['id'] for z in b for x in z})
 def test_15_input_reorder_same_bytes(self):
  a=build_mappings(DATA);d=copy.deepcopy(DATA);d["drops"].reverse();d["wikiLoc"].reverse();b=build_mappings(d);self.assertEqual(tuple(map(encode,a)),tuple(map(encode,b)))
 def test_16_sha_stable(self):
  a=tuple(hashlib.sha256(encode(x)).hexdigest() for x in build_mappings(DATA));b=tuple(hashlib.sha256(encode(x)).hexdigest() for x in build_mappings(DATA));self.assertEqual(a,b)
 def test_17_no_absolute_paths(self):self.assertNotIn(str(ROOT),b''.join(encode(x) for x in build_mappings(DATA)).decode())
 def test_18_utf8_lf_newline(self):
  for x in build_mappings(DATA):b=encode(x);b.decode('utf-8');self.assertTrue(b.endswith(b'\n'));self.assertFalse(b.endswith(b'\n\n'));self.assertNotIn(b'\r\n',b)
 def test_19_duplicate_fixture_ambiguous(self):
  d=copy.deepcopy(DATA);d['mobs'].append(['other_orc','妖魔']);r,u=build_mappings(d);self.assertTrue(any(x['sourceValue']=='妖魔' and x['status']=='ambiguous' for x in u))
 def test_20_compat_not_canonical(self):
  r,u=datasets();cards=[x for x in r['mappings'] if x['mappingType']=='legacy_card_key_to_monster_id'];self.assertTrue(cards);self.assertTrue(all(x['status']=='compatibility_only' for x in cards))
 def test_21_pride_unresolved(self):
  r,u=datasets();x=[m for m in u['mappings'] if m['mappingType']=='item_name_to_item_id'];self.assertEqual(len(x),18);self.assertTrue(all(m['sourceValue'].startswith('item_pride_') for m in x))
 def test_22_craft_unresolved(self):
  r,u=datasets();self.assertTrue(any(x['sourceValue']=='精靈墓穴怪物' and x['status']=='unresolved' for x in u['mappings']))
 def test_23_card_candidates(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='legacy_card_key_to_card_candidate' for x in u['mappings']),409)
 def test_24_drop_count(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='drop_owner_to_monster_id' for x in r['mappings']),440);self.assertEqual(sum(x['mappingType']=='drop_owner_to_monster_id' and x['status']=='conflict' for x in u['mappings']),1)
 def test_25_wiki_monsters(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='wiki_monster_to_monster_id' for x in r['mappings']),407)
 def test_26_craft_resolved(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='craft_monster_to_monster_id' for x in r['mappings']),364)
 def test_27_nav_resolved(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='map_label_to_map_id' for x in r['mappings']),103)
 def test_28_nav_missing(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='map_label_to_map_id' for x in u['mappings']),19)
 def test_29_wiki_location_resolved(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='wiki_location_to_map_id' for x in r['mappings']),83)
 def test_30_wiki_location_unresolved(self):
  r,u=datasets();self.assertEqual(sum(x['mappingType']=='wiki_location_to_map_id' for x in u['mappings']),120)
if __name__=='__main__':unittest.main(verbosity=2)
