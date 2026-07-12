(function (global) {
    'use strict';

    const DATASET_NAME = 'craft';
    const CONTRACTED_EMPTY_NPC_IDS = ['npc_mystic_mage'];
    let snapshot = null;

    function cloneList(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    function makeArrayIndex(entities, keySelector) {
        const index = new Map();
        entities.forEach(entity => {
            const keys = keySelector(entity);
            keys.forEach(key => {
                if (!index.has(key)) index.set(key, []);
                index.get(key).push(entity);
            });
        });
        index.forEach(values => values.sort((a, b) => a.id.localeCompare(b.id)));
        return index;
    }

    function buildSnapshot(craftData) {
        const recipes = cloneList(craftData.searchRecipes(''));
        recipes.sort((a, b) => a.id.localeCompare(b.id));
        const itemIds = new Set();
        const npcIds = new Set();
        recipes.forEach(recipe => {
            itemIds.add(recipe.result.itemId);
            npcIds.add(recipe.npcId);
            recipe.requirements.forEach(requirement => itemIds.add(requirement.itemId));
        });
        CONTRACTED_EMPTY_NPC_IDS.forEach(npcId => {
            if (craftData.getNpcById(npcId)) npcIds.add(npcId);
        });
        const items = Array.from(itemIds).sort().map(itemId => craftData.getItemById(itemId));
        const npcs = Array.from(npcIds).sort().map(npcId => craftData.getNpcById(npcId));
        const drops = Array.from(itemIds).sort().map(itemId => craftData.getSourceByItemId(itemId));
        if (items.some(item => !item) || npcs.some(npc => !npc) || drops.some(drop => !drop)) {
            throw new Error('CraftWikiData snapshot contains an unresolved API lookup.');
        }
        return { recipes, items, npcs, drops };
    }

    function createRepositories(craftData, sourceSnapshot) {
        const core = global.WikiDataCore;
        let itemsRepository;
        let npcsRepository;

        const recipesRepository = core.repositories.createReadOnly({
            name: 'recipes',
            entityType: 'recipe',
            entities: sourceSnapshot.recipes,
            searchFields: ['id', 'description'],
            extensions({ entities, byId }) {
                const byNpcId = makeArrayIndex(entities, recipe => [recipe.npcId]);
                sourceSnapshot.npcs.forEach(npc => {
                    if (!byNpcId.has(npc.id)) byNpcId.set(npc.id, []);
                });
                const byResultId = makeArrayIndex(entities, recipe => [recipe.result.itemId]);
                const byRequirementId = makeArrayIndex(
                    entities,
                    recipe => recipe.requirements.map(requirement => requirement.itemId)
                );
                return {
                    getByNpcId: npcId => cloneList(byNpcId.get(npcId)),
                    getByResultId: itemId => cloneList(byResultId.get(itemId)),
                    getByRequirementId: itemId => cloneList(byRequirementId.get(itemId)),
                    search(keyword) {
                        const sourceResults = craftData.searchRecipes(keyword);
                        return sourceResults.map(recipe => Object.freeze({
                            entityType: 'recipe',
                            entityId: recipe.id,
                            entity: byId.get(recipe.id)
                        }));
                    }
                };
            }
        });

        itemsRepository = core.repositories.createReadOnly({
            name: 'items', entityType: 'item', entities: sourceSnapshot.items, searchFields: ['id', 'name']
        });
        npcsRepository = core.repositories.createReadOnly({
            name: 'npcs', entityType: 'npc', entities: sourceSnapshot.npcs, searchFields: ['id', 'name']
        });
        const dropsRepository = core.repositories.createReadOnly({
            name: 'drops',
            entityType: 'drop',
            entities: sourceSnapshot.drops.map(record => Object.assign({ id: record.itemId }, record)),
            searchFields: ['id', 'itemId'],
            extensions({ byId }) {
                return {
                    getByItemId: itemId => byId.get(itemId) || null
                };
            }
        });

        return {
            recipes: recipesRepository,
            items: itemsRepository,
            npcs: npcsRepository,
            drops: dropsRepository
        };
    }

    function register(craftData) {
        const core = global.WikiDataCore;
        if (!core) return false;
        if (!craftData || typeof craftData.isReady !== 'function' || !craftData.isReady()) {
            core.diagnostics.add({
                code: 'adapter_not_ready', severity: 'info', dataset: DATASET_NAME,
                entityType: null, entityId: null,
                message: 'CraftWikiData is not ready; the compatibility adapter was not registered.',
                sourceLocation: 'wiki-data-core-craft-adapter.js', blocking: false
            });
            return false;
        }
        try {
            if (!snapshot) snapshot = buildSnapshot(craftData);
            const repositories = createRepositories(craftData, snapshot);
            const registered = core.registerDataset({
                name: DATASET_NAME,
                version: 1,
                status: 'ready',
                repositories,
                diagnostics: [],
                adapterType: 'compatibility'
            });
            if (!registered && !core.hasDataset(DATASET_NAME)) {
                core.diagnostics.add({
                    code: 'repository_registration_error', severity: 'error', dataset: DATASET_NAME,
                    entityType: null, entityId: null,
                    message: 'Craft compatibility repositories could not be registered.',
                    sourceLocation: 'wiki-data-core-craft-adapter.js', blocking: true
                });
            }
            return registered;
        } catch (error) {
            core.diagnostics.add({
                code: 'repository_registration_error', severity: 'error', dataset: DATASET_NAME,
                entityType: null, entityId: null, message: error.message,
                sourceLocation: 'wiki-data-core-craft-adapter.js', blocking: true
            });
            return false;
        }
    }

    function reset() {
        snapshot = null;
    }

    if (global.WikiDataCore) {
        global.WikiDataCore.adapters.install(DATASET_NAME, Object.freeze({ register, reset }));
    }
})(window);
