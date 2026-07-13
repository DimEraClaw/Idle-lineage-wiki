'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createEquipmentRepository, URLS } = require('../js/wiki-equipment-data.js');
const { createEquipmentViewAdapter, toReadModel } = require('../js/wiki-equipment-view-adapter.js');
const { SEARCH_FIXTURES } = require('../js/wiki-equipment-shadow-adapter.js');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8');
const legacyMatch = html.match(/const EQUIP_DATA = (\[.*?\]);\r?\n/s);
assert(legacyMatch, 'EQUIP_DATA literal was not found');
const legacy = JSON.parse(legacyMatch[1]);
const legacyEquipment = legacy.filter(record => record.category === 'equipment');
const documents = Object.fromEntries(Object.values(URLS).map(url => [url, fs.readFileSync(path.join(ROOT, url), 'utf8')]));

function fetchFrom(source, calls) {
    return async url => {
        calls.push(url);
        if (source[url] == null) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => source[url] };
    };
}

function cloneDocuments() {
    return Object.fromEntries(Object.entries(documents).map(([key, value]) => [key, value]));
}

function hash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function makeAdapter(source = documents, calls = []) {
    const repository = createEquipmentRepository({ fetch: fetchFrom(source, calls) });
    const adapter = createEquipmentViewAdapter({ repository, legacyRecords: legacy });
    return { repository, adapter };
}

