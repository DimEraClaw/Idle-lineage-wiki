(function (global) {
    'use strict';

    const UNRESOLVED_TEXT = '資料尚未建立';
    let initialized = false;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function appendField(container, label, value) {
        const row = element('div', 'recipe-meta');
        row.appendChild(element('strong', '', `${label}：`));
        row.appendChild(document.createTextNode(value == null || value === '' ? UNRESOLVED_TEXT : String(value)));
        container.appendChild(row);
    }

    function renderSearchResults(keyword) {
        const host = document.getElementById('monster-search-results');
        if (!host) return;
        clear(host);
        const query = String(keyword == null ? '' : keyword).trim();
        if (!query) {
            host.appendChild(element('p', '', '請輸入怪物名稱或 Monster ID。'));
            return;
        }
        const results = global.MonsterWikiData.searchMonsters(query);
        if (!results.length) {
            host.appendChild(element('p', '', '找不到符合的怪物。'));
            return;
        }
        results.forEach(monster => {
            const button = element('button', 'category-btn', `${monster.displayName}（${monster.monsterId}）`);
            button.type = 'button';
            button.addEventListener('click', () => renderMonster(monster.monsterId));
            host.appendChild(button);
        });
    }

    function renderMaps(container, monster) {
        const section = element('section', 'recipe-card');
        section.appendChild(element('h3', '', '目前地圖'));
        if (!Array.isArray(monster.mapRef) || !monster.mapRef.length) {
            section.appendChild(element('p', '', UNRESOLVED_TEXT));
        } else {
            const list = element('ul');
            monster.mapRef.forEach(mapRef => {
                const map = global.MonsterWikiData.getMap(mapRef.entityId);
                list.appendChild(element('li', '', map && map.displayName ? map.displayName : UNRESOLVED_TEXT));
            });
            section.appendChild(list);
        }
        container.appendChild(section);
    }

    function renderDrops(container, monster) {
        const section = element('section', 'recipe-card');
        const drops = global.MonsterWikiData.getDrops(monster.monsterId);
        const details = element('details');
        details.appendChild(element('summary', '', `掉落列表（${drops.length}）`));
        if (!monster.dropTableRef || !drops.length) {
            details.appendChild(element('p', '', UNRESOLVED_TEXT));
        } else {
            const list = element('ul');
            drops.forEach(drop => {
                const itemId = drop && drop.itemRef ? drop.itemRef.entityId : null;
                list.appendChild(element('li', '', itemId || UNRESOLVED_TEXT));
            });
            details.appendChild(list);
        }
        section.appendChild(details);
        container.appendChild(section);
    }

    function renderMonster(monsterId) {
        const host = document.getElementById('monster-detail');
        if (!host) return;
        clear(host);
        const monster = global.MonsterWikiData.getMonsterById(monsterId);
        if (!monster) {
            host.appendChild(element('p', '', UNRESOLVED_TEXT));
            return;
        }
        const summary = element('section', 'recipe-card');
        summary.appendChild(element('h2', '', monster.displayName || UNRESOLVED_TEXT));
        appendField(summary, 'Monster ID', monster.monsterId);
        appendField(summary, '等級', monster.level);
        appendField(summary, 'HP', monster.hp);
        appendField(summary, 'Boss', monster.boss === true ? '是' : monster.boss === false ? '否' : null);
        host.appendChild(summary);
        renderMaps(host, monster);
        renderDrops(host, monster);
    }

    function search(keyword) {
        const input = document.getElementById('search-monster');
        if (input && input.value !== keyword) input.value = keyword || '';
        renderSearchResults(keyword || '');
        const exact = global.MonsterWikiData.getMonsterById(keyword) || global.MonsterWikiData.getMonsterByName(keyword);
        if (exact) renderMonster(exact.monsterId);
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
        input.addEventListener('input', event => renderSearchResults(event.target.value));
        renderSearchResults('');
        document.documentElement.dataset.monsterUiAlphaReady = 'true';
        document.documentElement.dataset.monsterUiAlphaCounts = JSON.stringify(global.MonsterWikiData.getState().counts);
        initialized = true;
        return true;
    }

    global.MonsterWikiView = Object.freeze({ init, search, renderMonster });
})(window);
