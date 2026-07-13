(function (root, factory) {
    'use strict';
    const api = factory();
    root.createEquipmentRepository = api.createEquipmentRepository;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const URLS = Object.freeze({
        equipment: 'data/equipment/equipments.json',
        diagnostics: 'data/equipment/diagnostics.json',
        unresolved: 'data/equipment/unresolved.json'
    });
    const CLASS_KEYS = Object.freeze(['dark', 'dragon', 'elf', 'illusion', 'knight', 'mage', 'royal', 'warrior']);
    const SEARCH_LABELS = Object.freeze({
        weapon: '武器',
        armor: '防具',
        accessory: '飾品',
        one_hand_sword: '單手劍',
        two_hand_sword: '雙手劍',
        dagger: '短劍 匕首',
        blunt: '鈍器',
        two_hand_blunt: '雙手鈍器',
        spear: '長槍',
        two_hand_spear: '雙手長槍',
        bow: '弓',
        crossbow: '十字弓',
        staff: '魔杖 法杖',
        claw: '鋼爪',
        dual_blade: '雙刀',
        chain_sword: '鎖鏈劍',
        kiringku: '奇古獸',
        other_weapon: '其他武器',
        helmet: '頭盔',
        cloak: '斗篷',
        gloves: '手套',
        boots: '長靴 鞋子',
        tshirt: 'T恤',
        greaves: '脛甲',
        shield: '盾牌',
        necklace: '項鍊',
        earring: '耳環',
        belt: '腰帶',
        ring: '戒指',
        arrow: '箭矢',
        pet_weapon: '寵物武器',
        pet_armor: '寵物防具'
    });

    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function freezeDeep(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return value;
    }

    function sortedUnique(values) {
        return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
    }

    function createEquipmentRepository(options) {
        const settings = options || {};
        const fetchImpl = settings.fetch || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
        const now = settings.now || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));

        let loadPromise = null;
        let recordsById = new Map();
        let indexes = emptyIndexes();
        let state = emptyState();

        function emptyIndexes() {
            return {
                equipmentById: new Map(),
                equipmentByExactName: new Map(),
                equipmentByGroup: new Map(),
                equipmentByType: new Map(),
                equipmentBySlot: new Map(),
                equipmentByClass: new Map(),
                relationByEquipment: new Map(),
                diagnosticsByEquipment: new Map(),
                unresolvedByEquipment: new Map(),
                searchableText: new Map()
            };
        }

        function emptyState() {
            return {
                ready: false,
                loading: false,
                error: null,
                optionalErrors: [],
                ambiguousNameCount: 0,
                indexCounts: {},
                performance: {
                    responseBytes: {},
                    fetchTimeMs: 0,
                    parseTimeMs: 0,
                    indexBuildTimeMs: 0,
                    totalReadyTimeMs: 0,
                    memoryEstimateBytes: 0,
                    searchAverageMs: null
                }
            };
        }

        function clear(error) {
            recordsById = new Map();
            indexes = emptyIndexes();
            state = emptyState();
            state.error = error ? String(error.message || error) : null;
        }

        async function fetchDocument(url, required) {
            const start = now();
            try {
                const response = await fetchImpl(url);
                if (!response || !response.ok) throw new Error('HTTP ' + (response ? response.status : 'unknown') + ': ' + url);
                const text = await response.text();
                const fetchedAt = now();
                let document;
                try {
                    document = JSON.parse(text);
                } catch (error) {
                    throw new Error('Invalid JSON: ' + url);
                }
                return {
                    document,
                    bytes: typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length,
                    fetchMs: fetchedAt - start,
                    parseMs: now() - fetchedAt
                };
            } catch (error) {
                if (required) throw error;
                return { error: String(error.message || error), document: null, bytes: 0, fetchMs: now() - start, parseMs: 0 };
            }
        }

        function requireEnvelope(document, dataset, url) {
            if (!document || document.dataset !== dataset || document.schemaVersion !== '1.0.0' || !Array.isArray(document.records)) {
                throw new Error('Invalid document envelope: ' + url);
            }
        }

        function add(index, key, id) {
            if (key == null || key === '') return;
            if (!index.has(key)) index.set(key, []);
            index.get(key).push(id);
        }

        function normalizeIndexes() {
            [
                indexes.equipmentByExactName,
                indexes.equipmentByGroup,
                indexes.equipmentByType,
                indexes.equipmentBySlot,
                indexes.equipmentByClass,
                indexes.relationByEquipment,
                indexes.diagnosticsByEquipment,
                indexes.unresolvedByEquipment
            ].forEach(index => {
                index.forEach((values, key) => index.set(key, sortedUnique(values)));
            });
        }

        function buildIndexes(equipmentRecords, diagnosticRecords, unresolvedRecords) {
            const start = now();
            const nextRecords = new Map();
            const nextIndexes = emptyIndexes();
            const relationStore = new Map();
            const diagnosticStore = new Map();
            const unresolvedStore = new Map();

            equipmentRecords.forEach(record => {
                if (!record || typeof record.equipmentId !== 'string' || nextRecords.has(record.equipmentId)) {
                    throw new Error('Duplicate or invalid Equipment ID');
                }
                const frozen = freezeDeep(clone(record));
                nextRecords.set(record.equipmentId, frozen);
                nextIndexes.equipmentById.set(record.equipmentId, record.equipmentId);
                add(nextIndexes.equipmentByExactName, record.displayName, record.equipmentId);
                add(nextIndexes.equipmentByGroup, record.equipmentGroup, record.equipmentId);
                add(nextIndexes.equipmentByType, record.equipmentType, record.equipmentId);
                add(nextIndexes.equipmentBySlot, record.slot, record.equipmentId);
                const classes = record.classRequirements && record.classRequirements.baseClasses;
                (classes || []).forEach(classKey => add(nextIndexes.equipmentByClass, classKey, record.equipmentId));
                const relations = freezeDeep(clone(record.relations || []));
                relationStore.set(record.equipmentId, relations);
                (record.relations || []).forEach(relation => add(nextIndexes.relationByEquipment, record.equipmentId, relation.relationType + ':' + relation.target.entityType + ':' + relation.target.entityId));
                const searchParts = [
                    record.equipmentId,
                    record.displayName,
                    record.equipmentGroup,
                    record.equipmentType,
                    record.slot,
                    SEARCH_LABELS[record.equipmentGroup] || '',
                    SEARCH_LABELS[record.equipmentType] || '',
                    SEARCH_LABELS[record.slot] || '',
                    ...(classes || [])
                ];
                nextIndexes.searchableText.set(record.equipmentId, searchParts.join(' ').toLocaleLowerCase());
            });

            diagnosticRecords.forEach((record, position) => {
                const key = 'd' + position;
                diagnosticStore.set(key, freezeDeep(clone(record)));
                add(nextIndexes.diagnosticsByEquipment, record.equipmentId, key);
            });
            unresolvedRecords.forEach((record, position) => {
                const key = 'u' + position;
                unresolvedStore.set(key, freezeDeep(clone(record)));
                add(nextIndexes.unresolvedByEquipment, record.equipmentId, key);
            });

            indexes = nextIndexes;
            recordsById = nextRecords;
            normalizeIndexes();
            indexes._relationStore = relationStore;
            indexes._diagnosticStore = diagnosticStore;
            indexes._unresolvedStore = unresolvedStore;
            state.ambiguousNameCount = Array.from(indexes.equipmentByExactName.values()).filter(ids => ids.length !== 1).length;
            state.indexCounts = {
                equipmentById: indexes.equipmentById.size,
                equipmentByExactName: indexes.equipmentByExactName.size,
                equipmentByGroup: indexes.equipmentByGroup.size,
                equipmentByType: indexes.equipmentByType.size,
                equipmentBySlot: indexes.equipmentBySlot.size,
                equipmentByClass: indexes.equipmentByClass.size,
                relationByEquipment: indexes.relationByEquipment.size,
                diagnosticsByEquipment: indexes.diagnosticsByEquipment.size,
                unresolvedByEquipment: indexes.unresolvedByEquipment.size,
                searchableText: indexes.searchableText.size
            };
            const indexCharacters = Array.from(indexes.searchableText.values()).reduce((sum, text) => sum + text.length, 0);
            state.performance.memoryEstimateBytes =
                state.performance.responseBytes.equipment +
                state.performance.responseBytes.diagnostics +
                state.performance.responseBytes.unresolved +
                indexCharacters * 2 +
                equipmentRecords.length * 160;
            state.performance.indexBuildTimeMs = now() - start;
        }

        async function load() {
            if (loadPromise) return loadPromise;
            loadPromise = (async () => {
                const totalStart = now();
                clear();
                state.loading = true;
                if (!fetchImpl) {
                    clear('fetch unavailable');
                    return false;
                }
                try {
                    const [equipmentResult, diagnosticsResult, unresolvedResult] = await Promise.all([
                        fetchDocument(URLS.equipment, true),
                        fetchDocument(URLS.diagnostics, true),
                        fetchDocument(URLS.unresolved, false)
                    ]);
                    requireEnvelope(equipmentResult.document, 'equipment', URLS.equipment);
                    requireEnvelope(diagnosticsResult.document, 'equipment_diagnostics', URLS.diagnostics);
                    let unresolvedRecords;
                    if (unresolvedResult.document) {
                        requireEnvelope(unresolvedResult.document, 'equipment_unresolved', URLS.unresolved);
                        unresolvedRecords = unresolvedResult.document.records;
                    } else {
                        state.optionalErrors.push(unresolvedResult.error);
                        unresolvedRecords = diagnosticsResult.document.records.filter(record => record.status === 'unresolved');
                    }
                    state.performance.responseBytes = {
                        equipment: equipmentResult.bytes,
                        diagnostics: diagnosticsResult.bytes,
                        unresolved: unresolvedResult.bytes
                    };
                    state.performance.fetchTimeMs = Math.max(equipmentResult.fetchMs, diagnosticsResult.fetchMs, unresolvedResult.fetchMs);
                    state.performance.parseTimeMs = equipmentResult.parseMs + diagnosticsResult.parseMs + unresolvedResult.parseMs;
                    buildIndexes(equipmentResult.document.records, diagnosticsResult.document.records, unresolvedRecords);
                    state.ready = true;
                    state.loading = false;
                    state.performance.totalReadyTimeMs = now() - totalStart;
                    return true;
                } catch (error) {
                    clear(error);
                    return false;
                }
            })();
            return loadPromise;
        }

        function entitiesForIds(ids) {
            return (ids || []).map(id => recordsById.get(id)).filter(Boolean).map(clone);
        }

        function getEquipmentById(equipmentId) {
            return clone(recordsById.get(String(equipmentId || '')) || null);
        }

        function getEquipmentByName(displayName) {
            const ids = indexes.equipmentByExactName.get(String(displayName || '')) || [];
            return ids.length === 1 ? getEquipmentById(ids[0]) : null;
        }

        function searchEquipment(keyword) {
            const query = String(keyword || '').trim().toLocaleLowerCase();
            if (!query) return getAll();
            const ids = [];
            indexes.searchableText.forEach((text, id) => {
                if (text.includes(query)) ids.push(id);
            });
            return entitiesForIds(ids.sort((a, b) => a.localeCompare(b)));
        }

        function getAll() {
            return entitiesForIds(Array.from(recordsById.keys()).sort((a, b) => a.localeCompare(b)));
        }

        function getRelations(equipmentId) {
            return clone(indexes._relationStore.get(String(equipmentId || '')) || []);
        }

        function recordsFromStore(index, store, equipmentId) {
            return (index.get(String(equipmentId || '')) || []).map(key => store.get(key)).filter(Boolean).map(clone);
        }

        function measureSearch(queries) {
            const list = Array.isArray(queries) ? queries : [];
            if (!list.length) return 0;
            const start = now();
            list.forEach(query => searchEquipment(query));
            const average = (now() - start) / list.length;
            state.performance.searchAverageMs = average;
            return average;
        }

        return Object.freeze({
            load,
            getEquipmentById,
            getEquipmentByName,
            searchEquipment,
            getAll,
            getByGroup: group => entitiesForIds(indexes.equipmentByGroup.get(group)),
            getByType: type => entitiesForIds(indexes.equipmentByType.get(type)),
            getBySlot: slot => entitiesForIds(indexes.equipmentBySlot.get(slot)),
            getByClass: classKey => CLASS_KEYS.includes(classKey) ? entitiesForIds(indexes.equipmentByClass.get(classKey)) : [],
            getRelations,
            getDiagnostics: equipmentId => recordsFromStore(indexes.diagnosticsByEquipment, indexes._diagnosticStore, equipmentId),
            getUnresolved: equipmentId => recordsFromStore(indexes.unresolvedByEquipment, indexes._unresolvedStore, equipmentId),
            getState: () => clone(state),
            measureSearch
        });
    }

    return Object.freeze({ createEquipmentRepository, URLS, SEARCH_LABELS });
});
