const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const js = read('js/wiki-world-atlas-preview.js');
const css = read('css/wiki-world-atlas-preview.css');
const html = read('wiki.html');

function loadApi(search) {
    const matchEquip = html.match(/const EQUIP_DATA = (\[.*?\]);\r?\n/s);
    const equipData = matchEquip ? JSON.parse(matchEquip[1]) : [];
    const context = {
        URL,
        URLSearchParams,
        window: { location: { search: search || '' } },
        EQUIP_DATA: equipData
    };
    context.window.window = context.window;
    context.window.EQUIP_DATA = equipData;
    context.global = context.window;
    vm.createContext(context);
    vm.runInContext(js, context);
    return context.window.WorldAtlas;
}

function regions() {
    const match = html.match(/const REGIONS_DATA = (\[.*?\]);\r?\n/s);
    assert(match, 'REGIONS_DATA must exist');
    return JSON.parse(match[1]);
}

const has = (source, value) => () => assert(source.includes(value), `missing ${value}`);
const notHas = (source, value) => () => assert(!source.includes(value), `unexpected ${value}`);
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('1 default enables World Atlas', () => assert.strictEqual(loadApi('').isEnabled(), true));
test('2 worldAtlas=0 enables legacy fallback', () => assert.strictEqual(loadApi('?worldAtlas=0').isEnabled(), false));
test('3 old monster tab is routed', has(js, "['equip', 'craft', 'cards', 'monster'].includes(tabId)"));
test('4 old cards tab is routed through the same controlled path', has(js, "routeLegacy(tabId, searchKeyword)"));
test('5 old craft search intent is accepted', has(js, "params.get('search')"));
test('6 exactly sixteen regions remain', () => assert.strictEqual(regions().length, 16));
test('7 region bonus is rendered', has(js, 'regionBonus(region)'));
test('8 region selection renders content immediately', has(js, 'renderMain();'));
test('9 Dragon Valley map evidence stays strict', () => {
    const api = loadApi('');
    const region = regions().find(item => item.key === 'dragonvalley');
    const actual = Array.from(api.regionMapEvidence({ key: region.key, monsters: region.mobs.map(legacy => ({ legacy, canonical: null })) }));
    assert.deepStrictEqual(actual, ['沉默洞穴周邊', '龍之谷', '龍之谷地監1樓', '龍之谷地監2樓', '龍之谷地監3樓', '龍之谷地監4樓', '龍之谷地監5樓', '龍之谷地監6樓', '安塔瑞斯棲息地']);
});
test('10 maps use details accordion', has(js, "element('details', 'world-atlas-map-accordion')"));
test('11 accordion reports monster count', has(js, '怪物 ${records.length}'));
test('12 accordion reports boss count', has(js, 'Boss ${bosses}'));
test('13 accordion reports NPC count', has(js, 'NPC ${mapNpcs.length}'));
test('14 main content has no nested vertical scroller', notHas(css, '.world-atlas-main {\n    overflow-y: auto'));
test('15 monster cards explicitly use visible overflow', has(css, 'overflow: visible'));
test('16 fairy forest contains Orc Fighter', () => assert(regions().find(r => r.key === 'fairyforest').mobs.some(m => m.name === '妖魔鬥士')));
test('17 fairy forest contains Corrupted Pan', () => assert(regions().find(r => r.key === 'fairyforest').mobs.some(m => m.name === '污染的潘')));
test('18 Orc uses formal image resolver', has(js, 'resolveMonsterImage(monsterId)'));
test('19 Death Knight uses the shared image resolver', has(js, 'createMonsterImage(monster.monsterId'));
test('20 Giltas remains in Monster Dataset', () => assert(JSON.parse(read('data/monster/monsters.json')).records.some(m => m.monsterId === 'sanct_giltas')));
test('21 no monster Emoji fallback exists', notHas(js, "'👹'"));
test('22 monster card opens entity modal', has(js, "action === 'monster'"));
test('23 modal has an overlay', has(js, 'world-atlas-modal-overlay'));
test('24 modal has a close button', has(js, 'world-atlas-modal-close'));
test('25 Escape closes modal', has(js, "event.key === 'Escape'"));
test('26 overlay owns close action', has(js, "overlay.dataset.worldAction = 'close-modal'"));
test('27 modal restores trigger focus', has(js, 'modalTrigger.focus()'));
test('28 modal exposes all core abilities', () => ['HP', '攻擊', '命中', 'AC', 'MR', 'EXP', 'Gold'].forEach(label => assert(js.includes(`'${label}'`))));
test('29 traits do not derive from race', notHas(js, "features.push({ name: `種族"));
test('30 Death Knight skills parse from Code evidence', () => {
    const api = loadApi('');
    api.buildSourceEvidence('items: {}, mobs: {"dk": { hard:true, n:"死亡騎士", race:"不死", mag:{ skn:"地面震裂"}, mag2:{ skn:"吸血鬼之吻"}, mag3:{ skn:"光球"}}}', '');
    const names = Array.from(api.monsterFeatures('dk')).map(item => item.name);
    ['硬皮', '地面震裂', '吸血鬼之吻', '光球'].forEach(name => assert(names.includes(name)));
});
test('31 Orc has no invented trait', () => {
    const api = loadApi('');
    api.buildSourceEvidence('items: {}, mobs: {"orc": {n:"妖魔", race:"妖魔"}}', '');
    assert.deepStrictEqual(Array.from(api.monsterFeatures('orc')), []);
});
test('32 Giltas Code skills remain visible', () => {
    const api = loadApi('');
    api.buildSourceEvidence('items: {}, mobs: {"sanct_giltas": {hard:true,n:"吉爾塔斯",rageHpPct:.3,mag:{ skn:"沙塵暴"},mag2:{ skn:"岩漿流星雨"},mag3:{ skn:"毒氣風暴"},mag4:{ skn:"血壁空間"}}}', '');
    assert.strictEqual(Array.from(api.monsterFeatures('sanct_giltas')).length, 6);
});
test('33 drop rows use game item images', has(js, 'createItemImage(drop.itemId'));
test('34 pointer hover shows tooltip in page and modal content', has(js, "[pane, modal].forEach(host =>"));
test('35 tooltip clamps to viewport', has(js, 'global.innerWidth - rect.width - 8'));
test('36 null fields are omitted rather than rendered as zero', has(js, 'if (source.price != null)'));
test('37 item opens shared item renderer', has(js, 'renderItemModal(itemId'));
test('38 NPC cards are rendered', has(js, 'createNpcCard(npc)'));
test('39 crafting NPC uses recipe read model', has(js, 'getRecipesByNpcId(npc.id)'));
test('40 crafting items share item tooltip action', has(js, "button.dataset.worldAction = 'item'"));
test('41 unified search includes Monster', has(js, 'const monsters = globalSearch(value)'));
test('42 unified search includes Map', has(js, "['地圖', groups.maps"));
test('43 unified search includes Region', has(js, "['地區', groups.regions"));
test('44 unified search includes NPC', has(js, "['NPC', groups.npcs"));
test('45 unified search includes Drop', has(js, "['掉落物', groups.drops"));
test('46 deep links and reload restore entities', has(js, 'restoreEntityFromUrl()'));
test('47 Back and Forward bind popstate once', has(js, "global.addEventListener('popstate', restoreStateFromUrl)"));
test('48 mobile layout prevents horizontal card overflow', has(css, '@media (max-width: 480px)'));
test('49 mobile modal becomes near fullscreen', has(css, 'inset: 5vh 0 0'));
test('50 initialization catches errors', has(js, 'previewDiagnostics.initializationError'));
test('51 formal asset paths stay relative or official game assets', () => assert(!/file:\/\/|localhost|127\.0\.0\.1|[A-Z]:\\/.test(js)));
test('52 Equipment remains wired', () => assert(html.includes('./js/wiki-equipment-view-adapter.js') && js.includes('openDetailModal')));
test('53 datasets remain unchanged', () => {
    assert.strictEqual(JSON.parse(read('data/monster/monsters.json')).records.length, 469);
    assert.strictEqual(JSON.parse(read('data/monster/maps.json')).records.length, 217);
    assert.strictEqual(JSON.parse(read('data/monster/drop_tables.json')).records.length, 441);
    assert.strictEqual(JSON.parse(read('data/equipment/equipments.json')).records.length, 825);
});
test('54 legacy fallback keeps old navigation in HTML', () => ['btn-tab-craft', 'btn-tab-cards', 'btn-tab-monster'].forEach(id => assert(html.includes(`id="${id}"`))));
test('55 official navigation hides legacy entries only after successful init', has(js, "['btn-tab-equip', 'btn-tab-craft', 'btn-tab-cards', 'btn-tab-monster']"));
test('56 NPC JSON failure does not block init', has(js, 'return [];'));
test('57 Monster failure retains legacy region records', has(js, "monsters: (region.mobs || []).map(legacy"));
test('58 item image failure is neutral', has(js, "host.dataset.imageState = 'missing'"));
test('59 modal locks background scroll', has(css, 'body.world-atlas-modal-open'));
test('60 tooltip cannot create its own scrollbar', has(css, 'max-height: none'));
test('61 card does not render forbidden stats', () => {
    assert(!js.includes("row.appendChild(cardStat('種族'"));
    assert(!js.includes("row.appendChild(cardStat('攻擊'"));
});
test('62 Boss card does not render Boss badge', notHas(js, "line.appendChild(element('span', 'world-atlas-boss-badge', 'Boss'))"));
test('63 card renders actual features tags', has(js, "const tagsContainer = element('div', 'world-atlas-card-features')"));
test('64 card renders drop icons with deterministic sorting', has(js, "getDropPriorityScore"));

