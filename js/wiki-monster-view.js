(function (global) {
    'use strict';

    const UNRESOLVED_TEXT = '資料尚未建立';
    const MISSING_MONSTER_TEXT = '找不到此怪物資料';
    const DROP_SCOPE_TEXT = '目前顯示遊戲基礎掉落表，不包含尚未建模的特殊或條件掉落。';
    const SEARCH_DELAY = 180;
    let initialized = false;
    let eventsBound = false;
    let debounceTimer = null;
    let currentMode = 'monster';
    let currentSearch = '';
    let currentMonsterId = null;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function normalizeMode(value) {
        return value === 'drop' ? 'drop' : 'monster';
    }

    function readUrlState() {
        const params = new URLSearchParams(global.location.search);
        return {
            tab: params.get('tab') || 'equip',
            mode: normalizeMode(params.get('monsterMode')),
            search: params.get('monsterSearch') || '',
            monsterId: params.get('monster') || null
        };
    }

    function writeUrlState(historyMode) {
        const url = new URL(global.location.href);
        url.searchParams.set('tab', 'monster');
        url.searchParams.set('monsterMode', currentMode);
        if (currentSearch) url.searchParams.set('monsterSearch', currentSearch);
        else url.searchParams.delete('monsterSearch');
        if (currentMonsterId) url.searchParams.set('monster', currentMonsterId);
        else url.searchParams.delete('monster');
        url.searchParams.delete('search');
        if (url.toString() === global.location.href) return false;
        global.history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', url.toString());
        return true;
    }

    function formatProbability(probability) {
        if (!probability || probability.value == null) return UNRESOLVED_TEXT;
        if (probability.unit === 'percent') return `${probability.value}%`;
        return `${probability.value} ${probability.unit || ''}`.trim();
    }

    function formatQuantity(quantity) {
        if (!quantity || quantity.min == null || quantity.max == null) return UNRESOLVED_TEXT;
        return quantity.min === quantity.max ? String(quantity.min) : `${quantity.min}–${quantity.max}`;
    }

    function mapLabel(map) {
        return map.displayName || `${map.mapId}（名稱資料尚未建立）`;
    }

    function appendMeta(container, label, value) {
        const row = element('div', 'recipe-meta');
        row.appendChild(element('strong', '', `${label}：`));
        row.appendChild(document.createTextNode(value == null || value === '' ? UNRESOLVED_TEXT : String(value)));
        container.appendChild(row);
    }

    function createMonsterButton(monster, extraText) {
        const button = element('button', 'category-btn');
        button.type = 'button';
        button.dataset.monsterAction = 'open';
        button.dataset.monsterId = monster.monsterId;
        button.appendChild(element('strong', '', monster.displayName || UNRESOLVED_TEXT));
        button.appendChild(document.createTextNode(`（${monster.monsterId}）${extraText ? ` ${extraText}` : ''}`));
        return button;
    }

    function renderMonsterResults(keyword) {
        const host = document.getElementById('monster-search-results');
        if (!host) return;
        clear(host);
        if (!keyword) {
            host.appendChild(element('p', '', '請輸入怪物名稱或 Monster ID。'));
            return;
        }
        const results = global.MonsterWikiData.searchMonsters(keyword);
        if (!results.length) {
            host.appendChild(element('p', '', '找不到符合的怪物。'));
            return;
        }
        results.forEach(monster => host.appendChild(createMonsterButton(monster)));
    }

    function renderDropResults(keyword) {
        const host = document.getElementById('monster-search-results');
        if (!host) return;
        clear(host);
        host.appendChild(element('p', '', DROP_SCOPE_TEXT));
        if (!keyword) {
            host.appendChild(element('p', '', '請輸入正式物品名稱或 Item ID。'));
            return;
        }
        const results = global.MonsterWikiData.searchDrops(keyword);
        if (!results.length) {
            host.appendChild(element('p', '', '找不到符合的基礎掉落。'));
            return;
        }
        results.forEach(result => {
            const section = element('section', 'recipe-card');
            const label = result.item.displayName || result.item.itemId;
            section.appendChild(element('h3', '', label));
            appendMeta(section, 'Item ID', result.item.itemId);
            if (!result.item.resolved) section.appendChild(element('p', '', '名稱資料尚未建立'));
            appendMeta(section, '掉落怪物數量', result.monsters.length);
            result.monsters.forEach(record => {
                const mapText = record.maps.length ? record.maps.map(mapLabel).join('、') : UNRESOLVED_TEXT;
                const bossText = record.boss === true ? 'Boss' : '一般怪物';
                const probability = formatProbability(record.drop.probability);
                section.appendChild(createMonsterButton(record, `${bossText}｜${mapText}｜基礎掉率 ${probability}`));
            });
            host.appendChild(section);
        });
    }

    function renderSearchResults() {
        if (currentMode === 'drop') renderDropResults(currentSearch);
        else renderMonsterResults(currentSearch);
    }

    function renderEmptyDetail(text) {
        const host = document.getElementById('monster-detail');
        if (!host) return;
        clear(host);
        host.appendChild(element('p', '', text || '請搜尋並選擇怪物。'));
    }

    function renderMaps(container, maps) {
        const section = element('section', 'recipe-card');
        section.appendChild(element('h3', '', '出現地圖'));
        if (!maps.length) {
            section.appendChild(element('p', '', UNRESOLVED_TEXT));
        } else {
            const list = element('ul');
            maps.forEach(map => list.appendChild(element('li', '', mapLabel(map))));
            section.appendChild(list);
        }
        container.appendChild(section);
    }

    function renderDrops(container, drops) {
        const section = element('section', 'recipe-card');
        section.appendChild(element('h3', '', `基礎掉落（${drops.length}）`));
        section.appendChild(element('p', '', DROP_SCOPE_TEXT));
        if (!drops.length) {
            section.appendChild(element('p', '', UNRESOLVED_TEXT));
        } else {
            const list = element('ul');
            drops.forEach(record => {
                const itemId = record.item.itemId;
                const label = record.item.displayName || itemId;
                const item = element('li');
                item.appendChild(element('strong', '', label));
                item.appendChild(element('div', 'recipe-meta', `Item ID：${itemId}`));
                if (!record.item.resolved) item.appendChild(element('div', 'recipe-meta', '名稱資料尚未建立'));
                item.appendChild(element('div', 'recipe-meta', `基礎掉率：${formatProbability(record.entry.probability)}`));
                item.appendChild(element('div', 'recipe-meta', `數量：${formatQuantity(record.entry.quantity)}`));
                if (record.entry.status === 'partial' || record.entry.status === 'unresolved') {
                    item.appendChild(element('div', 'recipe-meta', `資料狀態：${record.entry.status}`));
                }
                list.appendChild(item);
            });
            section.appendChild(list);
        }
        container.appendChild(section);
    }

    function renderMonster(monsterId) {
        const host = document.getElementById('monster-detail');
        if (!host) return false;
        clear(host);
        const detail = global.MonsterWikiData.getMonsterDetail(monsterId);
        if (!detail) {
            host.appendChild(element('h2', '', MISSING_MONSTER_TEXT));
            host.appendChild(element('p', '', `Monster ID：${monsterId}`));
            return false;
        }

        const close = element('button', 'category-btn', '關閉怪物資料');
        close.type = 'button';
        close.dataset.monsterAction = 'close';
        host.appendChild(close);

        const summary = element('section', 'recipe-card');
        summary.appendChild(element('h2', '', detail.monster.displayName || UNRESOLVED_TEXT));
        appendMeta(summary, '等級', detail.monster.level);
        appendMeta(summary, 'Boss', detail.monster.boss === true ? '是' : detail.monster.boss === false ? '否' : null);
        host.appendChild(summary);
        renderMaps(host, detail.maps);
        renderDrops(host, detail.drops);

        const hp = element('section', 'recipe-card');
        hp.appendChild(element('h3', '', '生命值'));
        appendMeta(hp, 'HP', detail.monster.hp);
        host.appendChild(hp);

        const technical = element('details', 'recipe-card');
        technical.appendChild(element('summary', '', '技術資訊'));
        appendMeta(technical, 'Monster ID', detail.monster.monsterId);
        host.appendChild(technical);
        return true;
    }

    function updateModeControls() {
        document.querySelectorAll('[data-monster-mode]').forEach(button => {
            const selected = button.dataset.monsterMode === currentMode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        const input = document.getElementById('search-monster');
        if (input) input.placeholder = currentMode === 'drop' ? '搜尋物品名稱或 Item ID' : '搜尋怪物名稱或 Monster ID';
    }

    function applyState(state) {
        currentMode = normalizeMode(state.mode);
        currentSearch = String(state.search || '');
        currentMonsterId = state.monsterId || null;
        const input = document.getElementById('search-monster');
        if (input) input.value = currentSearch;
        updateModeControls();
        renderSearchResults();
        if (currentMonsterId) {
            const monster = global.MonsterWikiData.getMonsterById(currentMonsterId);
            if (monster && !currentSearch) {
                currentSearch = monster.displayName;
                if (input) input.value = currentSearch;
                renderSearchResults();
            }
            renderMonster(currentMonsterId);
        } else {
            renderEmptyDetail();
        }
    }

    function openMonster(monsterId, historyMode) {
        const monster = global.MonsterWikiData.getMonsterById(monsterId);
        currentMonsterId = monster ? monster.monsterId : String(monsterId);
        renderMonster(currentMonsterId);
        writeUrlState(historyMode || 'push');
    }

    function closeDetail(historyMode) {
        currentMonsterId = null;
        renderEmptyDetail();
        writeUrlState(historyMode || 'push');
    }

    function setMode(mode, historyMode) {
        currentMode = normalizeMode(mode);
        currentMonsterId = null;
        updateModeControls();
        renderSearchResults();
        renderEmptyDetail();
        writeUrlState(historyMode || 'push');
    }

    function runSearch(value, historyMode) {
        currentSearch = String(value == null ? '' : value).trim();
        renderSearchResults();
        writeUrlState(historyMode || 'replace');
    }

    function handleClick(event) {
        const action = event.target.closest('[data-monster-action]');
        if (action) {
            if (action.dataset.monsterAction === 'open') openMonster(action.dataset.monsterId, 'push');
            if (action.dataset.monsterAction === 'close') closeDetail('push');
            return;
        }
        const mode = event.target.closest('[data-monster-mode]');
        if (mode) setMode(mode.dataset.monsterMode, 'push');
    }

    function handleInput(event) {
        if (event.target.id !== 'search-monster') return;
        global.clearTimeout(debounceTimer);
        debounceTimer = global.setTimeout(() => runSearch(event.target.value, 'replace'), SEARCH_DELAY);
    }

    function handleKeydown(event) {
        if (event.key === 'Enter' && event.target.id === 'search-monster') {
            global.clearTimeout(debounceTimer);
            runSearch(event.target.value, 'replace');
        }
        if (event.key === 'Escape' && currentMonsterId) closeDetail('push');
    }

    function handlePopState() {
        const state = readUrlState();
        if (typeof global.switchTab === 'function') {
            global.switchTab(state.tab, '', { syncHistory: false });
            return;
        }
        if (state.tab === 'monster') applyState(state);
    }

    function bindEvents() {
        if (eventsBound) return;
        const pane = document.getElementById('tab-content-monster');
        if (!pane) return;
        pane.addEventListener('click', handleClick);
        pane.addEventListener('input', handleInput);
        pane.addEventListener('keydown', handleKeydown);
        global.addEventListener('popstate', handlePopState);
        eventsBound = true;
    }

    function activate() {
        if (!initialized) return false;
        applyState(readUrlState());
        return true;
    }

    function search(keyword) {
        const input = document.getElementById('search-monster');
        if (input) input.value = keyword || '';
        runSearch(keyword || '', 'replace');
    }

    async function init() {
        if (initialized) return true;
        if (!global.MonsterWikiData) return false;
        const ready = await global.MonsterWikiData.load();
        if (!ready) return false;

        const button = document.getElementById('btn-tab-monster');
        const input = document.getElementById('search-monster');
        if (!button || !input) return false;
        button.hidden = false;
        bindEvents();
        updateModeControls();
        renderSearchResults();
        document.documentElement.dataset.monsterUiAlphaReady = 'true';
        document.documentElement.dataset.monsterUiAlphaCounts = JSON.stringify(global.MonsterWikiData.getState().counts);
        initialized = true;
        return true;
    }

    global.MonsterWikiView = Object.freeze({
        init,
        activate,
        search,
        renderMonster,
        openMonster,
        closeDetail,
        setMode,
        readUrlState,
        formatProbability
    });
})(window);
