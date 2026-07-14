(function (global) {
    'use strict';

    const DATA_FILES = Object.freeze({
        monsters: './data/monster/monsters.json',
        maps: './data/monster/maps.json',
        dropTables: './data/monster/drop_tables.json'
    });

    let loadPromise = null;
    let ready = false;
    let loadError = null;
    let itemLabelError = null;
    let monstersById = new Map();
    let monstersByName = new Map();
    let mapsById = new Map();
    let dropTablesById = new Map();
    let dropsByItemId = new Map();
    let itemLabelsById = new Map();

    function normalize(value) {
        return String(value == null ? '' : value).trim().toLocaleLowerCase();
    }

    function snapshot(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    async function fetchDataset(path, expectedDataset) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Monster dataset request failed: ${path} (${response.status})`);
        const document = await response.json();
        if (!document || document.dataset !== expectedDataset || !Array.isArray(document.records)) {
            throw new Error(`Monster dataset format is invalid: ${path}`);
        }
        return document.records;
    }

    function resetIndexes() {
        monstersById = new Map();
        monstersByName = new Map();
        mapsById = new Map();
        dropTablesById = new Map();
        dropsByItemId = new Map();
    }

    function buildIndexes(monsters, maps, dropTables) {
        const nextMonstersById = new Map();
        const nextMonstersByName = new Map();
        const nextMapsById = new Map();
        const nextDropTablesById = new Map();
        const nextDropsByItemId = new Map();

        monsters.forEach(monster => {
            if (!monster || !monster.monsterId || nextMonstersById.has(monster.monsterId)) {
                throw new Error('Monster dataset contains an invalid or duplicate monsterId.');
            }
            nextMonstersById.set(monster.monsterId, monster);
            const nameKey = normalize(monster.displayName);
            if (!nameKey) throw new Error('Monster dataset contains an invalid displayName.');
            if (!nextMonstersByName.has(nameKey)) nextMonstersByName.set(nameKey, []);
            nextMonstersByName.get(nameKey).push(monster);
        });

        maps.forEach(map => {
            if (!map || !map.mapId || nextMapsById.has(map.mapId)) {
                throw new Error('Monster dataset contains an invalid or duplicate mapId.');
            }
            nextMapsById.set(map.mapId, map);
        });

        dropTables.forEach(table => {
            if (!table || !table.dropTableId || nextDropTablesById.has(table.dropTableId)) {
                throw new Error('Monster dataset contains an invalid or duplicate dropTableId.');
            }
            nextDropTablesById.set(table.dropTableId, table);
            const monsterId = table.owner && table.owner.entityType === 'monster' ? table.owner.entityId : null;
            (Array.isArray(table.entries) ? table.entries : []).forEach(entry => {
                const itemId = entry && entry.itemRef ? entry.itemRef.entityId : null;
                if (!monsterId || !itemId) return;
                const key = normalize(itemId);
                if (!nextDropsByItemId.has(key)) nextDropsByItemId.set(key, []);
                nextDropsByItemId.get(key).push({ monsterId, entry });
            });
        });

        monstersById = nextMonstersById;
        monstersByName = nextMonstersByName;
        mapsById = nextMapsById;
        dropTablesById = nextDropTablesById;
        dropsByItemId = nextDropsByItemId;
    }

    function load() {
        if (loadPromise) return loadPromise;
        loadPromise = Promise.all([
            fetchDataset(DATA_FILES.monsters, 'monsters'),
            fetchDataset(DATA_FILES.maps, 'maps'),
            fetchDataset(DATA_FILES.dropTables, 'drop_tables')
        ]).then(([monsters, maps, dropTables]) => {
            buildIndexes(monsters, maps, dropTables);
            ready = true;
            loadError = null;
            return true;
        }).catch(error => {
            ready = false;
            loadError = error;
            resetIndexes();
            console.warn('Monster UI was not initialized because its required dataset could not be loaded.');
            return false;
        });
        return loadPromise;
    }

    function setItemLabelSource(items) {
        try {
            if (!Array.isArray(items)) throw new Error('Item label source must be an array.');
            const nextLabels = new Map();
            items.forEach(item => {
                if (!item || !item.id || !item.name) return;
                const key = normalize(item.id);
                if (!nextLabels.has(key)) nextLabels.set(key, { itemId: String(item.id), displayName: String(item.name) });
            });
            itemLabelsById = nextLabels;
            itemLabelError = null;
            return true;
        } catch (error) {
            itemLabelsById = new Map();
            itemLabelError = error;
            return false;
        }
    }

    function getMonsterRecord(monsterId) {
        if (!ready) return null;
        const exact = monstersById.get(String(monsterId));
        if (exact) return exact;
        const key = normalize(monsterId);
        for (const [id, monster] of monstersById) {
            if (normalize(id) === key) return monster;
        }
        return null;
    }

    function getMonsterById(monsterId) {
        return snapshot(getMonsterRecord(monsterId));
    }

    function getMonsterByName(displayName) {
        const records = ready ? (monstersByName.get(normalize(displayName)) || []) : [];
        return snapshot(records.length === 1 ? records[0] : null);
    }

    function searchMonsters(keyword) {
        if (!ready) return [];
        const query = normalize(keyword);
        if (!query) return [];
        return snapshot(Array.from(monstersById.values()).filter(monster =>
            normalize(monster.displayName).includes(query) || normalize(monster.monsterId).includes(query)
        ));
    }

    function getMap(mapId) {
        const record = ready ? (mapsById.get(String(mapId)) || null) : null;
        return snapshot(record);
    }

    function getDropTable(dropTableId) {
        const record = ready ? (dropTablesById.get(String(dropTableId)) || null) : null;
        return snapshot(record);
    }

    function getDropEntries(monsterId) {
        const monster = getMonsterRecord(monsterId);
        if (!monster || !monster.dropTableRef) return [];
        const table = dropTablesById.get(monster.dropTableRef.entityId);
        return table && Array.isArray(table.entries) ? table.entries : [];
    }

    function getDrops(monsterId) {
        return snapshot(getDropEntries(monsterId));
    }

    function getItemDisplay(itemId) {
        const id = String(itemId == null ? '' : itemId);
        const label = itemLabelsById.get(normalize(id));
        return Object.freeze({
            itemId: id,
            displayName: label ? label.displayName : null,
            resolved: Boolean(label),
            source: label ? 'wiki.html#EQUIP_DATA' : null
        });
    }

    function mapSummary(monster) {
        return (Array.isArray(monster.mapRef) ? monster.mapRef : []).map(ref => {
            const map = mapsById.get(ref.entityId);
            return { mapId: ref.entityId, displayName: map && map.displayName ? map.displayName : null };
        });
    }

    function getMonstersDroppingItem(itemId) {
        if (!ready) return [];
        const occurrences = dropsByItemId.get(normalize(itemId)) || [];
        return snapshot(occurrences.map(occurrence => {
            const monster = monstersById.get(occurrence.monsterId);
            return {
                monsterId: occurrence.monsterId,
                displayName: monster ? monster.displayName : null,
                boss: monster ? monster.boss : null,
                maps: monster ? mapSummary(monster) : [],
                drop: occurrence.entry
            };
        }));
    }

    function searchDrops(keyword) {
        if (!ready) return [];
        const query = normalize(keyword);
        if (!query) return [];
        const results = [];
        dropsByItemId.forEach((occurrences, key) => {
            const itemId = occurrences[0].entry.itemRef.entityId;
            const item = getItemDisplay(itemId);
            if (!key.includes(query) && !(item.displayName && normalize(item.displayName).includes(query))) return;
            results.push({
                item,
                monsters: getMonstersDroppingItem(itemId)
            });
        });
        results.sort((a, b) => a.item.itemId.localeCompare(b.item.itemId));
        return snapshot(results);
    }

    function getMonsterDetail(monsterId) {
        const monster = getMonsterRecord(monsterId);
        if (!monster) return null;
        return snapshot({
            monster,
            maps: mapSummary(monster),
            drops: getDropEntries(monster.monsterId).map(entry => ({
                entry,
                item: getItemDisplay(entry.itemRef.entityId)
            }))
        });
    }

    function getState() {
        return Object.freeze({
            ready,
            loadError,
            itemLabelError,
            itemLabelsReady: itemLabelsById.size > 0,
            counts: Object.freeze({
                monsters: monstersById.size,
                maps: mapsById.size,
                dropTables: dropTablesById.size,
                dropItems: dropsByItemId.size,
                itemLabels: itemLabelsById.size
            })
        });
    }

    global.MonsterWikiData = Object.freeze({
        load,
        setItemLabelSource,
        getMonsterById,
        getMonsterByName,
        searchMonsters,
        getMap,
        getDropTable,
        getDrops,
        searchDrops,
        getMonstersDroppingItem,
        getItemDisplay,
        getMonsterDetail,
        getState
    });
})(window);