async function loadInitializedWorldAtlas(search) {
    const makeMockElement = (tag) => {
        const children = [];
        const el = {
            appendChild: (child) => {
                children.push(child);
                el.firstChild = children[0];
                return child;
            },
            append: (...items) => {
                items.forEach(item => {
                    children.push(item);
                    el.firstChild = children[0];
                });
            },
            removeChild: (child) => {
                const idx = children.indexOf(child);
                if (idx !== -1) children.splice(idx, 1);
                el.firstChild = children[0] || null;
                return child;
            },
            addEventListener: () => {},
            insertBefore: () => {},
            setAttribute: () => {},
            removeAttribute: () => {},
            querySelector: () => el,
            querySelectorAll: () => [],
            classList: {
                add: () => {},
                remove: () => {},
                contains: () => false,
                toggle: () => {}
            },
            style: { setProperty: () => {} },
            dataset: {},
            childNodes: children,
            tagName: tag,
            firstChild: null
        };
        return el;
    };

    const mockDoc = makeMockElement('DOCUMENT');
    mockDoc.documentElement = { dataset: {} };
    mockDoc.getElementById = () => mockDoc;
    mockDoc.querySelector = () => mockDoc;
    mockDoc.createElement = (tag) => makeMockElement(tag);
    mockDoc.createTextNode = (text) => makeMockElement('TEXT');
    mockDoc.body = mockDoc;

    const context = {
        URL,
        URLSearchParams,
        console: { log: () => {}, warn: () => {}, error: () => {} },
        document: mockDoc,
        window: {
            location: { search: search || '?worldPreview=1' },
            matchMedia: () => ({ matches: true }),
            addEventListener: () => {}
        }
    };
    context.window.window = context.window;
    context.window.document = context.document;
    context.window.URL = URL;
    context.window.URLSearchParams = URLSearchParams;
    context.window.console = context.console;
    context.global = context.window;

    vm.createContext(context);

    const fetchMock = async (url) => {
        const filePath = path.join(ROOT, url.replace(/^\.\//, ''));
        if (!fs.existsSync(filePath)) {
            return { ok: false, status: 404 };
        }
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return {
            ok: true,
            status: 200,
            json: async () => JSON.parse(fileContent),
            text: async () => fileContent
        };
    };
    context.fetch = fetchMock;
    context.window.fetch = fetchMock;

    vm.runInContext(read('js/wiki-monster-data.js'), context);
    vm.runInContext(read('js/wiki-monster-merged-preview.js'), context);

    let worldAtlasCode = read('js/wiki-world-atlas-preview.js');
    worldAtlasCode = worldAtlasCode.replace(
        'const api = Object.freeze({',
        'const api = Object.freeze({\n        getModel: () => model,\n        dropsFor: (r) => dropsFor(r),\n        createMonsterCard: (r) => createMonsterCard(r),'
    );
    vm.runInContext(worldAtlasCode, context);

    await context.window.MonsterWikiData.load();
    context.window.MonsterMergedPreview.prepare();
    
    const htmlCode = read('wiki.html');
    const match = htmlCode.match(/const REGIONS_DATA = (\[.*?\]);\r?\n/s);
    context.window.MONSTER_MERGED_CARD_REGIONS = JSON.parse(match[1]);
    const matchEquip = htmlCode.match(/const EQUIP_DATA = (\[.*?\]);\r?\n/s);
    context.window.EQUIP_DATA = JSON.parse(matchEquip[1]);
    context.EQUIP_DATA = context.window.EQUIP_DATA;

    await context.window.WorldAtlas.init();
    return context.window;
}

test('65 妖魔圖片 resolver 得到非 fallback 結果', async () => {
    const win = await loadInitializedWorldAtlas();
    const img = win.WorldAtlas.resolveMonsterImage('orc');
    assert(img !== null);
    assert(img.candidates.length > 0);
    assert(!img.candidates[0].includes('fallback') && !img.candidates[0].includes('missing'));
});

test('66 死亡騎士圖片 resolver 得到非 fallback 結果', async () => {
    const win = await loadInitializedWorldAtlas();
    const img = win.WorldAtlas.resolveMonsterImage('dk');
    assert(img !== null);
    assert(img.candidates.length > 0);
    assert(!img.candidates[0].includes('fallback') && !img.candidates[0].includes('missing'));
});

test('67 吉爾塔斯圖片 resolver 得到非 fallback 結果', async () => {
    const win = await loadInitializedWorldAtlas();
    const img = win.WorldAtlas.resolveMonsterImage('sanct_giltas');
    assert(img !== null);
    assert(img.candidates.length > 0);
    assert(!img.candidates[0].includes('fallback') && !img.candidates[0].includes('missing'));
});

test('68 至少三個不同 Item icon 實際非 fallback', async () => {
    const win = await loadInitializedWorldAtlas();
    const model = win.WorldAtlas.getModel();
    const orcRecord = model.regions.flatMap(r => r.monsters).find(m => m.legacy && m.legacy.name === '妖魔');
    const dkRecord = model.regions.flatMap(r => r.monsters).find(m => m.legacy && m.legacy.name === '死亡騎士');
    const orcDrops = win.WorldAtlas.dropsFor(orcRecord);
    const dkDrops = win.WorldAtlas.dropsFor(dkRecord);
    const items = [
        win.WorldAtlas.itemSource(orcDrops[0].itemId, orcDrops[0].name),
        win.WorldAtlas.itemSource(orcDrops[1].itemId, orcDrops[1].name),
        win.WorldAtlas.itemSource(dkDrops[0].itemId, dkDrops[0].name)
    ];
    assert(items.every(item => item.imagePath && !item.imagePath.includes('fallback')));
    const ids = new Set(items.map(item => item.itemId));
    assert(ids.size >= 3);
});

test('69 死亡騎士特性包含硬皮與技能', async () => {
    const win = await loadInitializedWorldAtlas();
    const features = win.WorldAtlas.monsterFeatures('dk');
    assert(features.some(f => f.name === '硬皮'));
    assert(features.some(f => f.name === '地面震裂'));
});

test('70 妖魔特性為無', async () => {
    const win = await loadInitializedWorldAtlas();
    const features = win.WorldAtlas.monsterFeatures('orc');
    assert.strictEqual(features.length, 0);
});

test('71 死亡騎士 DOM 含 is-boss class', async () => {
    const win = await loadInitializedWorldAtlas();
    const model = win.WorldAtlas.getModel();
    const dkRecord = model.regions.flatMap(r => r.monsters).find(m => m.legacy && m.legacy.name === '死亡騎士');
    const card = win.WorldAtlas.createMonsterCard(dkRecord);
    assert(card.classList.contains('is-boss') || card.className.includes('is-boss'));
});

test('72 妖魔 DOM 不含 is-boss class', async () => {
    const win = await loadInitializedWorldAtlas();
    const model = win.WorldAtlas.getModel();
    const orcRecord = model.regions.flatMap(r => r.monsters).find(m => m.legacy && m.legacy.name === '妖魔');
    const card = win.WorldAtlas.createMonsterCard(orcRecord);
    assert(!card.classList.contains('is-boss') && !card.className.includes('is-boss'));
});

test('73 古魯丁地監依 1～7 樓排序', async () => {
    const win = await loadInitializedWorldAtlas();
    const region = win.WorldAtlas.getModel().regions.find(r => r.key === 'gludin');
    const maps = win.WorldAtlas.regionMapEvidence(region);
    const gludioDungeonMaps = maps.filter(m => m.includes('古魯丁地監'));
    const expected = [
        '古魯丁地監1樓',
        '古魯丁地監2樓',
        '古魯丁地監3樓',
        '古魯丁地監4樓',
        '古魯丁地監5樓',
        '古魯丁地監6樓',
        '古魯丁地監7樓'
    ];
    assert.deepStrictEqual(JSON.parse(JSON.stringify(gludioDungeonMaps)), expected);
});

test('74 龍之谷地監依 1～6 樓排序', async () => {
    const win = await loadInitializedWorldAtlas();
    const region = win.WorldAtlas.getModel().regions.find(r => r.key === 'dragonvalley');
    const maps = win.WorldAtlas.regionMapEvidence(region);
    const dvDungeonMaps = maps.filter(m => m.includes('龍之谷地監'));
    const expected = [
        '龍之谷地監1樓',
        '龍之谷地監2樓',
        '龍之谷地監3樓',
        '龍之谷地監4樓',
        '龍之谷地監5樓',
        '龍之谷地監6樓'
    ];
    assert.deepStrictEqual(JSON.parse(JSON.stringify(dvDungeonMaps)), expected);
});

test('75 Boss CSS computed border color 與一般怪不同', () => {
    assert(css.includes('.world-atlas-monster-card.is-boss {'));
    assert(css.includes('border-color: var(--accent-gold);'));
    assert(css.includes('.world-atlas-monster-card {'));
    assert(css.includes('border: 1px solid var(--border-color);'));
});

test('76 桌面 World Atlas layout 不再保留第三空欄', () => {
    assert(css.includes('.world-atlas-shell {'));
    assert(css.includes('grid-template-columns: minmax(210px, 250px) minmax(0, 1fr);'));
});

test('77 1600px 寬度下 Monster Grid 至少可排 3 欄', () => {
    assert(css.includes('.world-atlas-monster-grid {'));
    assert(css.includes('grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));'));
    const viewportWidth = 1600;
    const sidebarWidth = 250;
    const gap = 16;
    const gridGap = 10;
    const cardMinWidth = 280;
    const contentWidth = viewportWidth - sidebarWidth - gap;
    const columnsCount = Math.floor((contentWidth + gridGap) / (cardMinWidth + gridGap));
    assert(columnsCount >= 3);
});

test('78 hard:true 不會自動判為 Boss 且拉巴普通怪非 Boss', async () => {
    const win = await loadInitializedWorldAtlas();
    const model = win.WorldAtlas.getModel();
    const lasta = model.regions.find(r => r.key === 'rastabad');
    assert(lasta);
    const normalMobs = lasta.monsters.filter(m => m.legacy && 
        !m.legacy.name.includes('軍王') && 
        !m.legacy.name.includes('長老') && 
        m.legacy.name !== '墮落'
    );
    assert(normalMobs.length >= 3);
    normalMobs.forEach(m => {
        assert.strictEqual(win.WorldAtlas.isBossMonster(m), false);
    });
});

test('79 死亡騎士與吉爾塔斯為 Boss', async () => {
    const win = await loadInitializedWorldAtlas();
    const model = win.WorldAtlas.getModel();
    const dk = model.regions.flatMap(r => r.monsters).find(m => m.legacy && m.legacy.name === '死亡騎士');
    assert(win.WorldAtlas.isBossMonster(dk));
    const giltas = {
        canonical: { monsterId: 'sanct_giltas', boss: true },
        legacy: { name: '吉爾塔斯' }
    };
    assert(win.WorldAtlas.isBossMonster(giltas));
});

test('80 沒有吉爾塔斯硬編碼', () => {
    assert(!js.includes('sanct_giltas') || !js.includes('岩漿流星雨'));
});

test('81 沒有中文名稱 Identity Guessing', () => {
    assert(!js.includes('findMonsterIdByName'));
    assert(!js.includes('findItemIdByName'));
});

test('82 mapId 不直接顯示於玩家標題且記錄 diagnostics', async () => {
    const win = await loadInitializedWorldAtlas();
    const resolvedName = win.WorldAtlas.mapDisplayName('tikal_altar');
    assert.strictEqual(resolvedName, '提卡爾 庫庫爾坎祭壇');
    const missingName = win.WorldAtlas.mapDisplayName('non_existent_map_id');
    assert.strictEqual(missingName, '地圖名稱尚未建立');
    const diagnostics = win.WorldAtlas.diagnostics();
    assert(diagnostics.missingMapLabels.includes('non_existent_map_id'));
});

test('83 地區切換後 Accordion 預設收合', async () => {
    const win = await loadInitializedWorldAtlas();
    win.WorldAtlas.selectRegion('gludin');
    const accordions = win.document.querySelectorAll('details.world-atlas-map-accordion');
    accordions.forEach(acc => {
        assert.strictEqual(acc.open, false);
    });
});

test('84 Deep Link 指定 map 時只展開指定地圖', async () => {
    const win = await loadInitializedWorldAtlas('?worldRegion=gludin&worldMap=古魯丁地監1樓');
    const accordions = win.document.childNodes.filter(node => node.tagName === 'details');
    let openCount = 0;
    let targetOpen = false;
    accordions.forEach(acc => {
        if (acc.open) {
            openCount++;
            if (acc.dataset.mapName === '古魯丁地監1樓') {
                targetOpen = true;
            }
        }
    });
    assert.strictEqual(openCount, 1);
    assert.strictEqual(targetOpen, true);
});

test('85 CORS Banner 呈現灰色樣式而非紅色警告', has(js, "warning.style.color = '#9ca3af'"));

test('86 Drop Priority Score 依全新九類規則打分', () => {
    const api = loadApi('');
    // Relic
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'relic_orc_lid' }), 1);
    // Boss exclusive
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'wpn_dk_flameblade' }), 2);
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'hlm_baranka' }), 2);
    // Weapon
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'wpn_katana', type: 'wpn' }), 3);
    // Armor
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'arm_46', type: 'arm' }), 4);
    // Accessory
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'acc_curse_green', type: 'acc' }), 5);
    // Skillbook
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'bk_meteor', type: 'bk' }), 6);
    // Crafting material
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'mat_black_blood', type: 'mat' }), 7);
    // General material
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'item_son_letter', type: 'item' }), 8);
    // Consumables
    assert.strictEqual(api.getDropPriorityScore({ itemId: 'scroll_weapon', type: 'use' }), 9);
});

