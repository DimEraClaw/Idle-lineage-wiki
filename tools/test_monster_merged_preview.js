const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function loadRegions() {
    const html = read('wiki.html');
    const match = html.match(/const REGIONS_DATA = (\[.*?\]);\r?\n/s);
    assert(match, 'REGIONS_DATA must remain available');
    return JSON.parse(match[1]);
}

function loadPreview(search) {
    const context = {
        URL,
        URLSearchParams,
        console,
        window: {
            location: { search: search || '', href: `https://example.test/wiki.html${search || ''}` }
        }
    };
    vm.createContext(context);
    vm.runInContext(read('js/wiki-monster-merged-preview.js'), context);
    return context.window.MonsterMergedPreview;
}

function repository() {
    const data = JSON.parse(read('data/monster/monsters.json')).records;
    const byName = new Map();
    data.forEach(monster => {
        const records = byName.get(monster.displayName) || [];
        records.push(monster);
        byName.set(monster.displayName, records);
    });
    return {
        getMonsterByName(name) {
            const records = byName.get(name) || [];
            return records.length === 1 ? records[0] : null;
        }
    };
}

const tests = [
    ['feature flag is opt-in', () => {
        assert.strictEqual(loadPreview('').isEnabled(), false);
        assert.strictEqual(loadPreview('?monsterMerge=1').isEnabled(), true);
    }],
    ['normal navigation remains represented separately', () => {
        const html = read('wiki.html');
        assert(html.includes('id="btn-tab-cards"'));
        assert(html.includes('id="btn-tab-monster"'));
        assert(html.includes("tabId === 'cards'"));
        assert(html.includes("dataset.monsterMergedPreview === 'enabled'"));
    }],
    ['preview has all three modes', () => {
        const html = read('wiki.html');
        ['monster', 'region', 'drop'].forEach(mode => assert(html.includes(`data-monster-mode="${mode}"`)));
    }],
    ['current Monster Dataset remains complete', () => {
        assert.strictEqual(JSON.parse(read('data/monster/monsters.json')).records.length, 469);
    }],
    ['region source is reused without a new dataset', () => {
        const regions = loadRegions();
        assert.strictEqual(regions.length, 16);
        assert.strictEqual(regions.reduce((sum, region) => sum + region.mobs.length, 0), 590);
    }],
    ['same canonical monster is not duplicated across regions', () => {
        const api = loadPreview('?monsterMerge=1');
        const model = api.buildPreviewModel(loadRegions(), repository());
        const references = model.regions.flatMap(region => region.monsters);
        const resolvedIds = references.filter(record => record.canonical).map(record => record.canonical.monsterId);
        assert(resolvedIds.length > new Set(resolvedIds).size, 'fixture must include cross-region reuse');
        assert.strictEqual(model.counts.canonicalMonsters, new Set(resolvedIds).size);
    }],
    ['unmapped card names stay unresolved', () => {
        const api = loadPreview('?monsterMerge=1');
        const model = api.buildPreviewModel([{ key: 'x', name: 'X', stat: 'S', vals: [], mobs: [{ name: '不存在的怪物' }] }], repository());
        assert.strictEqual(model.regions[0].monsters[0].canonical, null);
        assert.strictEqual(model.counts.unresolvedReferences, 1);
    }],
    ['fallback avoids throwing before Monster data is ready', () => {
        const api = loadPreview('?monsterMerge=1');
        const model = api.buildPreviewModel(loadRegions(), null);
        assert.strictEqual(model.counts.references, 590);
        assert.strictEqual(model.counts.unresolvedReferences, 590);
    }],
    ['mobile access controls are preview-owned', () => {
        const source = read('js/wiki-monster-merged-preview.js');
        assert(source.includes('monster-merged-results-toggle'));
        assert(source.includes('monster-merged-results-close'));
        assert(source.includes('monster-merged-region-select'));
        assert(source.includes("sidebar.classList.toggle('active')"));
    }]
];

let passed = 0;
tests.forEach(([name, test]) => {
    try {
        test();
        passed += 1;
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
});
console.log(`Monster merged preview tests: ${passed}/${tests.length} passed`);
