'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createEquipmentRepository, URLS, INDEX_URL } = require('../js/wiki-equipment-data.js');
const { createEquipmentViewAdapter } = require('../js/wiki-equipment-view-adapter.js');
const { SEARCH_FIXTURES } = require('../js/wiki-equipment-shadow-adapter.js');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8');
const legacyMatch = html.match(/const EQUIP_DATA = (\[.*?\]);\r?\n/s);
assert(legacyMatch, 'EQUIP_DATA literal was not found');
const legacy = JSON.parse(legacyMatch[1]);
const legacyEquipment = legacy.filter(record => record.category === 'equipment');
const detailNames = Array.from('0123456789abcdef', bucket => `equipment-details-${bucket}.json`);
const viewUrls = [INDEX_URL, ...detailNames.map(name => `data/equipment/${name}`)];
const sourceUrls = [...new Set([...Object.values(URLS), ...viewUrls])];
const documents = Object.fromEntries(sourceUrls.map(url => [url, fs.readFileSync(path.join(ROOT, url), 'utf8')]));
const indexDocument = JSON.parse(documents[INDEX_URL]);
const index = indexDocument.records;
const byId = new Map(index.map(record => [record.equipmentId, record]));
const details = detailNames.flatMap(name => JSON.parse(documents[`data/equipment/${name}`]).records);
const detailById = new Map(details.map(record => [record.equipmentId, record]));

const FIXTURES = Object.freeze({
    weapon: 'relic_amp_staff',
    armor: 'amr_baphomet',
    accessory: 'acc_116',
    priceReview: 'relic_mandra_spirit',
    safeUnresolved: 'wpn_22',
    requirementUnresolved: 'wpn_22',
    descriptionMissing: 'acc_118',
    monsterRelation: 'acc_118',
    craftRelation: 'acc_134'
});
const TYPE_COUNTS = Object.freeze({
    armor: 86, belt: 28, blunt: 20, boots: 36, bow: 20, chain_sword: 11, claw: 21,
    cloak: 43, crossbow: 12, dagger: 17, dual_blade: 19, earring: 39, gloves: 38,
    greaves: 12, helmet: 57, kiringku: 11, necklace: 31, one_hand_sword: 71,
    other_weapon: 7, ring: 40, shield: 57, spear: 8, staff: 31, tshirt: 10,
    two_hand_blunt: 18, two_hand_spear: 18, two_hand_sword: 25
});

function cloneDocuments() {
    return Object.fromEntries(Object.entries(documents).map(([key, value]) => [key, value]));
}

function fetchFrom(source, calls, delays = {}) {
    return async url => {
        calls.push(url);
        if (delays[url]) await new Promise(resolve => setTimeout(resolve, delays[url]));
        if (source[url] == null) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => source[url] };
    };
}

async function makeAdapter(source = documents, calls = [], delays = {}) {
    const repository = createEquipmentRepository({ fetch: fetchFrom(source, calls, delays) });
    const adapter = createEquipmentViewAdapter({ repository, legacyRecords: legacy });
    return { repository, adapter };
}

function sortedIds(records, mode) {
    const rows = records.slice();
    if (mode === 'name_az') rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-TW'));
    if (mode === 'price_high') rows.sort((a, b) => {
        const left = a.price.amount;
        const right = b.price.amount;
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return right - left;
    });
    return rows.map(row => row.equipmentId);
}