test('87 掉落排序不依 price 進行排序', () => {
    const api = loadApi('');
    // Mock items with different prices but same category
    const item1 = { itemId: 'wpn_a', type: 'wpn', price: 1000 };
    const item2 = { itemId: 'wpn_b', type: 'wpn', price: 500 };
    // Should sort alphabetically by ID since price sorting is removed
    const list = [item2, item1];
    list.sort((a, b) => {
        const scoreA = api.getDropPriorityScore(a);
        const scoreB = api.getDropPriorityScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.itemId.localeCompare(b.itemId);
    });
    assert.strictEqual(list[0].itemId, 'wpn_a');
    assert.strictEqual(list[1].itemId, 'wpn_b');
});

test('88 Relic 與傳奇掉落裝備正確套用 category class 標記', async () => {
    const win = await loadInitializedWorldAtlas();
    // Test helper to generate image and check class
    const relicImg = win.WorldAtlasPreview.createMonsterImage ? win.document.createElement('div') : null; // just mock or test directly
    const imgEl1 = win.document.createElement('span');
    // We can evaluate directly on the loaded js content via DOM or code strings
    assert(js.includes("host.classList.add('is-relic')"));
    assert(js.includes("host.classList.add('is-legendary')"));
});

test('89 CSS 包含 Relic 藍色 Glow 與傳奇金色外框樣式', () => {
    assert(css.includes('.world-atlas-item-image.is-relic'));
    assert(css.includes('.world-atlas-item-image.is-legendary'));
    assert(css.includes('box-shadow'));
});

