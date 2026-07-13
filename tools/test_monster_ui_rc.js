'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8');
const DATA_DIR = path.join(ROOT, 'data', 'monster');
const payloads = {
    'monsters.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'monsters.json'), 'utf8')),
    'maps.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'maps.json'), 'utf8')),
    'drop_tables.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'drop_tables.json'), 'utf8'))
};

function extractEquipData() {
    const marker = 'const EQUIP_DATA = ';
    const start = HTML.indexOf(marker);
    assert(start >= 0, 'EQUIP_DATA marker must exist');
    const valueStart = start + marker.length;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = valueStart; index < HTML.length; index += 1) {
        const char = HTML[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === '[' || char === '{') depth += 1;
        else if (char === ']' || char === '}') {
            depth -= 1;
            if (depth === 0) return JSON.parse(HTML.slice(valueStart, index + 1));
        }
    }
    throw new Error('EQUIP_DATA terminator must exist');
}

class FakeClassList {
    constructor() { this.values = new Set(); }
    toggle(value, force) {
        if (force === true) this.values.add(value);
        else if (force === false) this.values.delete(value);
        else if (this.values.has(value)) this.values.delete(value);
        else this.values.add(value);
    }
}

class FakeElement {
    constructor(tag, id) {
        this.tagName = tag.toUpperCase();
        this.id = id || '';
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.classList = new FakeClassList();
        this.attributes = {};
        this.listeners = new Map();
        this.value = '';
        this.hidden = false;
        this._text = '';
    }
    get firstChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value == null ? '' : value); this.children = []; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; return child; }
    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(handler);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    closest(selector) {
        let node = this;
        while (node) {
            if (selector === '[data-monster-action]' && node.dataset.monsterAction) return node;
            if (selector === '[data-monster-mode]' && node.dataset.monsterMode) return node;
            node = node.parentNode;
        }
        return null;
    }
}

function createDom() {
    const elements = new Map();
    const add = (tag, id) => {
        const node = new FakeElement(tag, id);
        elements.set(id, node);
        return node;
    };
    const documentElement = add('html', 'document-element');
    const pane = add('div', 'tab-content-monster');
    const button = add('button', 'btn-tab-monster');
    button.hidden = true;
    const input = add('input', 'search-monster');
    const results = add('div', 'monster-search-results');
    const detail = add('div', 'monster-detail');
    const monsterMode = add('button', 'mode-monster');
    monsterMode.dataset.monsterMode = 'monster';
    const dropMode = add('button', 'mode-drop');
    dropMode.dataset.monsterMode = 'drop';
    [input, results, detail, monsterMode, dropMode].forEach(node => pane.appendChild(node));
    const document = {
        documentElement,
        createElement: tag => new FakeElement(tag),
        createTextNode: text => { const node = new FakeElement('#text'); node.textContent = text; return node; },
        getElementById: id => elements.get(id) || null,
        querySelectorAll: selector => selector === '[data-monster-mode]' ? [monsterMode, dropMode] : []
    };
    return { document, elements, pane };
}

function createHistory(window, initialUrl) {
    const entries = [initialUrl];
    let index = 0;
    function setLocation(url) {
        const parsed = new URL(url, entries[index]);
        window.location.href = parsed.toString();
        window.location.search = parsed.search;
    }
    setLocation(initialUrl);
    return {
        entries,
        replaceState(_state, _title, url) { entries[index] = new URL(url, entries[index]).toString(); setLocation(entries[index]); },
        pushState(_state, _title, url) { entries.splice(index + 1); entries.push(new URL(url, entries[index]).toString()); index += 1; setLocation(entries[index]); },
        back() { if (index > 0) { index -= 1; setLocation(entries[index]); window.dispatch('popstate'); } },
        forward() { if (index + 1 < entries.length) { index += 1; setLocation(entries[index]); window.dispatch('popstate'); } }
    };
}