async function main() {
    let passed = 0;
    async function test(name, fn) {
        await fn();
        passed += 1;
        process.stdout.write('ok ' + passed + ' - ' + name + '\n');
    }

    const calls = [];
    const { repository, adapter } = await makeAdapter(documents, calls);
    const legacyHash = hash(legacy);
    await test('view load succeeds', async () => assert.strictEqual(await adapter.load(), true));
    await test('initial view fetches only equipments.json', async () => assert.deepStrictEqual(calls, [URLS.equipment]));
    await test('view exposes 786 equipment records', async () => assert.strictEqual(adapter.getAll().length, 786));
    await test('repository is ready after equipment-only load', async () => assert.strictEqual(repository.getState().ready, true));
    await test('diagnostics are not ready initially', async () => assert.strictEqual(repository.getState().diagnosticsReady, false));
    await test('adapter source is Dataset', async () => assert.strictEqual(adapter.getState().source, 'dataset'));
    await test('adapter count is 786', async () => assert.strictEqual(adapter.getState().count, 786));
    await test('weapon count remains 309', async () => assert.strictEqual(adapter.getAll().filter(x => x.equipmentGroup === 'weapon').length, 309));
    await test('armor count remains 339', async () => assert.strictEqual(adapter.getAll().filter(x => x.equipmentGroup === 'armor').length, 339));
    await test('accessory count remains 138', async () => assert.strictEqual(adapter.getAll().filter(x => x.equipmentGroup === 'accessory').length, 138));
    await test('equipment ID maps to legacy id', async () => assert.strictEqual(adapter.getById('acc_116').id, 'acc_116'));
    await test('displayName maps to name', async () => assert.strictEqual(adapter.getById('acc_116').name, '傳送控制戒指'));
    await test('itemType maps to type', async () => assert.strictEqual(adapter.getById('acc_116').type, 'acc'));
    await test('slot has a Chinese display label', async () => assert.strictEqual(adapter.getById('acc_116').slot_cn, '戒指'));
    await test('canonical description maps to desc', async () => assert(adapter.getById('acc_116').desc.includes('傳送術')));
    await test('resolved base stats map without unresolved zeroes', async () => assert.deepStrictEqual(adapter.getById('acc_116').stats, { ac: 0 }));
    await test('all-class requirement maps to all', async () => assert.strictEqual(adapter.getById('acc_116').req, 'all'));
    await test('safe level preserves explicit zero', async () => assert.strictEqual(adapter.getById('acc_116').safe, 0));
    await test('entityRef is retained', async () => assert.deepStrictEqual(adapter.getById('acc_116').entityRef, { entityId: 'acc_116', entityType: 'equipment' }));
    await test('formal relations are retained', async () => assert(adapter.getById('acc_116').relations.length > 0));
    await test('Monster relation uses Entity ID navigation', async () => assert(adapter.getById('acc_116').sources.some(x => /tab=monster&amp;monster=/.test(x))));
    await test('relation HTML does not contain onclick', async () => assert(adapter.getAll().every(x => x.sources.every(source => !/onclick/i.test(source)))));
    await test('Craft relations do not invent a navigation URL', async () => assert(adapter.getAll().flatMap(x => x.sources).filter(x => x.includes('【製作')).every(x => !/href=/i.test(x))));
    await test('unknown Equipment ID returns null', async () => assert.strictEqual(adapter.getById('not-real'), null));
    await test('ID search is case-insensitive', async () => assert(adapter.search('ACC_116').some(x => x.id === 'acc_116')));
    await test('full Chinese name search works', async () => assert(adapter.search('傳送控制戒指').some(x => x.id === 'acc_116')));
    await test('partial Chinese name search works', async () => assert(adapter.search('傳送控制').some(x => x.id === 'acc_116')));
    await test('Chinese group search covers every weapon record', async () => {
        const ids = new Set(adapter.search('武器').map(x => x.id));
        assert(adapter.getAll().filter(x => x.equipmentGroup === 'weapon').every(x => ids.has(x.id)));
    });
    await test('Chinese type search works', async () => assert(adapter.search('雙手劍').length > 0));
    await test('Chinese slot search works', async () => assert(adapter.search('戒指').length > 0));
    await test('canonical description search works', async () => assert(adapter.search('必定遭遇').some(x => x.id === 'acc_116')));
    await test('all ten E3-C search fixtures return results', async () => assert(SEARCH_FIXTURES.every(query => adapter.search(query).length > 0)));
    await test('legacy editorial text is explicitly compatibility-only', async () => assert.strictEqual(adapter.getById('acc_116').compatibilityOnly.legacySearchText, true));
    await test('277 absent descriptions remain null', async () => assert.strictEqual(adapter.getAll().filter(x => x.desc == null).length, 277));
    await test('four unresolved safe values remain null', async () => assert.strictEqual(adapter.getAll().filter(x => x.safe == null).length, 4));
    await test('four unresolved class requirements remain null', async () => assert.strictEqual(adapter.getAll().filter(x => x.req == null).length, 4));
    await test('five source-precedence price cases are marked pending review', async () => assert.strictEqual(adapter.getAll().filter(x => x.viewState.priceConflict).length, 5));
    await test('price conflicts keep canonical Dataset values', async () => assert(adapter.getAll().filter(x => x.viewState.priceConflict).every(x => Number.isFinite(x.price))));
    await test('read-model snapshots cannot mutate adapter state', async () => {
        const model = adapter.getById('acc_116');
        model.name = 'changed';
        assert.strictEqual(adapter.getById('acc_116').name, '傳送控制戒指');
    });
    await test('adapter does not mutate legacy EQUIP_DATA', async () => assert.strictEqual(hash(legacy), legacyHash));
    await test('render timing can be recorded', async () => {
        adapter.setRenderTime(12.5);
        assert.strictEqual(adapter.getState().renderTimeMs, 12.5);
    });
    await test('detail diagnostics load lazily', async () => {
        const result = await adapter.ensureDiagnostics('acc_116');
        assert.strictEqual(result.ready, true);
        assert(calls.includes(URLS.diagnostics));
        assert(calls.includes(URLS.unresolved));
    });
    await test('lazy diagnostics do not refetch equipment', async () => assert.strictEqual(calls.filter(url => url === URLS.equipment).length, 1));
    await test('repeated diagnostics reuse one request', async () => {
        await adapter.ensureDiagnostics('acc_116');
        assert.strictEqual(calls.filter(url => url === URLS.diagnostics).length, 1);
    });
    await test('shadow full load after view load does not refetch equipment', async () => {
        assert.strictEqual(await repository.load(), true);
        assert.strictEqual(calls.filter(url => url === URLS.equipment).length, 1);
    });
    await test('equipment 404 falls back without rejection', async () => {
        const source = cloneDocuments();
        delete source[URLS.equipment];
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), false);
        assert.strictEqual(instance.adapter.getAll().length, 0);
    });
    await test('equipment parse error falls back without rejection', async () => {
        const source = cloneDocuments();
        source[URLS.equipment] = '{';
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), false);
    });
    await test('invalid equipment envelope falls back', async () => {
        const source = cloneDocuments();
        source[URLS.equipment] = JSON.stringify({ dataset: 'wrong', schemaVersion: '1.0.0', records: [] });
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), false);
    });
    await test('duplicate Equipment ID fails closed in repository', async () => {
        const source = cloneDocuments();
        const envelope = JSON.parse(source[URLS.equipment]);
        envelope.records.push(envelope.records[0]);
        source[URLS.equipment] = JSON.stringify(envelope);
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), false);
    });
    await test('diagnostics 404 does not discard ready Dataset view', async () => {
        const source = cloneDocuments();
        delete source[URLS.diagnostics];
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), true);
        const result = await instance.adapter.ensureDiagnostics('acc_116');
        assert.strictEqual(result.ready, false);
        assert.strictEqual(instance.adapter.getState().ready, true);
        assert.strictEqual(instance.adapter.getAll().length, 786);
    });
    await test('optional unresolved 404 still permits diagnostics', async () => {
        const source = cloneDocuments();
        delete source[URLS.unresolved];
        const instance = await makeAdapter(source, []);
        assert.strictEqual(await instance.adapter.load(), true);
        assert.strictEqual((await instance.adapter.ensureDiagnostics('acc_116')).ready, true);
    });
    await test('toReadModel does not mutate canonical entity', async () => {
        const record = JSON.parse(documents[URLS.equipment]).records[0];
        const before = hash(record);
        toReadModel(record, legacyEquipment.find(x => x.id === record.equipmentId));
        assert.strictEqual(hash(record), before);
    });
    await test('wiki defines the feature flag disabled by default', async () => assert(html.includes('window.EQUIPMENT_DATA_VIEW_ENABLED = false;')));
    await test('wiki enables only exact equipmentData=1', async () => assert(html.includes("get('equipmentData') === '1'")));
    await test('wiki contains Equipment deep-link parameter handling', async () => assert(html.includes("searchParams.set('equipment', item.id)")));
    await test('wiki restores deep links without creating history entries', async () => assert(html.includes("openDetailModal(equipmentId, { updateHistory: false })")));
    await test('wiki has popstate navigation handling', async () => assert(html.includes("window.addEventListener('popstate'")));
    await test('wiki displays unresolved values explicitly', async () => assert(html.includes('資料尚未建立')));

    process.stdout.write('Equipment view adapter tests passed: ' + passed + '/' + passed + '\n');
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
