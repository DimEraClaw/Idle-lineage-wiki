'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'monster');
const payloads = {
    'monsters.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'monsters.json'), 'utf8')),
    'maps.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'maps.json'), 'utf8')),
    'drop_tables.json': JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'drop_tables.json'), 'utf8'))
};

function extractEquipData() {
    const html = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8');
    const marker = 'const EQUIP_DATA = ';
    const start = html.indexOf(marker);
    assert(start >= 0, 'EQUIP_DATA marker must exist');
    const valueStart = start + marker.length;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let index = valueStart; index < html.length; index += 1) {
        const char = html[index];
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
            if (depth === 0) { end = index + 1; break; }
        }
    }
    assert(end > valueStart, 'EQUIP_DATA terminator must exist');
    return JSON.parse(html.slice(valueStart, end));
}

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(value) { this.values.add(value); }
    remove(value) { this.values.delete(value); }
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
        get index() { return index; },
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
    window.history = createHistory(window, options.url || 'http://local/wiki.html?monsterUI=1&tab=monster');
    const fetch = async url => {
        const name = String(url).split('/').pop();
        fetches.push(name);
        if (options.failure === 'http' && name === 'maps.json') return { ok: false, status: 404, json: async () => null };
        if (options.failure === 'parse' && name === 'maps.json') return { ok: true, status: 200, json: async () => { throw new SyntaxError('invalid json'); } };
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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function run() {
    const checks = [];
    const check = async (name, test) => { await test(); checks.push(name); };
    const equipData = extractEquipData();

    await check('Feature Flag 關閉不 fetch Monster JSON', async () => {
        const env = createEnvironment({ url: 'http://local/wiki.html?tab=monster&monster=orc' });
        const enabled = new URLSearchParams(env.window.location.search).get('monsterUI') === '1';
        if (enabled) await env.window.MonsterWikiView.init();
        assert.strictEqual(env.fetches.length, 0);
    });

    const env = createEnvironment({ url: 'http://local/wiki.html?monsterUI=1&tab=monster&monster=orc' });
    env.window.MonsterWikiData.setItemLabelSource(equipData);
    await check('Feature Flag 開啟載入三份 JSON', async () => {
        assert.strictEqual(await env.window.MonsterWikiView.init(), true);
        assert.deepStrictEqual(env.fetches.slice().sort(), ['drop_tables.json', 'maps.json', 'monsters.json']);
    });
    await check('monster=orc 還原 Detail', async () => {
        env.window.MonsterWikiView.activate();
        assert.match(env.dom.elements.get('monster-detail').textContent, /妖魔/);
    });
    await check('不存在 Monster ID 顯示空狀態', async () => {
        env.window.MonsterWikiView.openMonster('missing_monster', 'replace');
        assert.match(env.dom.elements.get('monster-detail').textContent, /找不到此怪物資料/);
    });
    await check('搜尋 Monster 後 URL 同步', async () => {
        env.window.MonsterWikiView.search('妖魔');
        assert.strictEqual(new URL(env.window.location.href).searchParams.get('monsterSearch'), '妖魔');
    });
    await check('關閉 Detail 移除 monster query', async () => {
        env.window.MonsterWikiView.openMonster('orc', 'replace');
        env.window.MonsterWikiView.closeDetail('push');
        assert.strictEqual(new URL(env.window.location.href).searchParams.has('monster'), false);
    });
    await check('popstate 可從 Monster B 回 Monster A', async () => {
        env.window.MonsterWikiView.openMonster('orc', 'push');
        env.window.MonsterWikiView.openMonster('skeleton', 'push');
        env.window.history.back();
        assert.strictEqual(env.window.MonsterWikiView.readUrlState().monsterId, 'orc');
        assert.match(env.dom.elements.get('monster-detail').textContent, /妖魔/);
    });
    await check('重新整理 deep link 正常', async () => {
        const refreshed = createEnvironment({ url: 'http://local/wiki.html?monsterUI=1&tab=monster&monster=orc' });
        refreshed.window.MonsterWikiData.setItemLabelSource(equipData);
        await refreshed.window.MonsterWikiView.init();
        refreshed.window.MonsterWikiView.activate();
        assert.match(refreshed.dom.elements.get('monster-detail').textContent, /妖魔/);
    });
    await check('Drop Item ID 可反向找到怪物', async () => {
        assert(env.window.MonsterWikiData.searchDrops('wpn_25')[0].monsters.length > 0);
    });
    await check('Drop Item 名稱可反向找到怪物', async () => {
        assert(env.window.MonsterWikiData.searchDrops('歐西斯之矛')[0].monsters.length > 0);
    });
    await check('同一 Item 多 Monster 全部保留', async () => {
        const byId = env.window.MonsterWikiData.getMonstersDroppingItem('scroll_armor');
        assert(byId.length > 1);
        assert.strictEqual(env.window.MonsterWikiData.searchDrops('scroll_armor')[0].monsters.length, byId.length);
    });
    await check('Item label source 失敗仍顯示 ID', async () => {
        assert.strictEqual(env.window.MonsterWikiData.setItemLabelSource(null), false);
        const item = env.window.MonsterWikiData.getItemDisplay('wpn_25');
        assert.deepStrictEqual(clone(item), { itemId: 'wpn_25', displayName: null, resolved: false, source: null });
        assert(env.window.MonsterWikiData.getMonstersDroppingItem('wpn_25').length > 0);
        env.window.MonsterWikiData.setItemLabelSource(equipData);
    });
    await check('Monster JSON 404 時 Tab 隱藏', async () => {
        const failed = createEnvironment({ failure: 'http' });
        assert.strictEqual(await failed.window.MonsterWikiView.init(), false);
        assert.strictEqual(failed.dom.elements.get('btn-tab-monster').hidden, true);
        assert.strictEqual(failed.warnings.length, 1);
    });
    await check('Monster JSON parse error fallback', async () => {
        const failed = createEnvironment({ failure: 'parse' });
        assert.strictEqual(await failed.window.MonsterWikiView.init(), false);
        assert.strictEqual(failed.window.MonsterWikiData.getState().counts.monsters, 0);
    });
    await check('不重複事件綁定', async () => {
        const before = env.dom.pane.listeners.get('click').length;
        assert.strictEqual(await env.window.MonsterWikiView.init(), true);
        assert.strictEqual(env.dom.pane.listeners.get('click').length, before);
        assert.strictEqual(env.windowListeners.get('popstate').length, 1);
    });
    await check('中文 Monster 搜尋', async () => {
        assert(env.window.MonsterWikiData.searchMonsters('妖魔').some(monster => monster.monsterId === 'orc'));
    });
    await check('Monster ID 大小寫不敏感搜尋', async () => {
        assert(env.window.MonsterWikiData.searchMonsters('ORC').some(monster => monster.monsterId === 'orc'));
        assert.strictEqual(env.window.MonsterWikiData.getMonsterById('ORC').monsterId, 'orc');
    });
    await check('Base probability 顯示正確單位', async () => {
        assert.strictEqual(env.window.MonsterWikiView.formatProbability({ value: 0.1, unit: 'percent', basis: 100 }), '0.1%');
    });
    await check('無 Map／Drop 顯示資料尚未建立', async () => {
        env.window.MonsterWikiView.renderMonster('aton_enemy');
        assert.match(env.dom.elements.get('monster-detail').textContent, /資料尚未建立/);
    });
    await check('Existing Equipment／Craft／Cards baseline 接線保留', async () => {
        const html = fs.readFileSync(path.join(ROOT, 'wiki.html'), 'utf8');
        ['btn-tab-equip', 'btn-tab-craft', 'btn-tab-cards', 'initEquipWiki()', 'initCraftWikiWithFallback()', 'initCardsGuide()']
            .forEach(token => assert(html.includes(token), `missing existing baseline token: ${token}`));
    });
    await check('Repository 回傳 snapshot', async () => {
        const monster = env.window.MonsterWikiData.getMonsterById('orc');
        monster.displayName = 'changed';
        assert.strictEqual(env.window.MonsterWikiData.getMonsterById('orc').displayName, '妖魔');
    });

    console.log(`Monster UI Beta tests passed: ${checks.length}/${checks.length}`);
    checks.forEach(name => console.log(`PASS ${name}`));
}

run().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