function createEnvironment(options = {}) {
    const fetches = [];
    const warnings = [];
    const windowListeners = new Map();
    const dom = createDom();
    const window = {
        location: { href: '', search: '' },
        addEventListener(type, handler) {
            if (!windowListeners.has(type)) windowListeners.set(type, []);
            windowListeners.get(type).push(handler);
        },
        dispatch(type) { (windowListeners.get(type) || []).forEach(handler => handler({ type })); },
        setTimeout: handler => { handler(); return 1; },
        clearTimeout() {},
        switchTab(tabId) { window.lastTab = tabId; if (tabId === 'monster' && window.MonsterWikiView) window.MonsterWikiView.activate(); }
    };
    window.history = createHistory(window, options.url || 'http://local/wiki.html?tab=monster');
    const fetch = async url => {
        const name = String(url).split('/').pop();
        fetches.push(name);
        if (options.httpFailure === name) return { ok: false, status: 404, json: async () => null };
        if (options.parseFailure === name) return { ok: true, status: 200, json: async () => { throw new SyntaxError('invalid json'); } };
        return { ok: true, status: 200, json: async () => payloads[name] };
    };
    const context = {
        window,
        document: dom.document,
        fetch,
        console: { warn: message => warnings.push(String(message)), error: console.error, log: console.log },
        URL, URLSearchParams, Map, Set, Promise, Object, Array, String, Number, Boolean,
        Math, JSON, Error, SyntaxError, Reflect, Symbol
    };
    vm.createContext(context);
    ['wiki-monster-data.js', 'wiki-monster-view.js'].forEach(name => {
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', name), 'utf8'), context, { filename: name });
    });
    return { window, fetches, warnings, dom, windowListeners };
}

async function initialize(options = {}) {
    const env = createEnvironment(options);
    env.window.MonsterWikiData.setItemLabelSource(options.itemLabels === false ? null : extractEquipData());
    env.ready = await env.window.MonsterWikiView.init();
    if (env.ready) env.window.MonsterWikiView.activate();
    return env;
}

