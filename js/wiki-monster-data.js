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
    let monstersById = new Map();
    let monstersByName = new Map();
    let mapsById = new Map();
    let dropTablesById = new Map();

    function normalize(value) {
        return String(value == null ? '' : value).trim().toLocaleLowerCase();
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

    function buildIndexes(monsters, maps, dropTables) {
        const nextMonstersById = new Map();
        const nextMonstersByName = new Map();
        const nextMapsById = new Map();
        const nextDropTablesById = new Map();

        monsters.forEach(monster => {
            if (!monster || !monster.monsterId || nextMonstersById.has(monster.monsterId)) {
                throw new Error('Monster dataset contains an invalid or duplicate monsterId.');
            }
            nextMonstersById.set(monster.monsterId, monster);
            const nameKey = normalize(monster.displayName);
            if (!nameKey || nextMonstersByName.has(nameKey)) {
                throw new Error('Monster dataset contains an invalid or duplicate displayName.');
            }
            nextMonstersByName.set(nameKey, monster);
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
        });

        monstersById = nextMonstersById;
        monstersByName = nextMonstersByName;
        mapsById = nextMapsById;
        dropTablesById = nextDropTablesById;
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
            monstersById = new Map();
            monstersByName = new Map();
            mapsById = new Map();
            dropTablesById = new Map();
            console.warn('Monster UI Alpha was not initialized because its dataset could not be loaded.');
            return false;
        });
        return loadPromise;
    }

    function getMonsterById(monsterId) {
        return ready ? (monstersById.get(String(monsterId)) || null) : null;
    }

    function getMonsterByName(displayName) {
        return ready ? (monstersByName.get(normalize(displayName)) || null) : null;
    }

    function searchMonsters(keyword) {
        if (!ready) return [];
        const query = normalize(keyword);
        if (!query) return [];
        return Array.from(monstersById.values()).filter(monster =>
            normalize(monster.displayName).includes(query) || normalize(monster.monsterId).includes(query)
        );
    }

    function getMap(mapId) {
        return ready ? (mapsById.get(String(mapId)) || null) : null;
    }

    function getDropTable(dropTableId) {
        return ready ? (dropTablesById.get(String(dropTableId)) || null) : null;
    }

    function getDrops(monsterId) {
        const monster = getMonsterById(monsterId);
        if (!monster || !monster.dropTableRef) return [];
        const table = getDropTable(monster.dropTableRef.entityId);
        return table && Array.isArray(table.entries) ? table.entries.slice() : [];
    }

    function getState() {
        return Object.freeze({ ready, loadError, counts: Object.freeze({ monsters: monstersById.size, maps: mapsById.size, dropTables: dropTablesById.size }) });
    }

    global.MonsterWikiData = Object.freeze({
        load,
        getMonsterById,
        getMonsterByName,
        searchMonsters,
        getMap,
        getDropTable,
        getDrops,
        getState
    });
})(window);
