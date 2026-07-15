(function (global) {
    'use strict';

    const EMPTY = '資料尚未建立';
    let prepared = false;
    let selectedRegionKey = null;
    let selectedMap = '';

    function isEnabled() {
        return new URLSearchParams(global.location.search).get('monsterMerge') === '1';
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function clear(node) {
        while (node && node.firstChild) node.removeChild(node.firstChild);
    }

    function regions() {
        return Array.isArray(global.MONSTER_MERGED_CARD_REGIONS) ? global.MONSTER_MERGED_CARD_REGIONS : [];
    }

    function canonicalMonster(legacyMob, repository) {
        if (!repository || typeof repository.getMonsterByName !== 'function') return null;
        return repository.getMonsterByName(legacyMob.name);
    }

    function buildPreviewModel(sourceRegions, repository) {
        const canonicalIds = new Set();
        let references = 0;
        let unresolvedReferences = 0;
        const output = (Array.isArray(sourceRegions) ? sourceRegions : []).map(region => ({
            key: region.key,
            name: region.name,
            stat: region.stat,
            vals: Array.isArray(region.vals) ? region.vals.slice() : [],
            monsters: (Array.isArray(region.mobs) ? region.mobs : []).map(legacy => {
                references += 1;
                const canonical = canonicalMonster(legacy, repository);
                if (canonical) canonicalIds.add(canonical.monsterId);
                else unresolvedReferences += 1;
                return { legacy, canonical };
            })
        }));
        return {
            regions: output,
            counts: { regions: output.length, references, canonicalMonsters: canonicalIds.size, unresolvedReferences }
        };
    }

    function regionModel() {
        return buildPreviewModel(regions(), global.MonsterWikiData);
    }

    function currentRegion(model) {
        const params = new URLSearchParams(global.location.search);
        const requested = params.get('monsterRegion') || selectedRegionKey;
        const selected = model.regions.find(region => region.key === requested) || model.regions[0] || null;
        selectedRegionKey = selected ? selected.key : null;
        return selected;
    }

    function writeRegionState(regionKey, historyMode) {
        const url = new URL(global.location.href);
        url.searchParams.set('tab', 'monster');
        url.searchParams.set('monsterMode', 'region');
        url.searchParams.set('monsterRegion', regionKey);
        url.searchParams.delete('monster');
        url.searchParams.delete('legacyMonster');
        global.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({}, '', url.toString());
    }

    function prepare() {
        if (!isEnabled() || prepared) return false;
        const cardsButton = document.getElementById('btn-tab-cards');
        const monsterButton = document.getElementById('btn-tab-monster');
        const regionButton = document.querySelector('[data-monster-mode="region"]');
        const pane = document.getElementById('tab-content-monster');
        if (cardsButton) {
            cardsButton.hidden = true;
            cardsButton.style.display = 'none';
        }
        if (monsterButton) {
            monsterButton.hidden = false;
            monsterButton.textContent = '👹 怪物百科';
        }
        if (regionButton) {
            regionButton.hidden = false;
            regionButton.style.removeProperty('display');
        }
        if (pane) {
            const title = pane.querySelector('.wiki-title h2');
            const subtitle = pane.querySelector('.wiki-title span');
            const sidebarTitle = pane.querySelector('.sidebar-title');
            const modes = document.getElementById('monster-search-modes');
            const sidebar = pane.querySelector('aside.sidebar');
            if (title) title.textContent = '怪物百科';
            if (subtitle) subtitle.textContent = '查詢各地區怪物、卡片與掉落資料';
            if (sidebarTitle) sidebarTitle.textContent = '怪物／地區／掉落查詢';
            if (modes && !document.getElementById('monster-merged-results-toggle')) {
                const toggle = element('button', 'category-btn', '顯示／隱藏查詢結果');
                toggle.id = 'monster-merged-results-toggle';
                toggle.type = 'button';
                toggle.dataset.mergedAction = 'toggle-results';
                modes.parentNode.insertBefore(toggle, modes);
            }
            if (sidebar && !document.getElementById('monster-merged-results-close')) {
                const close = element('button', 'category-btn', '關閉查詢結果');
                close.id = 'monster-merged-results-close';
                close.type = 'button';
                close.dataset.mergedAction = 'toggle-results';
                sidebar.insertBefore(close, document.getElementById('monster-search-results'));
            }
            pane.addEventListener('click', handleClick);
            pane.addEventListener('change', handleChange);
        }
        prepared = true;
        document.documentElement.dataset.monsterMergedPreview = 'enabled';
        return true;
    }

    function appendMeta(host, label, value) {
        const row = element('div', 'recipe-meta');
        row.appendChild(element('strong', '', `${label}：`));
        row.appendChild(document.createTextNode(value == null || value === '' ? EMPTY : String(value)));
        host.appendChild(row);
    }

    function renderRegionList(model, query) {
        const host = document.getElementById('monster-search-results');
        if (!host) return;
        clear(host);
        const q = String(query || '').trim().toLocaleLowerCase();
        const filtered = model.regions.filter(region => !q || region.name.toLocaleLowerCase().includes(q) ||
            region.monsters.some(record => record.legacy.name.toLocaleLowerCase().includes(q) ||
                (record.legacy.maps || []).some(map => String(map).toLocaleLowerCase().includes(q))));
        if (!filtered.length) {
            host.appendChild(element('p', '', '找不到符合的地區、地圖或怪物。'));
            return;
        }
        filtered.forEach(region => {
            const button = element('button', `category-btn${region.key === selectedRegionKey ? ' active' : ''}`);
            button.type = 'button';
            button.dataset.mergedAction = 'region';
            button.dataset.regionKey = region.key;
            button.textContent = `🎴 ${region.name}（${region.monsters.length}）`;
            host.appendChild(button);
        });
    }

    function renderMonsterCard(record, host) {
        const legacy = record.legacy;
        const canonical = record.canonical;
        const card = element('article', 'recipe-card');
        const button = element('button', 'category-btn', legacy.name);
        button.type = 'button';
        button.dataset.mergedAction = canonical ? 'monster' : 'legacy';
        if (canonical) button.dataset.monsterId = canonical.monsterId;
        else button.dataset.legacyName = legacy.name;
        card.appendChild(button);
        appendMeta(card, 'Monster ID', canonical ? canonical.monsterId : null);
        appendMeta(card, '等級', canonical && canonical.level != null ? canonical.level : legacy.lv);
        appendMeta(card, 'HP', canonical && canonical.hp != null ? canonical.hp : legacy.hp);
        appendMeta(card, 'AC', canonical && canonical.stats ? canonical.stats.ac : legacy.ac);
        appendMeta(card, 'MR', canonical && canonical.stats ? canonical.stats.mr : null);
        appendMeta(card, '屬性', canonical && canonical.element ? canonical.element : legacy.ele);
        appendMeta(card, '卡片狀態', null);
        host.appendChild(card);
    }

    function matches(record, query) {
        if (!query) return true;
        const q = query.toLocaleLowerCase();
        return record.legacy.name.toLocaleLowerCase().includes(q) ||
            (record.legacy.maps || []).some(map => String(map).toLocaleLowerCase().includes(q));
    }

    function renderSection(host, title, records) {
        const section = element('section', 'cards-list-section');
        section.appendChild(element('h3', '', `${title}（${records.length}）`));
        if (!records.length) section.appendChild(element('p', '', EMPTY));
        else records.forEach(record => renderMonsterCard(record, section));
        host.appendChild(section);
    }

    function renderRegionDetail(region, query, allRegions) {
        const host = document.getElementById('monster-detail');
        if (!host) return;
        clear(host);
        if (!region) {
            host.appendChild(element('p', '', '地區卡片資料尚未建立。'));
            return;
        }
        const header = element('section', 'recipe-card');
        header.appendChild(element('h2', '', region.name));
        const label = element('label', 'recipe-meta', '選擇地區：');
        const select = element('select', 'sort-select');
        select.id = 'monster-merged-region-select';
        (allRegions || []).forEach(candidate => {
            const option = element('option', '', candidate.name);
            option.value = candidate.key;
            option.selected = candidate.key === region.key;
            select.appendChild(option);
        });
        label.appendChild(select);
        header.appendChild(label);
        appendMeta(header, '卡片收集進度', null);
        appendMeta(header, '收集屬性', region.stat);
        appendMeta(header, '套裝加成', region.vals.length >= 3 ? `2件 +${region.vals[0]}｜3件 +${region.vals[1]}｜5件 +${region.vals[2]}` : null);
        host.appendChild(header);

        const mapNames = Array.from(new Set(region.monsters.flatMap(record => record.legacy.maps || [])));
        if (mapNames.length) {
            const maps = element('section', 'recipe-card');
            maps.appendChild(element('h3', '', '地圖篩選'));
            const all = element('button', 'category-btn', '全部地圖');
            all.type = 'button';
            all.dataset.mergedAction = 'map';
            all.dataset.mapName = '';
            maps.appendChild(all);
            mapNames.forEach(name => {
                const button = element('button', 'category-btn', name);
                button.type = 'button';
                button.dataset.mergedAction = 'map';
                button.dataset.mapName = name;
                maps.appendChild(button);
            });
            host.appendChild(maps);
        }

        const visible = region.monsters.filter(record => matches(record, query) &&
            (!selectedMap || (record.legacy.maps || []).includes(selectedMap)));
        const bosses = visible.filter(record => record.canonical && record.canonical.boss === true);
        const regular = visible.filter(record => !record.canonical || record.canonical.boss !== true);
        renderSection(host, 'Boss', bosses);
        renderSection(host, '怪物', regular);
    }

    function renderRegionMode(query) {
        if (!isEnabled()) return false;
        const model = regionModel();
        const region = currentRegion(model);
        renderRegionList(model, query);
        renderRegionDetail(region, String(query || '').trim(), model.regions);
        document.documentElement.dataset.monsterMergedRegionCounts = JSON.stringify(model.counts);
        return true;
    }

    function findLegacyRelations(name) {
        const found = [];
        regions().forEach(region => (region.mobs || []).forEach(mob => {
            if (mob.name === name) found.push({ region, mob });
        }));
        return found;
    }

    function enhanceMonsterDetail(detail, host) {
        if (!isEnabled() || !detail || !detail.monster || !host) return false;
        const relations = findLegacyRelations(detail.monster.displayName);
        const card = element('section', 'recipe-card');
        card.appendChild(element('h3', '', '地區卡片資料'));
        appendMeta(card, '卡片狀態', null);
        appendMeta(card, '地區', relations.length ? Array.from(new Set(relations.map(item => item.region.name))).join('、') : null);
        if (relations.length) {
            const source = relations[0].mob;
            appendMeta(card, '卡片手冊 AC', source.ac);
            appendMeta(card, '卡片手冊 MR', null);
            appendMeta(card, '卡片手冊屬性', source.ele);
            const stats = detail.monster.stats || {};
            if ((stats.ac != null && stats.ac !== source.ac) ||
                (detail.monster.hp != null && detail.monster.hp !== source.hp) ||
                (detail.monster.level != null && detail.monster.level !== source.lv)) {
                card.appendChild(element('p', '', 'Monster Dataset 與卡片手冊數值不同，資料待驗證；本頁保留兩份來源。'));
            }
        }
        host.appendChild(card);
        const evidence = element('details', 'recipe-card');
        evidence.appendChild(element('summary', '', '資料來源與證據'));
        appendMeta(evidence, 'Monster', detail.monster.verification && detail.monster.verification.source);
        appendMeta(evidence, '卡片／地區', relations.length ? 'wiki.html#REGIONS_DATA' : null);
        host.appendChild(evidence);
        return true;
    }

    function renderLegacyDetail(name) {
        const relation = findLegacyRelations(name)[0];
        const host = document.getElementById('monster-detail');
        if (!host || !relation) return false;
        clear(host);
        const section = element('section', 'recipe-card');
        section.appendChild(element('h2', '', relation.mob.name));
        appendMeta(section, 'Monster ID', null);
        appendMeta(section, '等級', relation.mob.lv);
        appendMeta(section, 'HP', relation.mob.hp);
        appendMeta(section, 'AC', relation.mob.ac);
        appendMeta(section, 'MR', null);
        appendMeta(section, '屬性', relation.mob.ele);
        appendMeta(section, '地區', findLegacyRelations(name).map(item => item.region.name).join('、'));
        appendMeta(section, '卡片狀態', null);
        section.appendChild(element('p', '', '此筆僅有卡片手冊顯示資料，未宣稱為正式 Monster Entity。'));
        host.appendChild(section);
        return true;
    }

    function handleClick(event) {
        if (!isEnabled()) return;
        const target = event.target.closest('[data-merged-action]');
        if (!target) return;
        const action = target.dataset.mergedAction;
        if (action === 'region') {
            selectedRegionKey = target.dataset.regionKey;
            selectedMap = '';
            writeRegionState(selectedRegionKey, 'push');
            renderRegionMode(document.getElementById('search-monster').value);
        } else if (action === 'map') {
            selectedMap = target.dataset.mapName || '';
            renderRegionMode(document.getElementById('search-monster').value);
        } else if (action === 'monster' && global.MonsterWikiView) {
            global.MonsterWikiView.openMonster(target.dataset.monsterId, 'push');
        } else if (action === 'legacy') {
            const name = target.dataset.legacyName;
            renderLegacyDetail(name);
            const url = new URL(global.location.href);
            url.searchParams.set('legacyMonster', name);
            global.history.pushState({}, '', url.toString());
        } else if (action === 'toggle-results') {
            const sidebar = document.querySelector('#tab-content-monster aside.sidebar');
            if (sidebar) sidebar.classList.toggle('active');
        }
    }

    function handleChange(event) {
        if (!isEnabled() || event.target.id !== 'monster-merged-region-select') return;
        selectedRegionKey = event.target.value;
        selectedMap = '';
        writeRegionState(selectedRegionKey, 'push');
        const input = document.getElementById('search-monster');
        renderRegionMode(input ? input.value : '');
    }

    global.MonsterMergedPreview = Object.freeze({
        isEnabled,
        prepare,
        renderRegionMode,
        enhanceMonsterDetail,
        buildPreviewModel
    });
})(window);