async function run() {
    const checks = [];
    const check = async (name, test) => { await test(); checks.push(name); };

    await check('正式開關預設啟用且不再使用 Alpha 命名', async () => {
        assert(HTML.includes('window.MONSTER_UI_ENABLED = true;'));
        assert(HTML.includes('function isMonsterUIEnabled()'));
        assert(!HTML.includes('MONSTER_UI_ALPHA'));
        assert(!fs.readFileSync(path.join(ROOT, 'js', 'wiki-monster-view.js'), 'utf8').includes('monsterUiAlpha'));
    });
    const env = await initialize({ url: 'http://local/wiki.html?tab=monster&monster=orc' });
    await check('不帶 monsterUI=1 載入三份 JSON 並顯示 Tab', async () => {
        assert.strictEqual(env.ready, true);
        assert.deepStrictEqual(env.fetches.slice().sort(), ['drop_tables.json', 'maps.json', 'monsters.json']);
        assert.strictEqual(env.dom.elements.get('btn-tab-monster').hidden, false);
    });
    await check('正式 deep link 還原妖魔 Detail', async () => {
        assert.match(env.dom.elements.get('monster-detail').textContent, /妖魔/);
    });
    await check('舊 monsterUI=1 deep link 相容且保留 query', async () => {
        const legacy = await initialize({ url: 'http://local/wiki.html?monsterUI=1&tab=monster&monster=orc' });
        legacy.window.MonsterWikiView.search('妖魔');
        assert.match(legacy.dom.elements.get('monster-detail').textContent, /妖魔/);
        assert.strictEqual(new URL(legacy.window.location.href).searchParams.get('monsterUI'), '1');
    });
    await check('不存在 ID 顯示空狀態', async () => {
        env.window.MonsterWikiView.openMonster('missing_monster', 'replace');
        assert.match(env.dom.elements.get('monster-detail').textContent, /找不到此怪物資料/);
    });
    await check('Monster 名稱與 ID 搜尋正常', async () => {
        assert(env.window.MonsterWikiData.searchMonsters('妖魔').some(monster => monster.monsterId === 'orc'));
        assert(env.window.MonsterWikiData.searchMonsters('ORC').some(monster => monster.monsterId === 'orc'));
    });
    await check('Drop 名稱與 ID 反向查詢正常', async () => {
        assert(env.window.MonsterWikiData.searchDrops('歐西斯之矛')[0].monsters.length > 0);
        assert(env.window.MonsterWikiData.searchDrops('wpn_25')[0].monsters.length > 0);
    });
    await check('Reload 保持 Detail', async () => {
        const refreshed = await initialize({ url: env.window.location.href.replace('missing_monster', 'orc') });
        assert.match(refreshed.dom.elements.get('monster-detail').textContent, /妖魔/);
    });
    await check('Back／Forward 還原 Monster', async () => {
        env.window.MonsterWikiView.openMonster('orc', 'push');
        env.window.MonsterWikiView.openMonster('skeleton', 'push');
        env.window.history.back();
        assert.strictEqual(env.window.MonsterWikiView.readUrlState().monsterId, 'orc');
        env.window.history.forward();
        assert.strictEqual(env.window.MonsterWikiView.readUrlState().monsterId, 'skeleton');
    });
    await check('關閉 Detail 移除 monster query', async () => {
        env.window.MonsterWikiView.closeDetail('push');
        assert.strictEqual(new URL(env.window.location.href).searchParams.has('monster'), false);
    });
    await check('三份必要 JSON 任一 404 均安全失敗', async () => {
        for (const name of ['monsters.json', 'maps.json', 'drop_tables.json']) {
            const failed = await initialize({ httpFailure: name });
            assert.strictEqual(failed.ready, false);
            assert.strictEqual(failed.dom.elements.get('btn-tab-monster').hidden, true);
            assert.strictEqual(failed.window.MonsterWikiData.getState().counts.monsters, 0);
            assert.strictEqual(failed.warnings.length, 1);
        }
        assert(HTML.includes("if (!monsterReady && tabParam === 'monster') tabParam = 'equip';"));
    });
    await check('JSON parse error 安全 fallback', async () => {
        const failed = await initialize({ parseFailure: 'maps.json' });
        assert.strictEqual(failed.ready, false);
        assert.strictEqual(failed.dom.elements.get('btn-tab-monster').hidden, true);
        assert.strictEqual(failed.warnings.length, 1);
    });
    await check('Item label 失敗仍保留 ready 與 Item ID', async () => {
        const noLabels = await initialize({ itemLabels: false });
        assert.strictEqual(noLabels.ready, true);
        assert.strictEqual(noLabels.window.MonsterWikiData.getState().ready, true);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(noLabels.window.MonsterWikiData.getItemDisplay('wpn_25'))), {
            itemId: 'wpn_25', displayName: null, resolved: false, source: null
        });
    });
    await check('初始化與事件綁定不重複', async () => {
        const before = env.dom.pane.listeners.get('click').length;
        assert.strictEqual(await env.window.MonsterWikiView.init(), true);
        assert.strictEqual(env.dom.pane.listeners.get('click').length, before);
        assert.strictEqual(env.windowListeners.get('popstate').length, 1);
    });
    await check('玩家文字與既有分頁 baseline 正常', async () => {
        const playerSection = HTML.slice(HTML.indexOf('<header'), HTML.indexOf('<script src="./js/wiki-data-core.js"'));
        assert(!/怪物百科\s*(Alpha|Beta)/i.test(playerSection));
        assert(playerSection.includes('👹 怪物百科'));
        ['btn-tab-equip', 'btn-tab-craft', 'btn-tab-cards', 'initEquipWiki()', 'initCraftWikiWithFallback()', 'initCardsGuide()']
            .forEach(token => assert(HTML.includes(token), `missing existing baseline token: ${token}`));
    });

    const betaOutput = childProcess.execFileSync(process.execPath, [path.join(ROOT, 'tools', 'test_monster_ui_beta.js')], { encoding: 'utf8' });
    assert(betaOutput.includes('Monster UI Beta tests passed: 21/21'));
    console.log(`Monster UI RC tests passed: ${checks.length}/${checks.length}`);
    checks.forEach(name => console.log(`PASS ${name}`));
    console.log('PASS Existing Monster UI Beta tests 21/21');
}

run().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