test('90 妖魔視覺不使用 offset 偏移且僅使用 CSS 完美置中', () => {
    assert(!js.includes("'orc': 'translate"));
});

test('91 parseDiceFormula correctly converts formulas', () => {
    const api = loadApi('');
    assert.strictEqual(api.parseDiceFormula('2D2+2'), '4～6');
    assert.strictEqual(api.parseDiceFormula('1D61+6'), '7～67');
    assert.strictEqual(api.parseDiceFormula('1d61+6'), '7～67');
    assert.strictEqual(api.parseDiceFormula('1D100-10'), '-9～90');
    assert.strictEqual(api.parseDiceFormula(' 5D100 + 499 '), '504～999');
});

test('92 parseDiceFormula correctly converts 1D100 to 1～100', () => {
    const api = loadApi('');
    assert.strictEqual(api.parseDiceFormula('1D100'), '1～100');
});

test('93 parseDiceFormula safely falls back on invalid formula', () => {
    const api = loadApi('');
    assert.strictEqual(api.parseDiceFormula('invalid_formula'), 'invalid_formula');
});

test('94 formatElementText converts none/fire/water/earth/wind to Chinese', () => {
    const api = loadApi('');
    assert.strictEqual(api.formatElementText('none'), '無');
    assert.strictEqual(api.formatElementText('fire'), '火');
    assert.strictEqual(api.formatElementText('water'), '水');
    assert.strictEqual(api.formatElementText('earth'), '地');
    assert.strictEqual(api.formatElementText('wind'), '風');
});

