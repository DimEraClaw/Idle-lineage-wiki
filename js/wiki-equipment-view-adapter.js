(function (root, factory) {
    'use strict';
    const api = factory();
    root.createEquipmentViewAdapter = api.createEquipmentViewAdapter;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ALL_CLASSES = Object.freeze(['dark', 'dragon', 'elf', 'illusion', 'knight', 'mage', 'royal', 'warrior']);
    const GROUP_LABELS = Object.freeze({ weapon: '武器', armor: '防具', accessory: '飾品' });
    const TYPE_LABELS = Object.freeze({
        one_hand_sword: '單手劍', two_hand_sword: '雙手劍', dagger: '短劍／匕首', blunt: '單手鈍器',
        two_hand_blunt: '雙手鈍器', spear: '單手矛', two_hand_spear: '雙手矛', bow: '弓', crossbow: '十字弓',
        staff: '魔杖', claw: '鋼爪', dual_blade: '雙刀', chain_sword: '鎖鏈劍', kiringku: '奇古獸',
        other_weapon: '其他武器', armor: '盔甲', helmet: '頭盔', cloak: '斗篷', gloves: '手套', boots: '靴子',
        tshirt: 'T恤', greaves: '脛甲', shield: '盾牌', necklace: '項鍊', earring: '耳環', belt: '皮帶', ring: '戒指'
    });
    const SLOT_LABELS = Object.freeze({
        weapon: '武器', arrow: '箭矢', armor: '盔甲', helmet: '頭盔', cloak: '斗篷', gloves: '手套', boots: '靴子',
        tshirt: 'T恤', greaves: '脛甲', shield: '盾牌／副手', necklace: '項鍊', earring: '耳環', belt: '皮帶',
        ring: '戒指', pet_weapon: '寵物武器', pet_armor: '寵物防具'
    });

    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function legacySearchText(record) {
        if (!record) return '';
        const sources = (record.sources || []).join(' ').replace(/<[^>]*>/g, ' ');
        return [record.name, record.desc, record.slot_cn, sources, Object.values(record.stats || {}).join(' ')]
            .join(' ').toLocaleLowerCase();
    }

    function classRequirement(record) {
        const requirements = record.classRequirements || {};
        if (!Array.isArray(requirements.baseClasses)) return null;
        const classes = requirements.baseClasses.slice().sort((a, b) => a.localeCompare(b));
        return classes.length === ALL_CLASSES.length && ALL_CLASSES.every(key => classes.includes(key)) ? 'all' : classes.join(',');
    }

    function baseStats(record) {
        const stats = {};
        Object.entries(record.baseStats || {}).forEach(([key, field]) => {
            if (field && ['explicit', 'explicit_zero'].includes(field.valueState)) stats[key] = field.value;
        });
        return stats;
    }

    function relationSource(relation) {
        const target = relation && relation.target;
        if (!target || !target.entityId || !target.entityType) return null;
        const targetId = escapeHtml(target.entityId);
        if (relation.relationType === 'monster_drop' && target.entityType === 'monster') {
            const href = '?equipmentData=1&amp;tab=monster&amp;monster=' + encodeURIComponent(target.entityId);
            return '【掉落】<a href="' + href + '" data-entity-type="monster" data-entity-id="' + targetId + '">' + targetId + '</a>';
        }
        if (relation.relationType === 'craft_result') {
            return '【製作結果】' + escapeHtml(relation.relationRef && relation.relationRef.entityId || target.entityId);
        }
        if (relation.relationType === 'craft_requirement') {
            return '【製作材料】' + escapeHtml(relation.relationRef && relation.relationRef.entityId || target.entityId);
        }
        return '【關聯】' + escapeHtml(target.entityType) + ': ' + targetId;
    }

    function toReadModel(record, legacyRecord) {
        const verification = record.verification && record.verification.fields || {};
        const description = record.description && record.description.canonicalText;
        const price = record.price && record.price.amount;
        const enhance = record.safeEnhance || {};
        const safe = Number.isInteger(enhance.safeLevel) ? enhance.safeLevel : (enhance.enhanceable === false ? 0 : null);
        const sources = (record.relations || []).map(relationSource).filter(Boolean);
        const typeLabel = TYPE_LABELS[record.equipmentType] || record.equipmentType || '資料尚未建立';
        const slotLabel = SLOT_LABELS[record.slot] || record.slot || '資料尚未建立';
        const groupLabel = GROUP_LABELS[record.equipmentGroup] || record.equipmentGroup || '';
        const searchTokens = [
            record.displayName, record.equipmentId, groupLabel, typeLabel, slotLabel,
            record.equipmentGroup, record.equipmentType, record.slot, description || '', legacySearchText(legacyRecord)
        ].join(' ').toLocaleLowerCase();
        return {
            id: record.equipmentId,
            name: record.displayName,
            type: record.itemType,
            category: 'equipment',
            equipmentGroup: record.equipmentGroup,
            equipmentType: record.equipmentType,
            slot: record.slot,
            slot_cn: slotLabel,
            subtype_cn: [groupLabel, typeLabel, slotLabel].filter(Boolean).join(' '),
            rarity: record.rarity,
            price,
            desc: description,
            stats: baseStats(record),
            req: classRequirement(record),
            safe,
            sources,
            relations: clone(record.relations || []),
            legacySearchText: legacySearchText(legacyRecord),
            searchableText: searchTokens,
            compatibilityOnly: { legacySearchText: true },
            viewState: {
                source: 'dataset',
                status: record.status,
                unresolved: record.status === 'unresolved',
                partial: record.status === 'partial',
                priceConflict: record.status === 'review_required' || !!(verification.price && verification.price.conflict),
                descriptionMissing: description == null,
                safeMissing: safe == null,
                requirementMissing: classRequirement(record) == null
            },
            entityRef: clone(record.entityRef)
        };
    }

    function createEquipmentViewAdapter(options) {
        const settings = options || {};
        const repository = settings.repository;
        const legacyRecords = Array.isArray(settings.legacyRecords) ? settings.legacyRecords : [];
        const legacyById = new Map(legacyRecords.map(record => [record.id, record]));
        let readModels = [];
        let byId = new Map();
        let loadPromise = null;
        let diagnosticsPromise = null;
        let state = { ready: false, error: null, source: 'legacy', count: 0, renderTimeMs: null, diagnosticsReady: false, diagnosticsError: null };

        async function load() {
            if (loadPromise) return loadPromise;
            loadPromise = (async () => {
                if (!repository || typeof repository.loadEquipment !== 'function') {
                    state.error = 'Equipment Repository does not support equipment-only loading';
                    return false;
                }
                const loaded = await repository.loadEquipment();
                if (!loaded) {
                    state.error = repository.getState().error;
                    return false;
                }
                const records = repository.getAll();
                const nextModels = records.map(record => toReadModel(record, legacyById.get(record.equipmentId)));
                const nextById = new Map();
                for (const model of nextModels) {
                    if (nextById.has(model.id)) {
                        state.error = 'Duplicate Equipment ID in View Adapter';
                        return false;
                    }
                    nextById.set(model.id, model);
                }
                readModels = nextModels;
                byId = nextById;
                state.ready = true;
                state.error = null;
                state.source = 'dataset';
                state.count = readModels.length;
                return true;
            })();
            return loadPromise;
        }

        async function ensureDiagnostics(equipmentId) {
            if (diagnosticsPromise) return diagnosticsPromise;
            const start = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
            diagnosticsPromise = (async () => {
                const loaded = await repository.loadDiagnostics();
                state.diagnosticsReady = loaded;
                state.diagnosticsError = loaded ? null : repository.getState().diagnosticsError;
                state.diagnosticsLoadMs = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start;
                return {
                    ready: loaded,
                    diagnostics: loaded ? repository.getDiagnostics(equipmentId) : [],
                    unresolved: loaded ? repository.getUnresolved(equipmentId) : [],
                    error: state.diagnosticsError
                };
            })();
            return diagnosticsPromise;
        }

        function search(keyword) {
            const query = String(keyword || '').trim().toLocaleLowerCase();
            if (!query) return clone(readModels);
            return clone(readModels.filter(model => model.searchableText.includes(query)));
        }

        return Object.freeze({
            load,
            ensureDiagnostics,
            getAll: () => clone(readModels),
            getById: equipmentId => clone(byId.get(String(equipmentId || '')) || null),
            search,
            getState: () => clone(state),
            setRenderTime: milliseconds => { state.renderTimeMs = Number(milliseconds); }
        });
    }

    return Object.freeze({ createEquipmentViewAdapter, toReadModel, GROUP_LABELS, TYPE_LABELS, SLOT_LABELS });
});
