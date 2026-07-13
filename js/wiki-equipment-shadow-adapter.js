(function (root, factory) {
    'use strict';
    const api = factory();
    root.EquipmentShadowAdapter = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CATEGORIES = Object.freeze([
        'identity_mismatch',
        'display_name_mismatch',
        'equipment_group_mismatch',
        'equipment_type_mismatch',
        'slot_mismatch',
        'search_result_mismatch',
        'price_expected_conflict',
        'description_missing_expected',
        'safe_semantic_mismatch',
        'class_requirement_semantic_mismatch',
        'base_stat_mismatch',
        'relation_owner_mismatch',
        'legacy_source_unresolved',
        'diagnostics_expected',
        'technical_only_difference',
        'blocking_shadow_mismatch'
    ]);
    const SEARCH_FIXTURES = Object.freeze([
        '傳送控制戒指', '傳送控制', 'acc_116', '武器', '防具',
        '戒指', '盾牌', '雙手劍', '弓', '魔杖'
    ]);
    const SLOT_MAP = Object.freeze({
        wpn: 'weapon', arm: 'armor', helm: 'helmet', shin: 'greaves',
        amulet: 'necklace', ear: 'earring', petwpn: 'pet_weapon', petarm: 'pet_armor'
    });
    const ALL_CLASSES = Object.freeze(['dark', 'dragon', 'elf', 'illusion', 'knight', 'mage', 'royal', 'warrior']);

    function clone(value) {
        return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function sorted(values) {
        return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
    }

    function normalizeLegacySlot(record) {
        if (record && record.id === 'relic_yuka_blowdart') return 'weapon';
        if (record && record.subtype === 'arrow') return 'arrow';
        return SLOT_MAP[record && record.slot] || (record && record.slot) || null;
    }

    function legacySearch(records, keyword) {
        const query = String(keyword || '').trim().toLocaleLowerCase();
        if (!query) return records.slice();
        return records.filter(record => {
            const statValues = Object.values(record.stats || {}).join(' ');
            const sourceText = (record.sources || []).join(' ').replace(/<[^>]*>/g, ' ');
            return [record.name, record.desc, record.slot_cn, sourceText, statValues]
                .join(' ').toLocaleLowerCase().includes(query);
        });
    }

    function createMismatch(input) {
        return Object.assign({
            equipmentId: null,
            fieldPath: null,
            legacyValue: null,
            datasetValue: null,
            category: 'technical_only_difference',
            blocking: false,
            expected: false,
            reason: '',
            sourceLocation: null,
            notes: []
        }, clone(input));
    }

    function addMismatch(list, input) {
        const mismatch = createMismatch(input);
        if (!CATEGORIES.includes(mismatch.category)) mismatch.category = 'blocking_shadow_mismatch';
        list.push(mismatch);
    }

    function compareScalar(list, equipmentId, fieldPath, legacyValue, datasetValue, category) {
        if (JSON.stringify(legacyValue) === JSON.stringify(datasetValue)) return;
        addMismatch(list, {
            equipmentId, fieldPath, legacyValue, datasetValue, category,
            blocking: true,
            reason: 'Legacy projection and canonical Dataset disagree.',
            sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.' + fieldPath
        });
    }

    function compareEquipmentData(legacyInput, repository, options) {
        if (!repository || !repository.getState || !repository.getState().ready) {
            throw new Error('Equipment Repository is not ready');
        }
        const settings = options || {};
        const legacy = (Array.isArray(legacyInput) ? legacyInput : []).filter(record => record && record.category === 'equipment');
        const dataset = repository.getAll();
        const legacyById = new Map(legacy.map(record => [record.id, record]));
        const datasetById = new Map(dataset.map(record => [record.equipmentId, record]));
        const mismatches = [];

        sorted([...legacyById.keys(), ...datasetById.keys()]).forEach(equipmentId => {
            const oldRecord = legacyById.get(equipmentId);
            const newRecord = datasetById.get(equipmentId);
            if (!oldRecord || !newRecord) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'equipmentId',
                    legacyValue: oldRecord ? oldRecord.id : null,
                    datasetValue: newRecord ? newRecord.equipmentId : null,
                    category: 'identity_mismatch', blocking: true,
                    reason: 'Equipment exists on only one side of the shadow comparison.',
                    sourceLocation: oldRecord ? 'wiki.html#EQUIP_DATA.' + equipmentId : 'data/equipment/equipments.json#' + equipmentId
                });
                return;
            }
            compareScalar(mismatches, equipmentId, 'displayName', oldRecord.name, newRecord.displayName, 'display_name_mismatch');
            compareScalar(mismatches, equipmentId, 'equipmentGroup', oldRecord.equipmentGroup, newRecord.equipmentGroup, 'equipment_group_mismatch');
            compareScalar(mismatches, equipmentId, 'equipmentType', oldRecord.equipmentType, newRecord.equipmentType, 'equipment_type_mismatch');
            compareScalar(mismatches, equipmentId, 'slot', normalizeLegacySlot(oldRecord), newRecord.slot, 'slot_mismatch');
            compareScalar(mismatches, equipmentId, 'rarity', oldRecord.rarity, newRecord.rarity, 'blocking_shadow_mismatch');

            if (oldRecord.price !== newRecord.price.amount) {
                const hasConflict = repository.getDiagnostics(equipmentId).some(record => record.code === 'equipment_price_conflict');
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'price.amount', legacyValue: oldRecord.price,
                    datasetValue: newRecord.price.amount,
                    category: hasConflict ? 'price_expected_conflict' : 'blocking_shadow_mismatch',
                    blocking: !hasConflict, expected: hasConflict,
                    reason: hasConflict ? 'Known source-precedence conflict retained by the Dataset.' : 'Unexplained canonical price mismatch.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.price'
                });
            }

            const legacyDescription = String(oldRecord.desc || '').trim();
            const datasetDescription = newRecord.description && newRecord.description.canonicalText;
            if (!legacyDescription && datasetDescription == null) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'description.canonicalText', legacyValue: '', datasetValue: null,
                    category: 'description_missing_expected', expected: true,
                    reason: 'Both sources intentionally represent missing description with different technical values.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.desc'
                });
            } else if (legacyDescription !== String(datasetDescription || '').trim()) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'description.canonicalText', legacyValue: oldRecord.desc,
                    datasetValue: datasetDescription, category: 'technical_only_difference', expected: true,
                    reason: 'Dataset uses the canonical source while legacy Wiki text is an editorial projection.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.desc'
                });
            }

            const safe = newRecord.safeEnhance || {};
            if (safe.enhanceable == null) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'safeEnhance', legacyValue: oldRecord.safe, datasetValue: safe,
                    category: 'safe_semantic_mismatch', expected: true,
                    reason: 'Enhanceability is unresolved; the legacy numeric convenience value is not promoted to canonical truth.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.safe'
                });
            } else if (safe.enhanceable && oldRecord.safe !== safe.safeLevel) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'safeEnhance.safeLevel', legacyValue: oldRecord.safe, datasetValue: safe.safeLevel,
                    category: 'safe_semantic_mismatch', blocking: true,
                    reason: 'Resolved safe enhancement levels disagree.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.safe'
                });
            }

            const classes = newRecord.classRequirements && newRecord.classRequirements.baseClasses;
            const legacyClasses = oldRecord.req === 'all' ? ALL_CLASSES.slice() : sorted(String(oldRecord.req || '').split(',').filter(Boolean));
            if (classes == null) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'classRequirements.baseClasses', legacyValue: legacyClasses, datasetValue: null,
                    category: 'class_requirement_semantic_mismatch', expected: true,
                    reason: 'Canonical class restriction is unresolved and is not inferred from Wiki text.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.req'
                });
            } else if (JSON.stringify(sorted(classes)) !== JSON.stringify(legacyClasses)) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'classRequirements.baseClasses', legacyValue: legacyClasses, datasetValue: sorted(classes),
                    category: 'class_requirement_semantic_mismatch', blocking: true,
                    reason: 'Resolved class requirements disagree.',
                    sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.req'
                });
            }

            Object.keys(newRecord.baseStats || {}).forEach(stat => {
                const field = newRecord.baseStats[stat];
                if (!field || !['explicit', 'explicit_zero'].includes(field.valueState)) return;
                const legacyValue = Object.prototype.hasOwnProperty.call(oldRecord.stats || {}, stat) ? oldRecord.stats[stat] : 0;
                if (legacyValue !== field.value) {
                    addMismatch(mismatches, {
                        equipmentId, fieldPath: 'baseStats.' + stat + '.value', legacyValue, datasetValue: field.value,
                        category: 'base_stat_mismatch', blocking: true,
                        reason: 'Resolved base stat differs from the current Wiki projection.',
                        sourceLocation: 'wiki.html#EQUIP_DATA.' + equipmentId + '.stats.' + stat
                    });
                }
            });

            const unresolvedRelation = repository.getDiagnostics(equipmentId).find(record => record.code === 'equipment_relation_unresolved');
            if ((oldRecord.sources || []).length && unresolvedRelation) {
                addMismatch(mismatches, {
                    equipmentId, fieldPath: 'relations', legacyValue: oldRecord.sources.length,
                    datasetValue: newRecord.relations.length, category: 'legacy_source_unresolved', expected: true,
                    reason: 'Name/HTML legacy source claims cannot be matched to formal owner Entity IDs without guessing.',
                    sourceLocation: unresolvedRelation.sourceLocation,
                    notes: ['Formal resolved relations remain available separately in the Dataset.']
                });
            }
        });

        SEARCH_FIXTURES.forEach(query => {
            const legacyIds = sorted(legacySearch(legacy, query).map(record => record.id));
            const datasetIds = sorted(repository.searchEquipment(query).map(record => record.equipmentId));
            if (JSON.stringify(legacyIds) !== JSON.stringify(datasetIds)) {
                addMismatch(mismatches, {
                    equipmentId: '__search__', fieldPath: 'search.' + query,
                    legacyValue: legacyIds, datasetValue: datasetIds,
                    category: 'search_result_mismatch', expected: true,
                    reason: 'Repository deliberately indexes ID and normalized classification labels in addition to legacy display fields.',
                    sourceLocation: 'wiki.html#onSearchInput', notes: ['Query: ' + query]
                });
            }
        });

        mismatches.sort((a, b) => [a.category, a.equipmentId || '', a.fieldPath || '', a.reason]
            .join('\u0000').localeCompare([b.category, b.equipmentId || '', b.fieldPath || '', b.reason].join('\u0000')));
        repository.measureSearch(SEARCH_FIXTURES);
        const byCategory = {};
        CATEGORIES.forEach(category => { byCategory[category] = 0; });
        mismatches.forEach(record => { byCategory[record.category] += 1; });
        const blockingCount = mismatches.filter(record => record.blocking).length;
        const relationCoverage = {
            formalMonsterDrop: dataset.reduce((sum, record) => sum + record.relations.filter(relation => relation.relationType === 'monster_drop').length, 0),
            formalCraftResult: dataset.reduce((sum, record) => sum + record.relations.filter(relation => relation.relationType === 'craft_result').length, 0),
            formalCraftRequirement: dataset.reduce((sum, record) => sum + record.relations.filter(relation => relation.relationType === 'craft_requirement').length, 0),
            legacyDropClaimEquipment: legacy.filter(record => (record.sources || []).some(source => source.includes('【掉落】'))).length,
            legacyCraftClaimEquipment: legacy.filter(record => (record.sources || []).some(source => source.includes('【製作】'))).length,
            unresolvedLegacySourceEquipment: byCategory.legacy_source_unresolved
        };
        return clone({
            ready: true,
            comparedAt: settings.comparedAt || null,
            counts: { legacy: legacy.length, dataset: dataset.length, mismatches: mismatches.length, blocking: blockingCount, expected: mismatches.filter(record => record.expected).length },
            parity: {
                identity: byCategory.identity_mismatch === 0,
                classification: byCategory.equipment_group_mismatch + byCategory.equipment_type_mismatch + byCategory.slot_mismatch === 0,
                detail: byCategory.display_name_mismatch + byCategory.base_stat_mismatch + byCategory.blocking_shadow_mismatch === 0,
                search: byCategory.search_result_mismatch === 0,
                relation: byCategory.relation_owner_mismatch === 0 && byCategory.legacy_source_unresolved === 0
            },
            relationCoverage,
            byCategory,
            searchFixtures: SEARCH_FIXTURES.slice(),
            performance: repository.getState().performance,
            mismatches
        });
    }

    return Object.freeze({ CATEGORIES, SEARCH_FIXTURES, normalizeLegacySlot, legacySearch, compareEquipmentData });
});