async function main() {
    let passed = 0;
    async function test(name, fn) {
        await fn();
        passed += 1;
        process.stdout.write(`ok ${passed} - ${name}\n`);
    }

    await test('feature flag remains disabled by default', async () => assert(html.includes('window.EQUIPMENT_DATA_VIEW_ENABLED = false;')));
    await test('only equipmentData=1 enables the Dataset view', async () => assert(html.includes("get('equipmentData') === '1'")));
    await test('initial dependency is the relative index path', async () => assert.strictEqual(INDEX_URL, 'data/equipment/equipment-index.json'));
    await test('all sixteen Detail shard dependencies are present', async () => assert.strictEqual(detailNames.filter(name => fs.existsSync(path.join(ROOT, 'data/equipment', name))).length, 16));
    await test('diagnostics and unresolved paths are relative', async () => {
        assert.strictEqual(URLS.diagnostics, 'data/equipment/diagnostics.json');
        assert.strictEqual(URLS.unresolved, 'data/equipment/unresolved.json');
    });
    await test('canonical owner path remains equipments.json', async () => assert.strictEqual(URLS.equipment, 'data/equipment/equipments.json'));
    await test('runtime paths contain no host or local absolute path', async () => {
        sourceUrls.forEach(url => assert(!/^(?:\/|[A-Za-z]:|file:|https?:|localhost|127\.0\.0\.1)/i.test(url), url));
    });
    await test('relative paths resolve under a project subpath', async () => {
        assert.strictEqual(new URL(INDEX_URL, 'https://example.test/Idle-lineage-wiki/wiki.html').pathname, '/Idle-lineage-wiki/data/equipment/equipment-index.json');
    });
    await test('index has 786 Equipment summaries', async () => assert.strictEqual(index.length, 786));
    await test('Detail shards cover exactly 786 Equipment entities', async () => assert.strictEqual(detailById.size, 786));
    await test('weapon count is 309', async () => assert.strictEqual(index.filter(x => x.equipmentGroup === 'weapon').length, 309));
    await test('armor count is 339', async () => assert.strictEqual(index.filter(x => x.equipmentGroup === 'armor').length, 339));
    await test('accessory count is 138', async () => assert.strictEqual(index.filter(x => x.equipmentGroup === 'accessory').length, 138));
    await test('all 27 equipmentType filters have records', async () => assert.strictEqual(new Set(index.map(x => x.equipmentType)).size, 27));
    await test('all equipmentType filter counts match the RC baseline', async () => {
        Object.entries(TYPE_COUNTS).forEach(([type, count]) => assert.strictEqual(index.filter(x => x.equipmentType === type).length, count, type));
    });
    await test('fixed RC fixtures retain stable IDs', async () => Object.values(FIXTURES).forEach(id => assert(byId.has(id), id)));
    await test('weapon, armor and accessory fixtures use different Detail shards', async () => {
        assert.strictEqual(new Set([FIXTURES.weapon, FIXTURES.armor, FIXTURES.accessory].map(id => byId.get(id).detailLocator)).size, 3);
    });

    const calls = [];
    const { repository, adapter } = await makeAdapter(documents, calls);
    await test('Dataset View loads successfully', async () => assert.strictEqual(await adapter.load(), true));
    await test('initial load fetches only the index', async () => assert.deepStrictEqual(calls, [INDEX_URL]));
    await test('initial load does not fetch canonical, diagnostics or unresolved', async () => {
        assert(!calls.includes(URLS.equipment));
        assert(!calls.includes(URLS.diagnostics));
        assert(!calls.includes(URLS.unresolved));
    });
    await test('repository index contains 786 IDs', async () => assert.strictEqual(repository.getState().indexCounts.equipmentById, 786));
    await test('all fixed search fixtures return results', async () => SEARCH_FIXTURES.forEach(query => assert(adapter.search(query).length > 0, query)));
    await test('ID search is case-insensitive', async () => assert(adapter.search('ACC_116').some(x => x.id === 'acc_116')));
    await test('full Chinese name search works', async () => assert(adapter.search('傳送控制戒指').some(x => x.id === 'acc_116')));
    await test('partial Chinese name search works', async () => assert(adapter.search('傳送控制').some(x => x.id === 'acc_116')));
    await test('name sort is deterministic', async () => assert.deepStrictEqual(sortedIds(index, 'name_az'), sortedIds(index, 'name_az')));
    await test('price sort is descending and deterministic', async () => {
        const ids = sortedIds(index, 'price_high');
        const prices = ids.map(id => byId.get(id).price.amount).filter(Number.isFinite);
        assert(prices.every((price, position) => position === 0 || prices[position - 1] >= price));
        assert.deepStrictEqual(ids, sortedIds(index, 'price_high'));
    });
    await test('five prices remain review_required', async () => assert.strictEqual(index.filter(x => x.status === 'review_required').length, 5));
    await test('four safe values remain unresolved instead of zero', async () => assert.strictEqual(index.filter(x => x.safeEnhance.safeLevel == null && x.safeEnhance.enhanceable == null).length, 4));
    await test('four class requirements remain unresolved instead of all', async () => assert.strictEqual(index.filter(x => x.classRequirements.baseClasses == null).length, 4));
    await test('277 descriptions remain absent', async () => assert.strictEqual(index.filter(x => x.description.canonicalText == null).length, 277));
    await test('missing Dataset descriptions use 尚無說明', async () => assert(html.includes("? '尚無說明' :")));
    await test('partial and unresolved player states are distinct', async () => {
        assert(html.includes('部分資料尚未建立'));
        assert(html.includes("? '資料尚未建立'"));
    });
    await test('price review state is player-visible', async () => assert(html.includes('價格待確認')));

    const weapon = await adapter.getDetail(FIXTURES.weapon);
    const armor = await adapter.getDetail(FIXTURES.armor);
    const accessory = await adapter.getDetail(FIXTURES.accessory);
    await test('weapon Detail loads canonical identity', async () => assert.strictEqual(weapon.id, FIXTURES.weapon));
    await test('armor Detail loads canonical identity', async () => assert.strictEqual(armor.id, FIXTURES.armor));
    await test('accessory Detail loads canonical identity', async () => assert.strictEqual(accessory.id, FIXTURES.accessory));
    await test('three Detail fixtures fetch exactly three shards', async () => {
        const locators = new Set([weapon.id, armor.id, accessory.id].map(id => byId.get(id).detailLocator));
        assert.strictEqual(calls.filter(url => locators.has(url)).length, 3);
    });
    await test('reopening a Detail is a cache hit', async () => {
        const locator = byId.get(FIXTURES.accessory).detailLocator;
        await adapter.getDetail(FIXTURES.accessory);
        assert.strictEqual(calls.filter(url => url === locator).length, 1);
    });
    await test('Monster relations use stable monster IDs', async () => {
        const detail = await adapter.getDetail(FIXTURES.monsterRelation);
        assert(detail.sources.some(source => /tab=monster&amp;monster=dk/.test(source)));
    });
    await test('Craft relations do not invent a URL', async () => {
        const detail = await adapter.getDetail(FIXTURES.craftRelation);
        assert(detail.sources.some(source => source.includes('【製作')));
        assert(detail.sources.filter(source => source.includes('【製作')).every(source => !/href=/i.test(source)));
    });
    await test('624 legacy-only source gaps are not converted to guessed relations', async () => {
        const diagnostics = JSON.parse(documents[URLS.diagnostics]).records;
        assert.strictEqual(diagnostics.filter(x => x.code === 'equipment_relation_unresolved').length, 624);
    });

    await test('deep link uses stable Equipment ID', async () => assert(html.includes("searchParams.set('equipment', item.id)")));
    await test('deep link restore avoids an extra history entry', async () => assert(html.includes('openDetailModal(equipmentId, { updateHistory: false })')));
    await test('invalid deep link has a safe not-found state', async () => assert(html.includes('找不到 Equipment ID')));
    await test('close removes only the equipment query', async () => assert(html.includes("url.searchParams.delete('equipment')")));
    await test('Back and Forward are connected through popstate', async () => assert(html.includes("window.addEventListener('popstate'")));
    await test('Monster relation navigation preserves Dataset flag', async () => assert(accessory.sources.some(source => /equipmentData=1&amp;tab=monster/.test(source))));
    await test('initialization renders legacy UI before awaiting the index', async () => {
        const start = html.indexOf('const equipmentDataInitialization = initEquipmentDataViewIfEnabled();');
        const legacyRender = html.indexOf('initEquipWiki();', start);
        const wait = html.indexOf('await equipmentDataInitialization;', start);
        assert(start >= 0 && legacyRender > start && wait > legacyRender);
    });

    const slowCalls = [];
    const slow = await makeAdapter(documents, slowCalls, { [INDEX_URL]: 20, [byId.get(FIXTURES.accessory).detailLocator]: 25, [URLS.diagnostics]: 30, [URLS.unresolved]: 30 });
    const slowStart = Date.now();
    await test('delayed index still becomes ready', async () => assert.strictEqual(await slow.adapter.load(), true));
    await test('delayed index timing is observable', async () => assert(Date.now() - slowStart >= 15));
    await test('delayed first Detail remains usable', async () => assert.strictEqual((await slow.adapter.getDetail(FIXTURES.accessory)).id, FIXTURES.accessory));
    await test('delayed diagnostics remain optional and usable', async () => assert.strictEqual((await slow.adapter.ensureDiagnostics(FIXTURES.accessory)).ready, true));

    await test('index 404 falls back to all 786 legacy Equipment records', async () => {
        const source = cloneDocuments(); delete source[INDEX_URL];
        const instance = await makeAdapter(source);
        assert.strictEqual(await instance.adapter.load(), false);
        assert.strictEqual(legacyEquipment.length, 786);
    });
    await test('index parse error falls back cleanly', async () => {
        const source = cloneDocuments(); source[INDEX_URL] = '{';
        const instance = await makeAdapter(source);
        assert.strictEqual(await instance.adapter.load(), false);
    });
    await test('invalid index envelope falls back cleanly', async () => {
        const source = cloneDocuments(); source[INDEX_URL] = JSON.stringify({ dataset: 'wrong', records: [] });
        const instance = await makeAdapter(source);
        assert.strictEqual(await instance.adapter.load(), false);
    });
    await test('Detail 404 is local and preserves searchable index', async () => {
        const source = cloneDocuments(); delete source[byId.get(FIXTURES.accessory).detailLocator];
        const instance = await makeAdapter(source); await instance.adapter.load();
        assert.strictEqual(await instance.adapter.getDetail(FIXTURES.accessory), null);
        assert(instance.adapter.search(FIXTURES.accessory).length > 0);
        assert.strictEqual((await instance.adapter.getDetail(FIXTURES.weapon)).id, FIXTURES.weapon);
    });
    await test('Detail parse error is local', async () => {
        const source = cloneDocuments(); source[byId.get(FIXTURES.accessory).detailLocator] = '{';
        const instance = await makeAdapter(source); await instance.adapter.load();
        assert.strictEqual(await instance.adapter.getDetail(FIXTURES.accessory), null);
        assert.strictEqual(instance.adapter.getState().ready, true);
    });
    await test('Detail bucket mismatch is rejected', async () => {
        const source = cloneDocuments();
        const locator = byId.get(FIXTURES.accessory).detailLocator;
        const payload = JSON.parse(source[locator]); payload.bucket = payload.bucket === '0' ? '1' : '0'; source[locator] = JSON.stringify(payload);
        const instance = await makeAdapter(source); await instance.adapter.load();
        assert.strictEqual(await instance.adapter.getDetail(FIXTURES.accessory), null);
    });
    await test('diagnostics 404 preserves canonical Detail', async () => {
        const source = cloneDocuments(); delete source[URLS.diagnostics];
        const instance = await makeAdapter(source); await instance.adapter.load();
        const detail = await instance.adapter.getDetail(FIXTURES.accessory);
        const diagnostic = await instance.adapter.ensureDiagnostics(FIXTURES.accessory);
        assert.strictEqual(detail.id, FIXTURES.accessory);
        assert.strictEqual(diagnostic.ready, false);
    });
    await test('diagnostics parse error preserves canonical Detail', async () => {
        const source = cloneDocuments(); source[URLS.diagnostics] = '{';
        const instance = await makeAdapter(source); await instance.adapter.load();
        assert.strictEqual((await instance.adapter.getDetail(FIXTURES.accessory)).id, FIXTURES.accessory);
        assert.strictEqual((await instance.adapter.ensureDiagnostics(FIXTURES.accessory)).ready, false);
    });
    await test('unresolved 404 falls back to diagnostics unresolved subset', async () => {
        const source = cloneDocuments(); delete source[URLS.unresolved];
        const instance = await makeAdapter(source); await instance.adapter.load();
        assert.strictEqual((await instance.adapter.ensureDiagnostics(FIXTURES.accessory)).ready, true);
    });
    await test('diagnostics failure has a player-visible message', async () => assert(html.includes('資料狀態暫時無法載入')));
    await test('Detail failure has a local player-visible message', async () => assert(html.includes('詳細資料載入失敗')));
    await test('player-facing copy does not label Equipment UI Alpha or Beta', async () => {
        assert(!/>[^<]*(?:Equipment UI )?(?:Alpha|Beta)[^<]*</i.test(html));
    });
    await test('RC changes do not default-enable the Dataset view', async () => assert(!html.includes('window.EQUIPMENT_DATA_VIEW_ENABLED = true;')));

    process.stdout.write(`Equipment UI RC tests passed: ${passed}/${passed}\n`);
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