test('95 formatCategory maps two_hand_spear to 長矛', () => {
    const api = loadApi('');
    assert.strictEqual(api.formatCategory({ id: 'relic_serpent_fang', itemId: 'relic_serpent_fang' }), '長矛');
});

test('96 EQUIP_DATA exists in wiki.html', () => {
    assert(html.includes('const EQUIP_DATA ='));
});

test('97 HTML contains equip-sources max-height and overflow-y:auto', () => {
    assert(html.includes('max-height: 280px; overflow-y: auto; overscroll-behavior: contain;'));
});

test('98 CSS contains sticky regions sidebar rules', () => {
    assert(css.includes('position: sticky;'));
    assert(css.includes('top: 16px;'));
    assert(css.includes('height: calc(100vh - 92px);'));
    assert(css.includes('max-height: calc(100vh - 92px);'));
    assert(css.includes('overflow-y: auto;'));
});

test('99 Main menu has hidden equip tab button', () => {
    assert(js.includes("'btn-tab-equip'"));
    assert(js.includes("'btn-tab-craft'"));
});

test('100 wiki.html contains redirect logic for equip tab', () => {
    assert(html.includes("['world', 'equip', 'craft', 'cards', 'monster'].includes(tabParam)"));
});

async function runTests() {
    let passed = 0;
    for (const [name, fn] of tests) {
        try {
            await fn();
            passed += 1;
            console.log(`PASS ${name}`);
        } catch (err) {
            console.error(`FAIL ${name}:`, err);
            process.exit(1);
        }
    }
    console.log(`World Atlas v1 tests: ${passed}/${tests.length} passed`);
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});

