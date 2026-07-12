'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data', 'craft');
const SCRIPT_FILES = [
    path.join(ROOT, 'js', 'wiki-craft-data.js'),
    path.join(ROOT, 'js', 'wiki-data-core.js'),
    path.join(ROOT, 'js', 'wiki-data-core-craft-adapter.js')
];
const JSON_FILES = ['recipes.json', 'items.json', 'npcs.json', 'drops.json', 'unresolved.json'];
const payloads = Object.fromEntries(JSON_FILES.map(name => [
    name,
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'))
]));

function createEnvironment() {
    const fetches = [];
    const consoleErrors = [];
    const window = {};
    const context = {
        window,
        fetch: async url => {
            const name = String(url).split('/').pop();
            fetches.push(name);
            return { ok: true, status: 200, json: async () => payloads[name] };
        },
        console: { error: (...args) => consoleErrors.push(args.map(String).join(' ')), log: console.log },
        Map, Set, WeakMap, WeakSet, Promise, Object, Array, String, Number, Boolean,
        Math, JSON, Error, Reflect, Symbol
    };
    vm.createContext(context);
    SCRIPT_FILES.forEach(file => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
    return { window, fetches, consoleErrors };
}

function comparable(value) {
    return JSON.parse(JSON.stringify(value));
}

async function run() {
    const env = createEnvironment();
    const craft = env.window.CraftWikiData;
    const core = env.window.WikiDataCore;

    assert.strictEqual(core.hasDataset('craft'), false, 'adapter must not auto-register');
    assert.strictEqual(core.registerCraftAdapter(craft), false, 'not-ready adapter must not register');
    assert.strictEqual(core.getDatasetStatus('craft').status, 'idle');
    assert.strictEqual(core.diagnostics.getByCode('adapter_not_ready').length, 1);
    core.diagnostics.clear('craft');

    const originalApi = Object.fromEntries(Object.keys(craft).map(key => [key, craft[key]]));
    const beforePayload = JSON.stringify(payloads);
    assert.strictEqual(await craft.load(), true);
    assert.deepStrictEqual(env.fetches.sort(), JSON_FILES.slice().sort(), 'CraftWikiData must perform exactly five fetches');
    const fetchCountAfterLoad = env.fetches.length;
    const yieldIds = [
        'recipe_npc_narupa_wpn_30_01', 'recipe_npc_narupa_wpn_5_01',
        'recipe_npc_elf_new_item_169_01', 'recipe_npc_elf_new_item_170_01'
    ];
    const yieldResultsBeforeAdapter = Object.fromEntries(yieldIds.map(id => {
        const quantity = craft.getRecipeById(id).result.quantity;
        return [id, comparable(craft.calculateRecipeRequirements(id, quantity + 1))];
    }));
    const ambiguousResultBeforeAdapter = comparable(craft.calculateRecipeRequirements('recipe_npc_joel_shd_bone_01', 1));
    assert.strictEqual(core.registerCraftAdapter(craft), true, 'ready adapter must register');
    assert.strictEqual(env.fetches.length, fetchCountAfterLoad, 'adapter must not fetch');
    assert.strictEqual(core.getDatasetStatus('craft').status, 'ready');
    assert.deepStrictEqual(core.listRepositories(), ['drops', 'items', 'npcs', 'recipes']);

    const recipes = core.getRepository('recipes');
    const items = core.getRepository('items');
    const npcs = core.getRepository('npcs');
    const drops = core.getRepository('drops');
    assert.strictEqual(recipes.getAll().length, 279);
    assert.strictEqual(npcs.getAll().length, 47);
    assert.strictEqual(items.getAll().length, 471);
    assert.strictEqual(drops.getAll().length, 471);
    assert.strictEqual(new Set(recipes.getAll().map(recipe => recipe.result.itemId)).size, 272);
    assert.strictEqual(new Set(recipes.getAll().flatMap(recipe => recipe.requirements.map(req => req.itemId))).size, 278);

    const recipeId = 'recipe_npc_finn_hlm_silver_01';
    assert.deepStrictEqual(comparable(recipes.getById(recipeId)), comparable(craft.getRecipeById(recipeId)));
    assert.deepStrictEqual(comparable(recipes.getByNpcId('npc_finn')), comparable(craft.getRecipesByNpcId('npc_finn')));
    assert.deepStrictEqual(comparable(recipes.getByResultId('hlm_silver')), comparable(craft.getRecipesByResultId('hlm_silver')));
    assert.deepStrictEqual(comparable(recipes.getByRequirementId('arm_48')), comparable(craft.getRecipesByRequirementId('arm_48')));
    assert.deepStrictEqual(comparable(items.getById('hlm_silver')), comparable(craft.getItemById('hlm_silver')));
    assert.deepStrictEqual(comparable(npcs.getById('npc_finn')), comparable(craft.getNpcById('npc_finn')));
    assert.deepStrictEqual(comparable(drops.getByItemId('mat_unicorn_horn')), comparable(Object.assign({ id: 'mat_unicorn_horn' }, craft.getSourceByItemId('mat_unicorn_horn'))));
    assert.deepStrictEqual(recipes.search('npc_sebas').map(result => result.entityId), craft.searchRecipes('npc_sebas').map(recipe => recipe.id));
    assert.strictEqual(recipes.search('').length, craft.searchRecipes('').length);

    assert.strictEqual(recipes.getByResultId('hlm_silver').length, 2);
    assert.deepStrictEqual(comparable(recipes.getByNpcId('npc_mystic_mage')), []);
    assert.strictEqual(npcs.has('npc_mystic_mage'), true);
    assert.strictEqual(npcs.getById('npc_mystic_mage').dataStatus, 'stub');
    assert.strictEqual(items.getById('item_pride_dom_11').dataStatus, 'stub');
    assert.strictEqual(recipes.getById('invalid'), null);
    assert.deepStrictEqual(comparable(recipes.getByNpcId('invalid')), []);

    yieldIds.forEach(id => {
        const quantity = craft.getRecipeById(id).result.quantity;
        assert.deepStrictEqual(
            comparable(craft.calculateRecipeRequirements(id, quantity + 1)),
            yieldResultsBeforeAdapter[id]
        );
        assert.strictEqual(craft.calculateRecipeRequirements(id, quantity + 1).craftCount, 2);
    });
    assert.deepStrictEqual(
        comparable(craft.calculateRecipeRequirements('recipe_npc_joel_shd_bone_01', 1)),
        ambiguousResultBeforeAdapter
    );
    assert.strictEqual(ambiguousResultBeforeAdapter.status, 'ambiguous');

    const itemArray = items.getAll();
    const originalLength = itemArray.length;
    itemArray.pop();
    assert.strictEqual(items.getAll().length, originalLength, 'getAll array mutation must not affect repository');
    const immutableItem = items.getById('hlm_silver');
    assert.strictEqual(Object.isFrozen(immutableItem), true);
    assert.throws(() => { immutableItem.name = 'changed'; }, TypeError);
    assert.notStrictEqual(items.getById('hlm_silver').name, 'changed');

    assert.strictEqual(core.registerCraftAdapter(craft), false, 'duplicate registration must fail');
    assert.strictEqual(core.diagnostics.getByCode('duplicate_dataset').length, 1);
    assert.strictEqual(core.getDatasetStatus('craft').status, 'ready', 'duplicate must not overwrite ready Dataset');
    Object.keys(originalApi).forEach(key => assert.strictEqual(craft[key], originalApi[key], `CraftWikiData API changed: ${key}`));
    assert.strictEqual(JSON.stringify(payloads), beforePayload, 'source JSON objects must remain unchanged');

    core.resetForTests('craft');
    assert.strictEqual(core.hasDataset('craft'), false);
    assert.strictEqual(core.listRepositories().length, 0);
    assert.strictEqual(core.diagnostics.getByDataset('craft').length, 0);
    assert.strictEqual(craft.isReady(), true, 'Core reset must not reset CraftWikiData');
    assert.strictEqual(env.fetches.length, fetchCountAfterLoad, 'Core reset must not fetch');

    console.log(JSON.stringify({
        passed: true,
        counts: { recipes: 279, npcs: 47, items: 471, resultKeys: 272, requirementKeys: 278, sourceKeys: 471 },
        repositories: ['recipes', 'items', 'npcs', 'drops'],
        fetches: env.fetches.length,
        consoleErrors: env.consoleErrors,
        specialCases: {
            hlmSilverRecipes: 2,
            mysticMageRecipes: 0,
            nonUnitYieldCases: 4,
            ambiguity: 'preserved',
            immutableSnapshot: true,
            duplicateDiagnostic: true,
            resetIsolation: true
        }
    }, null, 2));
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
