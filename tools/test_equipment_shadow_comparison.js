'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createEquipmentRepository, URLS } = require('../js/wiki-equipment-data.js');
const adapter = require('../js/wiki-equipment-shadow-adapter.js');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8').replace(/\r\n/g, '\n');
const match = html.match(/const EQUIP_DATA = (\[.*?\]);\r?\n/s);
assert(match, 'EQUIP_DATA literal was not found');
const legacy = JSON.parse(match[1]);
const legacyEquipment = legacy.filter(record => record.category === 'equipment');
const documents = Object.fromEntries(Object.values(URLS).map(url => [url, fs.readFileSync(path.join(ROOT, url), 'utf8')]));
const fetchData = async url => ({ ok: true, status: 200, text: async () => documents[url] });

function hash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function repositoryWithMutation(repository, mutate) {
    return {
        getState: repository.getState,
        getDiagnostics: repository.getDiagnostics,
        searchEquipment: repository.searchEquipment,
        measureSearch: repository.measureSearch,
        getAll() {
            const records = repository.getAll();
            mutate(records);
            return records;
        }
    };
}

async function main() {
    let passed = 0;
    async function test(name, fn) {
        await fn();
        passed += 1;
        process.stdout.write('ok ' + passed + ' - ' + name + '\n');
    }

    const repository = createEquipmentRepository({ fetch: fetchData });
    assert.strictEqual(await repository.load(), true);
    const beforeLegacy = hash(legacy);
    const result = adapter.compareEquipmentData(legacy, repository);

    await test('identity comparison records 39 Dataset-only v3.4.17 Equipment IDs', async () => {
        assert.strictEqual(result.counts.legacy, 786);
        assert.strictEqual(result.counts.dataset, 825);
        assert.strictEqual(result.byCategory.identity_mismatch, 39);
    });
    await test('classification parity has no group mismatch', async () => assert.strictEqual(result.byCategory.equipment_group_mismatch, 0));
    await test('classification parity has no type mismatch', async () => assert.strictEqual(result.byCategory.equipment_type_mismatch, 0));
    await test('classification parity has no slot mismatch', async () => assert.strictEqual(result.byCategory.slot_mismatch, 0));
    await test('group counts include the 39 v3.4.17 additions', async () => assert.deepStrictEqual({
        weapon: repository.getByGroup('weapon').length,
        armor: repository.getByGroup('armor').length,
        accessory: repository.getByGroup('accessory').length
    }, { weapon: 324, armor: 354, accessory: 147 }));
    await test('display names have complete parity', async () => assert.strictEqual(result.byCategory.display_name_mismatch, 0));
    await test('five known price conflicts are expected', async () => assert.strictEqual(result.byCategory.price_expected_conflict, 5));
    await test('277 missing descriptions are expected', async () => assert.strictEqual(result.byCategory.description_missing_expected, 277));
    await test('four unresolved safe semantics are expected', async () => assert.strictEqual(result.byCategory.safe_semantic_mismatch, 4));
    await test('four unresolved class requirements are expected', async () => assert.strictEqual(result.byCategory.class_requirement_semantic_mismatch, 4));
    await test('all 23 canonical base-stat fields are compared', async () => {
        assert.strictEqual(Object.keys(repository.getAll()[0].baseStats).length, 23);
        assert.strictEqual(result.byCategory.base_stat_mismatch, 3);
    });
    await test('rarity and other unexplained base fields have parity', async () => assert.strictEqual(result.byCategory.blocking_shadow_mismatch, 0));
    await test('formal Monster Drop relation coverage is measured', async () => assert(result.relationCoverage.formalMonsterDrop > 0));
    await test('formal Craft result relation coverage is measured', async () => assert(result.relationCoverage.formalCraftResult > 0));
    await test('formal Craft requirement relation coverage is measured', async () => assert(result.relationCoverage.formalCraftRequirement > 0));
    await test('624 legacy HTML/name source sets remain unresolved', async () => assert.strictEqual(result.byCategory.legacy_source_unresolved, 624));
    await test('relation parity remains false while legacy targets are unresolved', async () => assert.strictEqual(result.parity.relation, false));
    await test('ten fixed search fixtures are compared', async () => assert.strictEqual(result.searchFixtures.length, 10));
    await test('search differences are explicitly expected and non-blocking', async () => {
        const records = result.mismatches.filter(record => record.category === 'search_result_mismatch');
        assert(records.length > 0);
        assert(records.every(record => record.expected && !record.blocking));
    });
    await test('blocking differences are limited to audited source additions and resNone deltas', async () => {
        assert.strictEqual(result.counts.blocking, 42);
        assert.strictEqual(result.byCategory.blocking_shadow_mismatch, 0);
    });
    await test('diagnostic records include every contract field', async () => {
        const required = ['equipmentId', 'fieldPath', 'legacyValue', 'datasetValue', 'category', 'blocking', 'expected', 'reason', 'sourceLocation', 'notes'];
        assert(result.mismatches.every(record => required.every(field => Object.prototype.hasOwnProperty.call(record, field))));
    });
    await test('diagnostic output is deterministically sorted', async () => {
        const keys = result.mismatches.map(record => [record.category, record.equipmentId || '', record.fieldPath || '', record.reason].join('\0'));
        assert.deepStrictEqual(keys, keys.slice().sort((a, b) => a.localeCompare(b)));
    });
    await test('shadow comparison does not mutate EQUIP_DATA', async () => assert.strictEqual(hash(legacy), beforeLegacy));
    await test('identity mismatch is blocking in a synthetic regression', async () => {
        const proxy = repositoryWithMutation(repository, records => records.pop());
        const comparison = adapter.compareEquipmentData(legacy, proxy);
        assert(comparison.mismatches.some(record => record.category === 'identity_mismatch' && record.blocking));
    });
    await test('display name mismatch is blocking in a synthetic regression', async () => {
        const proxy = repositoryWithMutation(repository, records => { records[0].displayName += 'x'; });
        const comparison = adapter.compareEquipmentData(legacy, proxy);
        assert(comparison.mismatches.some(record => record.category === 'display_name_mismatch' && record.blocking));
    });
    await test('group mismatch is blocking in a synthetic regression', async () => {
        const proxy = repositoryWithMutation(repository, records => { records[0].equipmentGroup = 'wrong'; });
        const comparison = adapter.compareEquipmentData(legacy, proxy);
        assert(comparison.mismatches.some(record => record.category === 'equipment_group_mismatch' && record.blocking));
    });
    await test('resolved base-stat mismatch is blocking in a synthetic regression', async () => {
        const proxy = repositoryWithMutation(repository, records => {
            const record = records.find(item => Object.values(item.baseStats).some(field => ['explicit', 'explicit_zero'].includes(field.valueState)));
            const key = Object.keys(record.baseStats).find(stat => ['explicit', 'explicit_zero'].includes(record.baseStats[stat].valueState));
            record.baseStats[key].value += 1;
        });
        const comparison = adapter.compareEquipmentData(legacy, proxy);
        assert(comparison.mismatches.some(record => record.category === 'base_stat_mismatch' && record.blocking));
    });
    await test('Repository refuses comparison before ready', async () => {
        const unloaded = createEquipmentRepository({ fetch: fetchData });
        assert.throws(() => adapter.compareEquipmentData(legacy, unloaded), /not ready/);
    });
    await test('wiki declares a default-off Shadow flag', async () => assert(html.includes('window.EQUIPMENT_DATA_SHADOW_ENABLED = false;')));
    await test('wiki enables Shadow only for equipmentShadow=1', async () => assert(html.includes("get('equipmentShadow') === '1'")));
    await test('wiki initializes Shadow without awaiting or replacing legacy Equipment initialization', async () => {
        assert(html.includes('initEquipWiki();\n            window.__equipmentShadowInitialization = initEquipmentShadowIfEnabled();'));
    });
    await test('both Shadow scripts are referenced once', async () => {
        assert.strictEqual((html.match(/wiki-equipment-data\.js/g) || []).length, 1);
        assert.strictEqual((html.match(/wiki-equipment-shadow-adapter\.js/g) || []).length, 1);
    });

    process.stdout.write('Equipment shadow comparison tests passed: ' + passed + '/' + passed + '\n');
    process.stdout.write(JSON.stringify({ counts: result.counts, parity: result.parity, byCategory: result.byCategory, relationCoverage: result.relationCoverage, performance: repository.getState().performance }, null, 2) + '\n');
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
