(function (global) {
    'use strict';

    const FILES = [
        { name: 'recipes.json', path: './data/craft/recipes.json', required: true, key: 'recipes' },
        { name: 'items.json', path: './data/craft/items.json', required: true, key: 'items' },
        { name: 'npcs.json', path: './data/craft/npcs.json', required: true, key: 'npcs' },
        { name: 'drops.json', path: './data/craft/drops.json', required: false, key: 'drops' },
        { name: 'unresolved.json', path: './data/craft/unresolved.json', required: false, key: 'unresolved' }
    ];

    let status = 'idle';
    let loadError = null;
    let loadPromise = null;
    let loadedData = null;
    let optionalErrors = [];
    let indexes = createEmptyIndexes();

    function createEmptyIndexes() {
        return {
            recipesById: new Map(),
            recipesByNpcId: new Map(),
            recipesByResultId: new Map(),
            recipesByRequirementId: new Map(),
            itemsById: new Map(),
            npcsById: new Map(),
            sourcesByItemId: new Map()
        };
    }

    function addToArrayIndex(index, key, value) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(value);
    }

    function assertArray(value, label) {
        if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    }

    function assertUnique(records, field, label) {
        const seen = new Set();
        records.forEach(record => {
            const id = record && record[field];
            if (typeof id !== 'string' || !id) throw new Error(`${label} contains an invalid ${field}`);
            if (seen.has(id)) throw new Error(`${label} contains duplicate ID: ${id}`);
            seen.add(id);
        });
        return seen;
    }

    async function fetchJson(file) {
        let response;
        try {
            response = await fetch(file.path);
        } catch (error) {
            const wrapped = new Error(`${file.name} load failed: ${error.message}`);
            console.error(`CraftWikiData: ${wrapped.message}`);
            throw wrapped;
        }
        if (!response.ok) {
            const error = new Error(`${file.name} load failed: HTTP ${response.status}`);
            console.error(`CraftWikiData: ${error.message}`);
            throw error;
        }
        try {
            return await response.json();
        } catch (error) {
            const wrapped = new Error(`${file.name} parse failed: ${error.message}`);
            console.error(`CraftWikiData: ${wrapped.message}`);
            throw wrapped;
        }
    }

    function validateLoadedData(data) {
        assertArray(data.recipes, 'recipes');
        assertArray(data.items, 'items');
        assertArray(data.npcs, 'npcs');
        assertArray(data.drops, 'drops');
        assertArray(data.unresolved, 'unresolved');

        const recipeIds = assertUnique(data.recipes, 'id', 'recipes');
        const itemIds = assertUnique(data.items, 'id', 'items');
        const npcIds = assertUnique(data.npcs, 'id', 'npcs');
        assertUnique(data.drops, 'itemId', 'drops');

        data.items.forEach(item => {
            if (!['complete', 'stub'].includes(item.dataStatus)) {
                throw new Error(`item has invalid dataStatus: ${item.id}`);
            }
            if (item.dataStatus === 'stub' && (item.linkStatus !== 'unresolved' || item.entityRef !== null)) {
                throw new Error(`stub item is not explicitly unresolved: ${item.id}`);
            }
        });

        data.npcs.forEach(npc => {
            if (!['complete', 'stub'].includes(npc.dataStatus)) {
                throw new Error(`NPC has invalid dataStatus: ${npc.id}`);
            }
            if (npc.dataStatus === 'stub' && npc.linkStatus !== 'unresolved') {
                throw new Error(`stub NPC is not explicitly unresolved: ${npc.id}`);
            }
        });

        data.recipes.forEach(recipe => {
            if (!recipeIds.has(recipe.id)) throw new Error(`recipe ID missing: ${recipe.id}`);
            if (!npcIds.has(recipe.npcId)) throw new Error(`recipe references missing NPC: ${recipe.id}`);
            if (!recipe.result || !itemIds.has(recipe.result.itemId)) {
                throw new Error(`recipe references missing result item: ${recipe.id}`);
            }
            if (!Number.isInteger(recipe.result.quantity) || recipe.result.quantity <= 0) {
                throw new Error(`recipe has invalid result quantity: ${recipe.id}`);
            }
            if (!recipe.currencyCost || recipe.currencyCost.currency !== 'gold' ||
                !Number.isFinite(recipe.currencyCost.amount) || recipe.currencyCost.amount < 0) {
                throw new Error(`recipe has invalid currencyCost: ${recipe.id}`);
            }
            if (!Array.isArray(recipe.requirements)) {
                throw new Error(`recipe requirements must be an array: ${recipe.id}`);
            }
            const requirementIds = new Set();
            recipe.requirements.forEach(requirement => {
                if (requirement.itemId === 'gold') throw new Error(`recipe contains gold requirement: ${recipe.id}`);
                if (!itemIds.has(requirement.itemId)) {
                    throw new Error(`recipe references missing requirement item: ${recipe.id}/${requirement.itemId}`);
                }
                if (requirementIds.has(requirement.itemId)) {
                    throw new Error(`recipe contains duplicate requirement: ${recipe.id}/${requirement.itemId}`);
                }
                requirementIds.add(requirement.itemId);
                if (!Number.isInteger(requirement.quantity) || requirement.quantity <= 0) {
                    throw new Error(`recipe has invalid requirement quantity: ${recipe.id}/${requirement.itemId}`);
                }
            });
        });
        return true;
    }

    function buildIndexes(data) {
        const next = createEmptyIndexes();
        data.items.forEach(item => next.itemsById.set(item.id, item));
        data.npcs.forEach(npc => {
            next.npcsById.set(npc.id, npc);
            next.recipesByNpcId.set(npc.id, []);
        });
        data.drops.forEach(source => next.sourcesByItemId.set(source.itemId, source));
        data.recipes.forEach(recipe => {
            next.recipesById.set(recipe.id, recipe);
            addToArrayIndex(next.recipesByNpcId, recipe.npcId, recipe);
            addToArrayIndex(next.recipesByResultId, recipe.result.itemId, recipe);
            recipe.requirements.forEach(requirement => {
                addToArrayIndex(next.recipesByRequirementId, requirement.itemId, recipe);
            });
        });
        ['recipesByNpcId', 'recipesByResultId', 'recipesByRequirementId'].forEach(name => {
            next[name].forEach(recipes => recipes.sort((a, b) => a.id.localeCompare(b.id)));
        });
        next.recipesByResultId.forEach(recipes => {
            if (!Array.isArray(recipes)) throw new Error('recipesByResultId values must be arrays');
        });
        indexes = next;
        return getIndexCounts();
    }

    function getIndexCounts() {
        return {
            recipesById: indexes.recipesById.size,
            recipesByNpcId: indexes.recipesByNpcId.size,
            recipesByResultId: indexes.recipesByResultId.size,
            recipesByRequirementId: indexes.recipesByRequirementId.size,
            itemsById: indexes.itemsById.size,
            npcsById: indexes.npcsById.size,
            sourcesByItemId: indexes.sourcesByItemId.size
        };
    }

    function load() {
        if (status === 'ready') return Promise.resolve(true);
        if (loadPromise) return loadPromise;
        status = 'loading';
        loadError = null;
        optionalErrors = [];
        loadPromise = (async () => {
            const results = await Promise.allSettled(FILES.map(fetchJson));
            const data = {};
            let requiredFailure = null;
            results.forEach((result, index) => {
                const file = FILES[index];
                if (result.status === 'fulfilled') {
                    data[file.key] = result.value;
                } else if (file.required) {
                    requiredFailure = requiredFailure || result.reason;
                } else {
                    optionalErrors.push({ file: file.name, message: result.reason.message });
                    data[file.key] = [];
                }
            });
            if (requiredFailure) throw requiredFailure;
            data.drops = data.drops || [];
            data.unresolved = data.unresolved || [];
            validateLoadedData(data);
            buildIndexes(data);
            loadedData = data;
            status = 'ready';
            return true;
        })().catch(error => {
            status = 'error';
            loadError = error;
            loadedData = null;
            indexes = createEmptyIndexes();
            console.error('CraftWikiData: initialization failed', error);
            return false;
        });
        return loadPromise;
    }

    function getState() {
        return {
            status,
            ready: status === 'ready',
            optionalErrors: optionalErrors.map(error => ({ ...error })),
            indexCounts: getIndexCounts()
        };
    }

    function cloneRecipeList(recipes) {
        return recipes ? recipes.slice() : [];
    }

    function getRecipeById(recipeId) {
        return indexes.recipesById.get(recipeId) || null;
    }

    function getRecipesByNpcId(npcId) {
        return cloneRecipeList(indexes.recipesByNpcId.get(npcId));
    }

    function getRecipesByResultId(itemId) {
        return cloneRecipeList(indexes.recipesByResultId.get(itemId));
    }

    function getRecipesByRequirementId(itemId) {
        return cloneRecipeList(indexes.recipesByRequirementId.get(itemId));
    }

    function getItemById(itemId) {
        return indexes.itemsById.get(itemId) || null;
    }

    function getNpcById(npcId) {
        return indexes.npcsById.get(npcId) || null;
    }

    function getSourceByItemId(itemId) {
        return indexes.sourcesByItemId.get(itemId) || null;
    }

    function searchRecipes(keyword) {
        if (!loadedData) return [];
        const query = String(keyword == null ? '' : keyword).trim().toLocaleLowerCase();
        if (!query) return loadedData.recipes.slice();
        return loadedData.recipes.filter(recipe => {
            const result = indexes.itemsById.get(recipe.result.itemId);
            const npc = indexes.npcsById.get(recipe.npcId);
            const values = [
                recipe.result.itemId,
                result && result.name,
                recipe.description,
                recipe.npcId,
                npc && npc.name
            ];
            recipe.requirements.forEach(requirement => {
                const item = indexes.itemsById.get(requirement.itemId);
                values.push(requirement.itemId, item && item.name);
            });
            return values.some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(query));
        });
    }

    function calculateRecipeRequirements(recipeId, targetQuantity) {
        if (!Number.isInteger(targetQuantity) || targetQuantity <= 0) {
            return { status: 'error', error: 'target_quantity_must_be_a_positive_integer' };
        }
        const rootRecipe = indexes.recipesById.get(recipeId);
        if (!rootRecipe) return { status: 'error', error: 'recipe_not_found', recipeId };

        const materials = new Map();
        const steps = [];
        let requiredGold = 0;

        function expand(recipe, needed, path) {
            if (path.includes(recipe.id)) {
                return { status: 'cycle', recipeIds: path.concat(recipe.id) };
            }
            const craftCount = Math.ceil(needed / recipe.result.quantity);
            const actualOutput = craftCount * recipe.result.quantity;
            requiredGold += recipe.currencyCost.amount * craftCount;
            steps.push({
                recipeId: recipe.id,
                itemId: recipe.result.itemId,
                targetQuantity: needed,
                craftCount,
                actualOutput,
                surplus: actualOutput - needed
            });
            for (const requirement of recipe.requirements) {
                const requiredQuantity = requirement.quantity * craftCount;
                const candidates = indexes.recipesByResultId.get(requirement.itemId) || [];
                if (candidates.length > 1) {
                    return {
                        status: 'ambiguous',
                        itemId: requirement.itemId,
                        recipeIds: candidates.map(candidate => candidate.id)
                    };
                }
                if (candidates.length === 1) {
                    const nested = expand(candidates[0], requiredQuantity, path.concat(recipe.id));
                    if (nested) return nested;
                } else {
                    materials.set(requirement.itemId, (materials.get(requirement.itemId) || 0) + requiredQuantity);
                }
            }
            return null;
        }

        const interruption = expand(rootRecipe, targetQuantity, []);
        if (interruption) return interruption;
        const rootStep = steps[0];
        return {
            status: 'ok',
            recipeId,
            targetQuantity,
            craftCount: rootStep.craftCount,
            actualOutput: rootStep.actualOutput,
            surplus: rootStep.surplus,
            requiredGold,
            requiredMaterials: Object.fromEntries([...materials.entries()].sort(([a], [b]) => a.localeCompare(b))),
            steps
        };
    }

    function resetForTests() {
        status = 'idle';
        loadError = null;
        loadPromise = null;
        loadedData = null;
        optionalErrors = [];
        indexes = createEmptyIndexes();
    }

    global.CraftWikiData = Object.freeze({
        load,
        validateLoadedData,
        buildIndexes,
        getState,
        isReady: () => status === 'ready',
        getLoadError: () => loadError,
        getRecipeById,
        getRecipesByNpcId,
        getRecipesByResultId,
        getRecipesByRequirementId,
        getItemById,
        getNpcById,
        getSourceByItemId,
        searchRecipes,
        calculateRecipeRequirements,
        resetForTests
    });
})(window);
