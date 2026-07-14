'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createEquipmentRepository, URLS } = require('../js/wiki-equipment-data.js');

const ROOT = path.resolve(__dirname, '..');
const documents = {
    [URLS.equipment]: fs.readFileSync(path.join(ROOT, URLS.equipment), 'utf8'),
    [URLS.diagnostics]: fs.readFileSync(path.join(ROOT, URLS.diagnostics), 'utf8'),
    [URLS.unresolved]: fs.readFileSync(path.join(ROOT, URLS.unresolved), 'utf8')
};

function fetchFrom(source, calls) {
    return async url => {
        calls.push(url);
        const value = source[url];
        if (value == null) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => value };
    };
}

function clonedSource() {
    return Object.fromEntries(Object.entries(documents).map(([key, value]) => [key, value]));
}

async function main() {
    let passed = 0;
    async function test(name, fn) {
        await fn();
        passed += 1;
        process.stdout.write('ok ' + passed + ' - ' + name + '\n');
    }

    const calls = [];
    const repository = createEquipmentRepository({ fetch: fetchFrom(documents, calls) });
    await test('load succeeds', async () => assert.strictEqual(await repository.load(), true));
    await test('exactly three Dataset files are fetched once', async () => assert.deepStrictEqual(calls.sort(), Object.values(URLS).sort()));
    await test('825 Equipment records are loaded', async () => assert.strictEqual(repository.getAll().length, 825));
    await test('ID lookup uses equipmentId', async () => assert.strictEqual(repository.getEquipmentById('acc_116').equipmentId, 'acc_116'));
    await test('exact name lookup resolves unique names', async () => assert.strictEqual(repository.getEquipmentByName('傳送控制戒指').equipmentId, 'acc_116'));
    await test('partial Chinese name search works', async () => assert(repository.searchEquipment('傳送控制').some(record => record.equipmentId === 'acc_116')));
    await test('Equipment ID search works case-insensitively', async () => assert(repository.searchEquipment('ACC_116').some(record => record.equipmentId === 'acc_116')));
    await test('group index returns only matching records', async () => assert(repository.getByGroup('weapon').every(record => record.equipmentGroup === 'weapon')));
    await test('type index returns only matching records', async () => assert(repository.getByType('ring').every(record => record.equipmentType === 'ring')));
    await test('slot index returns only matching records', async () => assert(repository.getBySlot('ring').every(record => record.slot === 'ring')));
    await test('class index returns records permitting the class', async () => assert(repository.getByClass('knight').every(record => record.classRequirements.baseClasses.includes('knight'))));
    await test('unknown class cannot use the index', async () => assert.deepStrictEqual(repository.getByClass('unknown'), []));
    await test('relations lookup is scoped by Equipment ID', async () => assert(repository.getRelations('acc_116').every(record => record.target && record.relationType)));
    await test('diagnostics lookup is scoped by Equipment ID', async () => assert(repository.getDiagnostics('acc_116').every(record => record.equipmentId === 'acc_116')));
    await test('unresolved lookup is scoped by Equipment ID', async () => assert(repository.getUnresolved('acc_116').every(record => record.equipmentId === 'acc_116')));
    await test('entity snapshots do not mutate Repository state', async () => {
        const entity = repository.getEquipmentById('acc_116');
        entity.displayName = 'changed';
        assert.strictEqual(repository.getEquipmentById('acc_116').displayName, '傳送控制戒指');
    });
    await test('list snapshots do not mutate Repository state', async () => {
        const list = repository.getAll();
        list.pop();
        list[0].relations.length = 0;
        assert.strictEqual(repository.getAll().length, 825);
    });
    await test('duplicate Equipment ID fails closed', async () => {
        const source = clonedSource();
        const envelope = JSON.parse(source[URLS.equipment]);
        envelope.records.push(envelope.records[0]);
        source[URLS.equipment] = JSON.stringify(envelope);
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), false);
        assert.strictEqual(repo.getAll().length, 0);
    });
    await test('ambiguous exact name never selects the first result', async () => {
        const source = clonedSource();
        const envelope = JSON.parse(source[URLS.equipment]);
        envelope.records[1].displayName = envelope.records[0].displayName;
        source[URLS.equipment] = JSON.stringify(envelope);
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), true);
        assert.strictEqual(repo.getEquipmentByName(envelope.records[0].displayName), null);
        assert.strictEqual(repo.getState().ambiguousNameCount, 1);
    });
    await test('invalid document envelope fails closed', async () => {
        const source = clonedSource();
        source[URLS.diagnostics] = JSON.stringify({ dataset: 'wrong', schemaVersion: '1.0.0', records: [] });
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), false);
        assert.strictEqual(repo.getState().ready, false);
    });
    await test('required JSON 404 fails closed without rejection', async () => {
        const source = clonedSource();
        delete source[URLS.equipment];
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), false);
        assert(repo.getState().error.includes('HTTP 404'));
    });
    await test('required JSON parse error fails closed', async () => {
        const source = clonedSource();
        source[URLS.diagnostics] = '{';
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), false);
        assert(repo.getState().error.includes('Invalid JSON'));
    });
    await test('optional unresolved failure derives unresolved diagnostics', async () => {
        const source = clonedSource();
        delete source[URLS.unresolved];
        const repo = createEquipmentRepository({ fetch: fetchFrom(source, []) });
        assert.strictEqual(await repo.load(), true);
        assert(repo.getState().optionalErrors.length === 1);
        assert(repo.getUnresolved('acc_116').length > 0);
    });
    await test('repeated load reuses one initialization and does not refetch', async () => {
        const repeatCalls = [];
        const repo = createEquipmentRepository({ fetch: fetchFrom(documents, repeatCalls) });
        const [a, b] = await Promise.all([repo.load(), repo.load()]);
        assert.strictEqual(a && b, true);
        assert.strictEqual(repeatCalls.length, 3);
    });
    await test('index counts are complete and diagnostic-only', async () => {
        assert.deepStrictEqual(repository.getState().indexCounts, {
            equipmentById: 825,
            equipmentByExactName: 825,
            equipmentByGroup: 3,
            equipmentByType: 27,
            equipmentBySlot: 16,
            equipmentByClass: 8,
            relationByEquipment: 777,
            diagnosticsByEquipment: 814,
            unresolvedByEquipment: 814,
            searchableText: 825
        });
    });

    process.stdout.write('Equipment repository tests passed: ' + passed + '/' + passed + '\n');
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
