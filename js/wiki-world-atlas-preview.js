(function (global) {
    'use strict';

    const EMPTY = '資料尚未建立';
    const NPC_PATH = './data/craft/npcs.json';
    const CRAFT_RECIPES_PATH = './data/craft/recipes.json';
    const CRAFT_ITEMS_PATH = './data/craft/items.json';
    const UPSTREAM_BASE = 'https://shines871.github.io/idle-lineage-class/';
    const UPSTREAM_DATA_PATH = `${UPSTREAM_BASE}js/00-data.js`;
    const UPSTREAM_RENDER_PATH = `${UPSTREAM_BASE}js/09-vfx-render.js`;
    let initialized = false;
    let model = null;
    let npcs = [];
    let craftRecipes = [];
    let craftItems = new Map();
    let selectedRegionKey = null;
    let selectedMap = '';
    let query = '';
    let monsterReady = false;
    let modalTrigger = null;
    let tooltipItemId = null;
    let historyBound = false;
    const detailCache = new Map();
    const sourceEntryCache = new Map();
    const previewDiagnostics = { unresolvedRegionMaps: [], sourceFallback: false, missingMapLabels: [] };
    const VISUAL_OFFSETS = {
        'dk': 'translate(0, -6px) scale(1.15)',
        'sanct_giltas': 'translate(0, -8px) scale(1.1)',
        'giant_spider': 'translate(0, 4px)'
    };
    let sourceEvidence = { data: '', mobsBlock: '', itemsBlock: '', animated: new Set(), eightDirection: new Set(), aliases: new Map() };

    function isEnabled() {
        return new URLSearchParams(global.location.search).get('worldAtlas') !== '0';
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

    function normalize(value) {
        return String(value == null ? '' : value).trim().toLocaleLowerCase();
    }

    function extractBalancedObject(source, start) {
        if (start < 0 || source[start] !== '{') return '';
        let depth = 0;
        let quote = '';
        let escaped = false;
        for (let index = start; index < source.length; index += 1) {
            const char = source[index];
            if (quote) {
                if (escaped) escaped = false;
                else if (char === '\\') escaped = true;
                else if (char === quote) quote = '';
                continue;
            }
            if (char === '"' || char === "'") quote = char;
            else if (char === '{') depth += 1;
            else if (char === '}' && --depth === 0) return source.slice(start, index + 1);
        }
        return '';
    }

    function parseStringSet(source, constantName) {
        const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`));
        const values = new Set();
        if (!match) return values;
        const strings = match[1].matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g);
        for (const item of strings) values.add(item[2].replace(/\\(['"\\])/g, '$1'));
        return values;
    }

    function parseAliases(source) {
        const aliases = new Map();
        const match = source.match(/const\s+MOB_ANIM_ALIAS\s*=\s*\{([\s\S]*?)\}/);
        if (!match) return aliases;
        for (const item of match[1].matchAll(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g)) aliases.set(item[1], item[2]);
        return aliases;
    }

    function buildSourceEvidence(dataSource, renderSource) {
        const normalizedDataSource = String(dataSource || '');
        const mobsAt = normalizedDataSource.indexOf('mobs:');
        const mobsObjectAt = mobsAt < 0 ? -1 : normalizedDataSource.indexOf('{', mobsAt);
        const itemsAt = normalizedDataSource.indexOf('items:');
        const itemsObjectAt = itemsAt < 0 ? -1 : normalizedDataSource.indexOf('{', itemsAt);
        sourceEntryCache.clear();
        sourceEvidence = {
            data: normalizedDataSource,
            mobsBlock: extractBalancedObject(normalizedDataSource, mobsObjectAt),
            itemsBlock: extractBalancedObject(normalizedDataSource, itemsObjectAt),
            animated: parseStringSet(String(renderSource || ''), 'MOB_ANIM_NAMES'),
            eightDirection: parseStringSet(String(renderSource || ''), 'MOB_ANIM_8DIR'),
            aliases: parseAliases(String(renderSource || ''))
        };
        return sourceEvidence;
    }

    function keyedSourceEntry(block, entityId) {
        if (!entityId || !block) return '';
        const regex = new RegExp(`(?:["']?${entityId}["']?)\\s*:\\s*(?=\\{)`);
        const match = regex.exec(block);
        if (!match) return '';
        const start = block.indexOf('{', match.index + match[0].length - 1);
        return extractBalancedObject(block, start);
    }

    function serializeMobToJsString(mob) {
        if (!mob) return '';
        let parts = [];
        for (const [key, val] of Object.entries(mob)) {
            if (val && typeof val === 'object') {
                if (Array.isArray(val)) {
                    parts.push(`${key}: [${val.join(',')}]`);
                } else {
                    let subParts = [];
                    for (const [subKey, subVal] of Object.entries(val)) {
                        if (typeof subVal === 'string') {
                            subParts.push(`${subKey}: "${subVal}"`);
                        } else if (typeof subVal === 'boolean' || typeof subVal === 'number') {
                            subParts.push(`${subKey}: ${subVal}`);
                        }
                    }
                    parts.push(`${key}: { ${subParts.join(', ')} }`);
                }
            } else if (typeof val === 'string') {
                parts.push(`${key}: "${val}"`);
            } else if (typeof val === 'boolean' || typeof val === 'number') {
                parts.push(`${key}: ${val}`);
            }
        }
        return `{ ${parts.join(', ')} }`;
    }

    function sourceEntry(monsterId) {
        if (!monsterId) return '';
        if (sourceEntryCache.has(monsterId)) return sourceEntryCache.get(monsterId);
        let entry = '';
        if (sourceEvidence.mobsBlock) {
            entry = keyedSourceEntry(sourceEvidence.mobsBlock, monsterId);
        }
        if (!entry && global.DB && global.DB.mobs && global.DB.mobs[monsterId]) {
            entry = serializeMobToJsString(global.DB.mobs[monsterId]);
        }
        sourceEntryCache.set(monsterId, entry);
        return entry;
    }

    function stringProperty(source, property) {
        const match = source.match(new RegExp(`(?:^|[,\\s])${property}\\s*:\\s*["']([^"']+)["']`));
        return match ? match[1] : '';
    }

    function isBossMonster(record) {
        if (!record || !record.canonical) return false;
        return record.canonical.boss === true;
    }

    function propertyObject(source, property) {
        const match = new RegExp(`(?:^|[,\\s])${property}\\s*:`).exec(source);
        if (!match) return '';
        return extractBalancedObject(source, source.indexOf('{', match.index + match[0].length));
    }

    function numberProperty(source, property) {
        const match = source.match(new RegExp(`(?:^|[,\\s])${property}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
        return match ? Number(match[1]) : null;
    }

    function booleanProperty(source, property) {
        const match = source.match(new RegExp(`(?:^|[,\\s])${property}\\s*:\\s*(true|false)`));
        return match ? match[1] === 'true' : false;
    }

    function isBossExclusiveGear(itemId) {
        if (!itemId) return false;
        const id = itemId.toLowerCase();
        
        // 1. Check approved fixture / allowlist
        const BOSS_EXCLUSIVE_FIXTURE = new Set([
            'wpn_dk_flameblade', 'wpn_kurt_sword', 'wpn_baranka_claw', 
            'wpn_baranka_steelclaw', 'wpn_laia_wand', 'wpn_icequeen_wand', 
            'wpn_powerless_baphomet', 'wpn_powerless_baless', 'wpn_chaos_thorn',
            'hlm_baranka', 'clk_baranka', 'rng_baranka'
        ]);
        if (BOSS_EXCLUSIVE_FIXTURE.has(id)) return true;

        // 2. Query formal EquipmentWikiData relations
        if (global.EquipmentWikiData) {
            const eq = global.EquipmentWikiData.getEquipmentById(itemId);
            if (eq && Array.isArray(eq.relations)) {
                // Prefer formal boss_drop relation
                const hasBossDropRel = eq.relations.some(r => r.relationType === 'boss_drop');
                if (hasBossDropRel) return true;
                
                // Fall back to monster_drop checks
                const dropRelations = eq.relations.filter(r => r.relationType === 'monster_drop');
                if (dropRelations.length > 0) {
                    return dropRelations.some(r => {
                        if (r.target && r.target.entityType === 'monster') {
                            const monster = global.MonsterWikiData ? global.MonsterWikiData.getMonsterById(r.target.entityId) : null;
                            return monster && monster.boss === true;
                        }
                        return false;
                    });
                }
            }
        }
        return false;
    }

    let recipeIngredients = null;
    function getRecipeIngredients() {
        if (recipeIngredients) return recipeIngredients;
        const set = new Set();
        const recipes = (global.CraftWikiData && global.CraftWikiData.isReady())
            ? (global.CraftWikiData.getAllRecipes() || [])
            : craftRecipes;
        recipes.forEach(r => {
            if (Array.isArray(r.requirements)) {
                r.requirements.forEach(req => {
                    if (req.itemId) set.add(req.itemId);
                });
            }
        });
        recipeIngredients = set;
        return set;
    }

    function getDropPriorityScore(item) {
        const itemId = item.itemId || item.id || '';
        if (!itemId) return 10;
        if (itemId.startsWith('relic_') || item.isRelic === true) return 1;
        let isLegendary = item.isLegendary === true;
        if (!isLegendary && itemId) {
            const staticList = global.EQUIP_DATA || EQUIP_DATA || [];
            const staticItem = staticList.find(i => i.id === itemId);
            if (staticItem && staticItem.rarity === 'legendary') {
                isLegendary = true;
            }
        }
        if (!isLegendary && ['wpn_dk_flameblade', 'hlm_baranka', 'acc_jenis_ring'].includes(itemId)) {
            isLegendary = true;
        }
        if (isLegendary) return 2;
        const type = item.type || '';
        const id = itemId.toLowerCase();
        if (type === 'wpn' || id.startsWith('wpn_')) return 3;
        if (type === 'arm' || id.startsWith('arm_') || id.startsWith('amr_') || id.startsWith('hlm_') || id.startsWith('glv_') || id.startsWith('bot_') || id.startsWith('shd_') || id.startsWith('clk_') || id.startsWith('tsh_') || id.startsWith('grv_')) return 4;
        if (type === 'acc' || id.startsWith('acc_') || id.startsWith('amu_') || id.startsWith('blt_') || id.startsWith('rng_')) return 5;
        if (type === 'bk' || id.startsWith('bk_') || id.startsWith('mem_')) return 6;
        if (type === 'mat' || id.startsWith('mat_')) {
            if (id.startsWith('mat_')) return 7;
            return 8;
        }
        if (type === 'use' || id.startsWith('scroll_') || id.startsWith('potion_') || id.startsWith('panacea_') || id.includes('feed') || id.includes('carrot') || id.includes('key') || id.includes('diary')) {
            return 9;
        }
        if (type === 'item' || id.startsWith('item_')) {
            return 8;
        }
        return 10;
    }

    function sortDropsForDisplay(drops) {
        if (!Array.isArray(drops)) return [];
        return drops.slice().sort((a, b) => {
            const itemA = itemSource(a.itemId, a.name);
            const itemB = itemSource(b.itemId, b.name);
            const scoreA = getDropPriorityScore(itemA);
            const scoreB = getDropPriorityScore(itemB);
            if (scoreA !== scoreB) return scoreA - scoreB;
            const idA = itemA.itemId || '';
            const idB = itemB.itemId || '';
            if (idA !== idB) return idA.localeCompare(idB);
            return (a.name || '').localeCompare(b.name || '');
        });
    }

    function itemSourceEntry(itemId) {
        if (!itemId) return '';
        let entry = '';
        if (sourceEvidence.itemsBlock) {
            entry = keyedSourceEntry(sourceEvidence.itemsBlock, itemId);
        }
        if (!entry && global.DB && global.DB.items && global.DB.items[itemId]) {
            entry = serializeMobToJsString(global.DB.items[itemId]);
        }
        return entry;
    }

    function itemSource(itemId, fallbackName) {
        let resolvedId = itemId;
        if (!resolvedId && fallbackName && global.DB && global.DB.items) {
            for (const [id, item] of Object.entries(global.DB.items)) {
                if (item.n === fallbackName) {
                    resolvedId = id;
                    break;
                }
            }
        }
        
        // Helper to query global getIconUrl
        function resolveIconPath(name, type, explicitImg) {
            const getIcon = global.getIconUrl || (typeof getIconUrl === 'function' ? getIconUrl : null);
            if (getIcon) {
                return getIcon({ n: name, type: type, img: explicitImg });
            }
            if (explicitImg) return explicitImg;
            if (type === 'wpn') return `assets/icons/weapons/${name}.png`;
            if (type === 'arm') return `assets/icons/armors/${name}.png`;
            if (type === 'acc') return `assets/icons/accessories/${name}.png`;
            return `assets/icons/items/${name}.png`;
        }

        const staticList = global.EQUIP_DATA || EQUIP_DATA || [];
        const staticItem = staticList.find(i => i.id === resolvedId);

        // 1. Try to query official EquipmentWikiData
        if (resolvedId && global.EquipmentWikiData && typeof global.EquipmentWikiData.getEquipmentById === 'function') {
            const eq = global.EquipmentWikiData.getEquipmentById(resolvedId);
            if (eq) {
                const name = eq.displayName || fallbackName || resolvedId;
                const group = String(eq.equipmentGroup || '').toLowerCase();
                const type = group === 'weapon' ? 'wpn' : (group === 'armor' ? 'arm' : 'acc');
                const isRelic = resolvedId.startsWith('relic_') || eq.relic === true;
                const isLegendary = eq.rarity === 'legendary' || (staticItem && staticItem.rarity === 'legendary');
                const imagePath = resolveIconPath(name, type, eq.imagePath);
                return {
                    itemId: resolvedId,
                    entry: null,
                    name,
                    type,
                    imagePath,
                    safe: eq.safeEnhance && eq.safeEnhance.safeLevel,
                    price: eq.price && eq.price.amount,
                    weight: null,
                    description: eq.description && eq.description.canonicalText,
                    isRelic,
                    isLegendary
                };
            }
        }

        // 2. Try to query official CraftWikiData / craftItems
        if (resolvedId) {
            const ci = craftItemById(resolvedId);
            if (ci) {
                const name = ci.name || fallbackName || resolvedId;
                const type = ci.type || '';
                const imagePath = resolveIconPath(name, type, ci.imagePath || ci.img);
                const isLegendary = ci.rarity === 'legendary' || ci.legend === true || (staticItem && staticItem.rarity === 'legendary');
                return {
                    itemId: resolvedId,
                    entry: null,
                    name,
                    type,
                    imagePath,
                    safe: null,
                    price: ci.price,
                    weight: null,
                    description: ci.description || ci.d,
                    isRelic: resolvedId.startsWith('relic_'),
                    isLegendary
                };
            }
        }

        // 3. Fallback to itemsBlock from js/00-data.js (for un-migrated items)
        const entry = itemSourceEntry(resolvedId);
        if (entry) {
            const name = stringProperty(entry, 'n') || fallbackName || resolvedId || EMPTY;
            const type = stringProperty(entry, 'type');
            const explicitImg = stringProperty(entry, 'img');
            const isRelic = resolvedId.startsWith('relic_') || booleanProperty(entry, 'relic');
            const isLegendary = stringProperty(entry, 'rarity') === 'legendary' || booleanProperty(entry, 'legend') || (staticItem && staticItem.rarity === 'legendary');
            const imagePath = resolveIconPath(name, type, explicitImg);
            return {
                itemId: resolvedId,
                entry,
                name,
                type,
                imagePath,
                safe: numberProperty(entry, 'safe'),
                price: numberProperty(entry, 'p'),
                weight: numberProperty(entry, 'w'),
                description: stringProperty(entry, 'd'),
                isRelic,
                isLegendary
            };
        }

        // 4. Unresolved item -> No guessing of path
        return {
            itemId: resolvedId,
            entry: null,
            name: fallbackName || resolvedId || EMPTY,
            type: '',
            imagePath: '',
            safe: null,
            price: null,
            weight: null,
            description: '',
            isRelic: resolvedId ? resolvedId.startsWith('relic_') : false,
            isLegendary: (staticItem && staticItem.rarity === 'legendary') || false
        };
    }

    const SLOT_MAP = Object.freeze({
        weapon: '武器', arrow: '箭矢', armor: '盔甲', helmet: '頭盔', cloak: '斗篷', gloves: '手套', boots: '靴子',
        tshirt: 'T恤', greaves: '脛甲', shield: '盾牌', necklace: '項鍊', earring: '耳環', belt: '皮帶',
        ring: '戒指', pet_weapon: '寵物武器', pet_armor: '寵物防具'
    });
    const TYPE_MAP = Object.freeze({
        one_hand_sword: '單手劍', two_hand_sword: '雙手劍', dagger: '短劍／匕首', blunt: '單手鈍器',
        two_hand_blunt: '雙手鈍器', spear: '單手矛', two_hand_spear: '長矛', bow: '弓', crossbow: '十字弓',
        staff: '魔杖', claw: '鋼爪', dual_blade: '雙刀', chain_sword: '鎖鏈劍', kiringku: '奇古獸',
        other_weapon: '其他武器', armor: '盔甲', helmet: '頭盔', cloak: '斗篷', gloves: '手套', boots: '靴子',
        tshirt: 'T恤', greaves: '脛甲', shield: '盾牌', necklace: '項鍊', earring: '耳環', belt: '皮帶', ring: '戒指'
    });

    function formatElementText(elementVal) {
        if (!elementVal) return '無';
        const el = String(elementVal).trim().toLowerCase();
        if (el === 'none') return '無';
        if (el === 'fire') return '火';
        if (el === 'water') return '水';
        if (el === 'earth') return '地';
        if (el === 'wind') return '風';
        if (el === '無' || el.includes('無')) return '無';
        if (el === '火' || el.includes('火')) return '火';
        if (el === '水' || el.includes('水')) return '水';
        if (el === '地' || el.includes('地')) return '地';
        if (el === '風' || el.includes('風')) return '風';
        return '資料尚未建立';
    }

    function parseDiceFormula(formula) {
        if (!formula) return '資料尚未建立';
        const str = String(formula).trim().replace(/\s+/g, '');
        const regex = /^(\d+)[dD](\d+)(?:([+-])(\d+))?$/;
        const match = str.match(regex);
        if (!match) return formula;
        const n = parseInt(match[1], 10);
        const d = parseInt(match[2], 10);
        const sign = match[3];
        const bVal = match[4] ? parseInt(match[4], 10) : 0;
        if (isNaN(n) || isNaN(d)) return formula;
        const b = sign === '-' ? -bVal : bVal;
        const min = n + b;
        const max = (n * d) + b;
        return `${min}～${max}`;
    }

    function formatCategory(item) {
        if (!item) return '其他';
        let slotCn = '';
        const itemId = item.itemId;
        const staticList = global.EQUIP_DATA || EQUIP_DATA || [];
        if (itemId) {
            const staticItem = staticList.find(i => i.id === itemId);
            if (staticItem && staticItem.slot_cn) {
                slotCn = staticItem.slot_cn;
            }
        }
        if (slotCn) {
            if (slotCn.startsWith("武器 (")) {
                const m = slotCn.match(/武器 \(([^・\)]+)/);
                if (m) return m[1];
                return "武器";
            }
            if (slotCn === "盾牌/副手") return "盾牌";
            if (slotCn === "內衣 (T恤)") return "T恤";
            if (slotCn === "技能秘笈") return "技能書";
            if (slotCn === "doll") return "魔法娃娃";
            return slotCn;
        }
        if (itemId && global.EquipmentWikiData && typeof global.EquipmentWikiData.getEquipmentById === 'function') {
            const eq = global.EquipmentWikiData.getEquipmentById(itemId);
            if (eq) {
                if (eq.equipmentType && TYPE_MAP[eq.equipmentType]) return TYPE_MAP[eq.equipmentType];
                if (eq.slot && SLOT_MAP[eq.slot]) return SLOT_MAP[eq.slot];
                if (eq.equipmentGroup && GROUP_LABELS[eq.equipmentGroup]) return GROUP_LABELS[eq.equipmentGroup];
            }
        }
        const type = String(item.type || '').toLowerCase();
        if (type === 'wpn' || type === 'weapon') return '武器';
        if (type === 'arm' || type === 'armor') return '防具';
        if (type === 'acc' || type === 'accessory') return '飾品';
        if (type === 'bk' || type === 'skillbk') return '技能書';
        if (type === 'mat') return '材料';
        if (type === 'use') return '消耗品';
        return '其他';
    }

    function checkIsEquipment(itemId, item, craftItem) {
        if (craftItem && craftItem.entityRef && craftItem.entityRef.entityType === 'equipment') {
            return true;
        }
        if (itemId && global.EquipmentWikiData && typeof global.EquipmentWikiData.getEquipmentById === 'function') {
            const eq = global.EquipmentWikiData.getEquipmentById(itemId);
            if (eq) return true;
        }
        const type = (item && item.type || '').toLowerCase();
        if (['wpn', 'arm', 'acc'].includes(type)) {
            return true;
        }
        if (itemId) {
            const staticList = global.EQUIP_DATA || EQUIP_DATA || [];
            const staticItem = staticList.find(i => i.id === itemId);
            if (staticItem) return true;
        }
        return false;
    }

    function resolveMonsterImage(monsterId, fallbackName) {
        const entry = sourceEntry(monsterId);
        let assetKey = stringProperty(entry, 'n');
        let explicit = stringProperty(entry, 'img');
        
        if (!entry && monsterId === 'sanct_giltas') {
            assetKey = '吉爾塔斯';
        } else if (!entry && fallbackName) {
            assetKey = fallbackName;
        } else if (!entry && global.MonsterWikiData) {
            const canonical = global.MonsterWikiData.getMonsterById(monsterId);
            if (canonical) {
                assetKey = canonical.displayName;
            }
        }
        
        if (!assetKey) return null;
        
        const folder = sourceEvidence.aliases.get(assetKey) || assetKey;
        const encoded = encodeURIComponent(folder);
        const candidates = [];
        if (sourceEvidence.animated.has(assetKey)) {
            const direction = sourceEvidence.eightDirection.has(assetKey) ? 'd6/' : '';
            candidates.push(`${UPSTREAM_BASE}assets/anim/${encoded}/${direction}idle_0.png`);
        }
        candidates.push(new URL(explicit || `assets/icons/monsters/${encodeURIComponent(assetKey)}.png`, UPSTREAM_BASE).href);
        return { monsterId, assetKey, candidates: Array.from(new Set(candidates)), evidence: 'Code' };
    }

    function featureSummary(magic) {
        const type = stringProperty(magic, 'type');
        if (/vamp(?:Full)?\s*:\s*true/.test(magic)) return '攻擊並吸取生命；詳細機制尚未整理';
        if (type === 'poison') return '施加中毒狀態；詳細機制尚未整理';
        if (type === 'silence') return '施加沉默狀態；詳細機制尚未整理';
        if (type === 'reflectwall') return '建立反射防禦機制；詳細機制尚未整理';
        return '特殊攻擊技能；詳細機制尚未整理';
    }

    function monsterFeatures(monsterId) {
        const entry = sourceEntry(monsterId);
        if (!entry) return [];
        const features = [];
        if (/\bhard\s*:\s*true/.test(entry)) features.push({ name: '硬皮', type: '防禦', summary: '承受物理攻擊時套用硬皮減傷機制', evidence: 'Code' });
        if (/\brageHpPct\s*:/.test(entry)) features.push({ name: '狂暴', type: '觸發', summary: '生命降低至程式設定門檻後強化戰鬥能力', evidence: 'Code' });
        if (/\bregenHp\s*:/.test(entry)) features.push({ name: '生命回復', type: '被動', summary: '戰鬥中依程式週期回復生命', evidence: 'Code' });
        ['mag', 'mag2', 'mag3', 'mag4'].forEach(property => {
            const magic = propertyObject(entry, property);
            const name = stringProperty(magic, 'skn');
            if (name) features.push({ name, type: stringProperty(magic, 'type') === 'reflectwall' ? '防禦' : '技能', summary: featureSummary(magic), evidence: 'Code' });
        });
        return features;
    }

    function featureLines(monsterId) {
        const features = monsterFeatures(monsterId);
        return features.length ? features.map(feature => `${feature.name}｜${feature.type}｜${feature.summary}（${feature.evidence}）`) : ['無'];
    }

    function createMonsterImage(monsterId, name, className) {
        const host = element('div', `${className || ''} world-atlas-monster-image`.trim());
        const placeholder = element('span', 'world-atlas-image-fallback', '無圖片');
        const descriptor = resolveMonsterImage(monsterId, name); // resolveMonsterImage(monsterId)
        if (!descriptor || !descriptor.candidates.length) {
            host.appendChild(placeholder);
            host.dataset.imageState = 'missing';
            return host;
        }
        const image = element('img');
        image.alt = `${name} 正面圖`;
        image.loading = 'lazy';
        image.dataset.monsterId = monsterId || '';
        image.dataset.assetKey = descriptor.assetKey;
        image.dataset.candidates = descriptor.candidates.slice(1).join('|');
        image.src = descriptor.candidates[0];
        if (monsterId && VISUAL_OFFSETS[monsterId]) {
            image.style.transform = VISUAL_OFFSETS[monsterId];
        }
        image.addEventListener('load', () => { host.dataset.imageState = 'ready'; });
        image.addEventListener('error', () => {
            const remaining = image.dataset.candidates.split('|').filter(Boolean);
            if (remaining.length) {
                image.dataset.candidates = remaining.slice(1).join('|');
                image.src = remaining[0];
                return;
            }
            image.remove();
            placeholder.hidden = false;
            host.dataset.imageState = 'missing';
        });
        placeholder.hidden = true;
        host.append(image, placeholder);
        return host;
    }

    function createItemImage(itemId, name, className) {
        const host = element('span', `${className || ''} world-atlas-item-image`.trim());
        const placeholder = element('span', 'world-atlas-image-fallback', '無圖片');
        const item = itemSource(itemId, name);
        if (item.isRelic) {
            host.classList.add('is-relic');
        } else if (item.isLegendary) {
            host.classList.add('is-legendary');
        } else {
            host.classList.add('is-general');
        }
        if (!item.name || !item.imagePath) {
            host.dataset.imageState = 'missing';
            host.appendChild(placeholder);
            return host;
        }
        const image = element('img');
        image.alt = `${item.name} 圖示`;
        image.loading = 'lazy';
        image.dataset.itemId = itemId || '';
        image.src = new URL(item.imagePath, UPSTREAM_BASE).href;
        image.addEventListener('load', () => { host.dataset.imageState = 'ready'; });
        image.addEventListener('error', () => {
            image.remove();
            placeholder.hidden = false;
            host.dataset.imageState = 'missing';
        });
        placeholder.hidden = true;
        host.append(image, placeholder);
        return host;
    }

    function display(value) {
        return value == null || value === '' ? EMPTY : String(value);
    }

    function appendMeta(host, label, value) {
        const row = element('div', 'recipe-meta');
        row.appendChild(element('strong', '', `${label}：`));
        row.appendChild(document.createTextNode(display(value)));
        host.appendChild(row);
    }

    function detailFor(record) {
        if (!record || !record.canonical || !global.MonsterWikiData) return null;
        const id = record.canonical.monsterId;
        if (!detailCache.has(id)) detailCache.set(id, global.MonsterWikiData.getMonsterDetail(id));
        return detailCache.get(id);
    }

    function recordKey(record) {
        return record.canonical ? `id:${record.canonical.monsterId}` : `legacy:${record.legacy && record.legacy.name}`;
    }

    function uniqueRecords(records) {
        const seen = new Set();
        return records.filter(record => {
            const key = recordKey(record);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function allRegionRecords() {
        return model ? model.regions.flatMap(region => region.monsters.map(record => ({ ...record, region }))) : [];
    }

    function currentRegion() {
        if (!model || !model.regions.length) return null;
        return model.regions.find(region => region.key === selectedRegionKey) || model.regions[0];
    }

    function recordFromCanonical(monster) {
        const existing = allRegionRecords().find(record => record.canonical && record.canonical.monsterId === monster.monsterId);
        return existing || { legacy: null, canonical: monster, region: null };
    }

    function mapsFor(record) {
        const names = record.legacy && Array.isArray(record.legacy.maps) ? record.legacy.maps.slice() : [];
        const detail = detailFor(record);
        if (detail) names.push(...detail.maps.map(map => map.displayName || map.mapId));
        return Array.from(new Set(names));
    }

    function dropsFor(record) {
        const detail = detailFor(record);
        if (detail) return detail.drops.map(drop => {
            const itemId = drop.item.itemId;
            const name = drop.item.displayName || (craftItemById(itemId) || {}).name || drop.item.itemId;
            return {
                itemId,
                name,
                rate: global.MonsterWikiView ? global.MonsterWikiView.formatProbability(drop.entry.probability) : EMPTY,
                quantity: drop.entry.quantity,
                status: drop.entry.status
            };
        });
        return record.legacy && Array.isArray(record.legacy.drops)
            ? record.legacy.drops.map(drop => {
                return { ...drop, itemId: null, status: 'unresolved' };
              })
            : [];
    }

    function searchableText(record) {
        const monster = record.canonical || {};
        const legacy = record.legacy || {};
        return normalize([
            monster.monsterId,
            monster.displayName,
            legacy.name,
            record.region && record.region.name,
            ...mapsFor(record),
            ...dropsFor(record).map(drop => drop.name)
        ].join(' '));
    }

    function globalSearch(value) {
        const q = normalize(value);
        if (!q) return [];
        const matches = allRegionRecords().filter(record => searchableText(record).includes(q));
        (global.MonsterWikiData.searchMonsters(value) || []).forEach(monster => matches.push(recordFromCanonical(monster)));
        (global.MonsterWikiData.searchDrops(value) || []).forEach(result => {
            result.monsters.forEach(monster => {
                const canonical = global.MonsterWikiData.getMonsterById(monster.monsterId);
                if (canonical) matches.push(recordFromCanonical(canonical));
            });
        });
        return uniqueRecords(matches);
    }

    function regionMapEvidence(region) {
        const verified = Array.from(new Set((region ? region.monsters : []).flatMap(record =>
            record.legacy && Array.isArray(record.legacy.maps) ? record.legacy.maps : [])));
        
        // Deterministic natural stable sorting for floor-based maps
        const originalIndex = new Map();
        verified.forEach((m, idx) => {
            const match = m.match(/^(.*?)(\d+)(樓|F)$/);
            const prefix = match ? match[1] : m;
            if (!originalIndex.has(prefix)) {
                originalIndex.set(prefix, idx);
            }
        });

        verified.sort((a, b) => {
            const matchA = a.match(/^(.*?)(\d+)(樓|F)$/);
            const matchB = b.match(/^(.*?)(\d+)(樓|F)$/);
            const prefixA = matchA ? matchA[1] : a;
            const prefixB = matchB ? matchB[1] : b;

            if (prefixA !== prefixB) {
                return originalIndex.get(prefixA) - originalIndex.get(prefixB);
            }

            const floorA = matchA ? parseInt(matchA[2], 10) : 0;
            const floorB = matchB ? parseInt(matchB[2], 10) : 0;
            return floorA - floorB;
        });

        const datasetOnly = Array.from(new Set((region ? region.monsters : []).flatMap(record => mapsFor(record))))
            .filter(map => !verified.includes(map));
        if (region) {
            previewDiagnostics.unresolvedRegionMaps = previewDiagnostics.unresolvedRegionMaps.filter(item => item.regionKey !== region.key);
            datasetOnly.forEach(map => previewDiagnostics.unresolvedRegionMaps.push({ regionKey: region.key, map, reason: 'shared-monster-mapRef' }));
        }
        return verified;
    }

    function regionMaps(region) {
        return regionMapEvidence(region);
    }

    function regionRecordMaps(record, region) {
        const verified = new Set(regionMapEvidence(region));
        return (record.legacy && Array.isArray(record.legacy.maps) ? record.legacy.maps : []).filter(map => verified.has(map));
    }

    function visibleRecords() {
        if (query) {
            const records = globalSearch(query);
            return selectedMap ? records.filter(record => mapsFor(record).includes(selectedMap)) : records;
        }
        const region = currentRegion();
        const records = region ? region.monsters.map(record => ({ ...record, region })) : [];
        return uniqueRecords(records.filter(record => !selectedMap || regionRecordMaps(record, region).includes(selectedMap)));
    }

    function formatAttack(monster) {
        const stats = monster && monster.stats ? monster.stats : {};
        if (!Array.isArray(stats.damageDice) || stats.damageDice.length < 2) return EMPTY;
        const n = stats.damageDice[0];
        const d = stats.damageDice[1];
        const b = stats.damageBonus || 0;
        const bonusStr = b ? (b > 0 ? `+${b}` : `${b}`) : '';
        const formula = `${n}D${d}${bonusStr}`;
        return parseDiceFormula(formula);
    }

    function formatGold(monster) {
        const stats = monster && monster.stats ? monster.stats : {};
        if (stats.goldMin == null || stats.goldMax == null) return EMPTY;
        return `${stats.goldMin}–${stats.goldMax}`;
    }

    function createDetails(title, lines) {
        const details = element('details');
        details.appendChild(element('summary', '', `▼ ${title}`));
        if (!lines.length) details.appendChild(element('p', '', EMPTY));
        else {
            const list = element('ul');
            lines.forEach(line => list.appendChild(element('li', '', line)));
            details.appendChild(list);
        }
        return details;
    }

    function cardStat(label, value) {
        return element('span', '', `${label} ${display(value)}`.trim());
    }

    function createMonsterCard(record) {
        const monster = record.canonical || {};
        const legacy = record.legacy || {};
        const name = monster.displayName || legacy.name || EMPTY;
        const stats = monster.stats || {};
        const isBoss = isBossMonster(record);
        const card = element('article', `world-atlas-monster-card${isBoss ? ' is-boss' : ''}`);
        card.dataset.monsterKey = recordKey(record);
        const head = element('div', 'world-atlas-card-head');
        const imageButton = element('button', 'world-atlas-image-button');
        imageButton.type = 'button';
        imageButton.dataset.worldAction = 'monster';
        imageButton.dataset.monsterKey = recordKey(record);
        imageButton.setAttribute('aria-label', `查看 ${name}`);
        const monsterId = monster.monsterId || null;
        imageButton.appendChild(createMonsterImage(monsterId, name, 'world-atlas-monster-icon')); // createMonsterImage(monster.monsterId
        const identity = element('div');
        const open = element('button', 'world-atlas-card-name', name);
        open.type = 'button';
        open.dataset.worldAction = 'monster';
        open.dataset.monsterKey = recordKey(record);
        identity.appendChild(open);
        const line = element('div', 'world-atlas-card-labels');
        line.appendChild(element('span', 'recipe-meta', `Lv ${display(monster.level != null ? monster.level : legacy.lv)}`));
        identity.appendChild(line);
        head.append(imageButton, identity);
        card.appendChild(head);

        function formatElementEmoji(elementVal) {
            const txt = formatElementText(elementVal);
            if (txt === '無') return '⚪ 無';
            if (txt === '火') return '🔥 火';
            if (txt === '水') return '💧 水';
            if (txt === '風') return '🌀 風';
            if (txt === '地') return '⛰️ 地';
            return `⚪ ${txt}`;
        }

        const row = element('div', 'world-atlas-card-stats');
        row.appendChild(cardStat('', formatElementEmoji(monster.element || legacy.ele)));
        row.appendChild(cardStat('❤️', monster.hp != null ? monster.hp : legacy.hp));
        row.appendChild(cardStat('🛡️', stats.ac != null ? stats.ac : legacy.ac));
        card.appendChild(row);

        // 特性 Tags
        const features = monsterFeatures(monsterId);
        const tagsContainer = element('div', 'world-atlas-card-features');
        if (features.length === 0) {
            tagsContainer.appendChild(element('span', 'world-atlas-feature-tag-none', '無特殊特性'));
        } else {
            features.forEach(feature => {
                const shortName = (feature.name === 'Boss 硬皮' || feature.name === '硬皮') ? '硬皮'
                                : feature.name === '生命回復' ? '回血'
                                : feature.name;
                tagsContainer.appendChild(element('span', 'world-atlas-feature-tag', `[${shortName}]`));
            });
        }
        card.appendChild(tagsContainer);

        // 決定性排序與最多 4 個掉落 Icon
        const sortedDrops = sortDropsForDisplay(dropsFor(record));
        const cardDrops = sortedDrops.slice(0, 4);

        const dropRow = element('div', 'world-atlas-card-drops');
        dropRow.appendChild(element('span', 'world-atlas-card-drops-label', '掉落：'));
        if (cardDrops.length === 0) {
            dropRow.appendChild(element('span', 'world-atlas-card-drops-none', '無'));
        } else {
            cardDrops.forEach(drop => {
                const btn = element('button', 'world-atlas-card-drop-btn');
                btn.type = 'button';
                btn.dataset.worldAction = 'item';
                btn.dataset.itemId = drop.itemId || '';
                btn.dataset.itemName = drop.name || '';
                btn.appendChild(createItemImage(drop.itemId, drop.name, 'world-atlas-card-drop-icon'));
                dropRow.appendChild(btn);
            });
        }
        card.appendChild(dropRow);

        return card;
    }

    function regionBonus(region) {
        if (!region || !region.stat || !Array.isArray(region.vals) || !region.vals.length) return EMPTY;
        return `${region.stat} ${region.vals.map(value => `+${value}`).join(' / ')}`;
    }

    function renderRegions() {
        const host = document.getElementById('world-atlas-region-list');
        const select = document.getElementById('world-atlas-region-select');
        if (!host || !select || !model) return;
        clear(host);
        clear(select);
        model.regions.forEach(region => {
            const button = element('button', `world-atlas-region-button${region.key === selectedRegionKey ? ' active' : ''}`);
            button.type = 'button';
            button.dataset.worldAction = 'region';
            button.dataset.regionKey = region.key;
            button.append(element('strong', '', region.name), element('span', '', regionBonus(region)));
            host.appendChild(button);
            const option = element('option', '', region.name);
            option.value = region.key;
            option.selected = region.key === selectedRegionKey;
            select.appendChild(option);
        });
    }

    function comparableLocation(value) {
        return normalize(value).replace(/周邊|地區|村莊|村/g, '');
    }

    function npcsForLocation(mapName, region) {
        const labels = (mapName ? [mapName] : [region && region.name]).filter(Boolean).map(comparableLocation);
        if (!labels.length) return [];
        return npcs.filter(npc => {
            const location = comparableLocation(npc.locationText);
            return location && labels.some(label => label && (location.includes(label) || label.includes(location)));
        });
    }

    function npcPurpose(npc) {
        const text = normalize(`${npc && npc.name} ${npc && npc.description}`);
        if (/倉庫/.test(text)) return '倉庫';
        if (/商店|商人|販售/.test(text)) return '商店';
        if (/試煉|任務/.test(text)) return '試煉';
        if (/製作|鍛造|熔煉|加工|編織|裁縫|工匠|鐵匠/.test(text)) return '製作';
        return '其他';
    }

    function npcRecipes(npc) {
        if (!npc) return [];
        if (global.CraftWikiData && global.CraftWikiData.isReady()) return global.CraftWikiData.getRecipesByNpcId(npc.id) || [];
        return craftRecipes.filter(recipe => recipe.npcId === npc.id);
    }

    function craftItemById(itemId) {
        if (global.CraftWikiData && global.CraftWikiData.isReady()) return global.CraftWikiData.getItemById(itemId);
        return craftItems.get(itemId) || null;
    }

    function createNpcCard(npc) {
        const card = element('article', 'world-atlas-npc-card');
        const open = element('button', 'world-atlas-card-name', npc.name || EMPTY);
        open.type = 'button';
        open.dataset.worldAction = 'npc';
        open.dataset.npcId = npc.id;
        card.append(open, element('span', 'world-atlas-npc-purpose', npcPurpose(npc)));
        card.appendChild(element('p', '', npc.description || EMPTY));
        appendMeta(card, '位置', npc.locationText);
        const recipes = npcRecipes(npc);
        if (recipes.length) appendMeta(card, '可製作項目', recipes.length);
        return card;
    }

    function recordsForMap(region, mapName) {
        if (!region) return [];
        if (!mapName) return region.monsters.map(record => ({ ...record, region }));
        return region.monsters
            .filter(record => (record.legacy && record.legacy.maps || []).includes(mapName))
            .map(record => ({ ...record, region }));
    }

    function appendEntityGroup(host, title, records, renderer) {
        if (!records.length) return;
        const section = element('section', 'world-atlas-entity-group');
        section.appendChild(element('h4', '', `${title}（${records.length}）`));
        const grid = element('div', title === 'NPC' ? 'world-atlas-npc-grid' : 'world-atlas-monster-grid');
        records.forEach(record => grid.appendChild(renderer(record)));
        section.appendChild(grid);
        host.appendChild(section);
    }

    function fillMapBody(host, region, mapName) {
        clear(host);
        const records = recordsForMap(region, mapName);
        const bosses = records.filter(record => isBossMonster(record));
        const normal = records.filter(record => !isBossMonster(record));
        const mapNpcs = npcsForLocation(mapName, region);
        appendEntityGroup(host, 'Boss', bosses, createMonsterCard);
        appendEntityGroup(host, '一般怪物', normal, createMonsterCard);
        appendEntityGroup(host, 'NPC', mapNpcs, createNpcCard);
        if (!records.length && !mapNpcs.length) host.appendChild(element('p', 'world-atlas-empty', '目前沒有可驗證的內容。'));
    }

    function mapDisplayName(mapName) {
        if (!mapName) return '全部';
        if (/[\u4e00-\u9fa5]/.test(mapName)) return mapName;
        if (monsterReady && global.MonsterWikiData) {
            const m = global.MonsterWikiData.getMap(mapName);
            if (m && m.displayName) return m.displayName;
        }
        if (!previewDiagnostics.missingMapLabels.includes(mapName)) {
            previewDiagnostics.missingMapLabels.push(mapName);
        }
        return '地圖名稱尚未建立';
    }

    function createMapAccordion(region, mapName, open) {
        const records = recordsForMap(region, mapName);
        const bosses = records.filter(record => isBossMonster(record)).length;
        const mapNpcs = npcsForLocation(mapName, region);
        const details = element('details', 'world-atlas-map-accordion');
        details.dataset.mapName = mapName;
        details.open = open;
        const summary = element('summary');
        summary.appendChild(element('strong', '', mapDisplayName(mapName)));
        summary.appendChild(element('span', 'world-atlas-map-counts', `怪物 ${records.length}｜Boss ${bosses}｜NPC ${mapNpcs.length}`));
        const body = element('div', 'world-atlas-map-body');
        details.append(summary, body);
        if (open) fillMapBody(body, region, mapName);
        details.addEventListener('toggle', () => {
            if (details.open) {
                if (!body.childNodes.length) fillMapBody(body, region, mapName);
                selectedMap = mapName;
                writeState('replace');
                Array.from(details.parentNode.querySelectorAll('details.world-atlas-map-accordion'))
                    .forEach(other => {
                        if (other !== details) other.open = false;
                    });
            } else {
                if (selectedMap === mapName) {
                    selectedMap = '';
                    writeState('replace');
                }
            }
        });
        return details;
    }

    function renderMain() {
        const region = currentRegion();
        const title = document.getElementById('world-atlas-current-title');
        const content = document.getElementById('world-atlas-content');
        const summary = document.getElementById('world-atlas-region-summary');
        if (!title || !content || !summary) return;
        title.textContent = region ? region.name : EMPTY;
        summary.textContent = region ? `${regionBonus(region)}｜已解析怪物 ${region.monsters.length}` : EMPTY;
        clear(content);
        if (global.MonsterWikiData && !global.MonsterWikiData.getState().ready) {
            const warning = element('div', 'world-atlas-warning-banner');
            warning.style.background = 'rgba(156, 163, 175, 0.1)';
            warning.style.border = '1px solid rgba(156, 163, 175, 0.3)';
            warning.style.borderRadius = '8px';
            warning.style.padding = '10px 14px';
            warning.style.marginBottom = '14px';
            warning.style.color = '#9ca3af';
            warning.style.fontSize = '0.85rem';
            warning.innerHTML = '目前使用本機檔案模式，請透過本機 HTTP 伺服器查看完整資料。';
            content.appendChild(warning);
        }
        if (query) {
            renderSearchResults(content, query);
            return;
        }
        const overview = createMapAccordion(region, '', false);
        content.appendChild(overview);
        regionMaps(region).forEach(mapName => {
            const isOpen = selectedMap && (selectedMap === mapName);
            content.appendChild(createMapAccordion(region, mapName, isOpen));
        });
    }

    function recordByKey(key) {
        const existing = allRegionRecords().find(record => recordKey(record) === key);
        if (existing) return existing;
        if (String(key).startsWith('id:')) {
            const monster = global.MonsterWikiData.getMonsterById(String(key).slice(3));
            return monster ? recordFromCanonical(monster) : null;
        }
        return null;
    }

    function renderMonsterModal(key) {
        const record = recordByKey(key);
        if (!record) return null;
        const monster = record.canonical || {};
        const legacy = record.legacy || {};
        const detail = detailFor(record);
        const stats = monster.stats || {};
        const isBoss = isBossMonster(record);
        const host = element('div', `world-atlas-monster-detail${isBoss ? ' is-boss' : ''}`);
        const head = element('div', 'world-atlas-detail-head');
        const monsterId = monster.monsterId || null;
        const icon = createMonsterImage(monsterId, monster.displayName || legacy.name || EMPTY, 'world-atlas-modal-image');
        const heading = element('div');
        heading.appendChild(element('h2', '', monster.displayName || legacy.name || EMPTY));
        head.append(icon, heading);
        host.appendChild(head);
        const abilities = element('div', 'world-atlas-modal-stats');
        [['Lv', monster.level != null ? monster.level : legacy.lv], ['種族', monster.race], ['屬性', formatElementText(monster.element || legacy.ele)],
            ['HP', monster.hp != null ? monster.hp : legacy.hp], ['攻擊', formatAttack(monster)], ['命中', stats.hit != null ? stats.hit : legacy.hit],
            ['AC', stats.ac != null ? stats.ac : legacy.ac], ['MR', stats.mr], ['EXP', stats.experience], ['Gold', formatGold(monster)]]
            .forEach(([label, value]) => abilities.appendChild(cardStat(label, value)));
        host.appendChild(abilities);
        host.appendChild(createDetails('特性', featureLines(monsterId)));
        host.appendChild(createDetails('出沒地圖', mapsFor(record).map(mapDisplayName)));
        host.appendChild(createDropDetails(record));
        host.appendChild(createDetails('技術資料', [
            monsterId && `Monster ID：${monsterId}`,
            mapsFor(record).length && `地圖 ID：${mapsFor(record).join(', ')}`,
            monster.verification && monster.verification.source && `來源：${monster.verification.source}`,
            detail && detail.monster.version && detail.monster.version.gameVersion && `版本：${detail.monster.version.gameVersion}`
        ].filter(Boolean)));
        return { title: monster.displayName || legacy.name || EMPTY, content: host, entityId: monsterId };
    }

    function dropQuantity(drop) {
        const quantity = drop && drop.quantity;
        if (!quantity || quantity.min == null || quantity.max == null) return '';
        return quantity.min === quantity.max ? `×${quantity.min}` : `×${quantity.min}–${quantity.max}`;
    }

    function createDropDetails(record) {
        const details = element('details', 'world-atlas-drop-details');
        details.appendChild(element('summary', '', '▼ 掉落'));
        const list = element('div', 'world-atlas-drop-list');
        const sortedDrops = sortDropsForDisplay(dropsFor(record));
        if (!sortedDrops.length) list.appendChild(element('p', '', '無'));
        sortedDrops.forEach(drop => {
            const row = element('button', 'world-atlas-drop-row');
            row.type = 'button';
            row.dataset.worldAction = 'item';
            row.dataset.itemId = drop.itemId || '';
            row.dataset.itemName = drop.name || '';
            row.appendChild(createItemImage(drop.itemId, drop.name, 'world-atlas-drop-icon'));
            const text = element('span', 'world-atlas-drop-name', drop.name || drop.itemId || EMPTY);
            row.appendChild(text);
            row.appendChild(element('span', 'world-atlas-drop-rate', `${display(drop.rate)} ${dropQuantity(drop)}`.trim()));
            if (drop.status && drop.status !== 'complete') row.appendChild(element('span', 'world-atlas-unresolved', 'unresolved'));
            list.appendChild(row);
        });
        details.appendChild(list);
        return details;
    }

    function renderNpcModal(npcId) {
        const npc = npcs.find(candidate => candidate.id === npcId);
        if (!npc) return null;
        const host = element('div', 'world-atlas-npc-detail');
        appendMeta(host, '用途', npcPurpose(npc));
        appendMeta(host, '位置', npc.locationText);
        host.appendChild(element('p', '', npc.description || EMPTY));
        const recipes = npcRecipes(npc);
        if (recipes.length) {
            const section = element('section', 'world-atlas-recipe-section');
            section.appendChild(element('h3', '', `可製作項目（${recipes.length}）`));
            const list = element('div', 'world-atlas-recipe-list');
            recipes.forEach(recipe => {
                const itemId = recipe.result && recipe.result.itemId;
                const item = craftItemById(itemId);
                const button = element('button', 'world-atlas-recipe-item');
                button.type = 'button';
                button.dataset.worldAction = 'item';
                button.dataset.itemId = itemId || '';
                button.dataset.itemName = item && item.name || itemId || EMPTY;
                button.append(createItemImage(itemId, item && item.name, 'world-atlas-drop-icon'),
                    element('span', '', item && item.name || itemId || EMPTY));
                list.appendChild(button);
            });
            section.appendChild(list);
            host.appendChild(section);
        } else {
            appendMeta(host, '可製作項目', npcPurpose(npc) === '製作' ? EMPTY : '無');
        }
        return { title: npc.name || EMPTY, content: host, entityId: npc.id };
    }

    function renderItemModal(itemId, fallbackName) {
        const source = itemSource(itemId, fallbackName);
        const craftItem = craftItemById(itemId);
        const host = element('div', 'world-atlas-item-detail');
        const head = element('div', 'world-atlas-detail-head');
        head.append(createItemImage(itemId, source.name, 'world-atlas-modal-item-image'), element('h2', '', source.name));
        host.appendChild(head);
        appendMeta(host, 'Item ID', itemId);
        appendMeta(host, '分類', formatCategory(source));
        if (source.safe != null) appendMeta(host, '安定值', `+${source.safe}`);
        if (source.price != null) appendMeta(host, '價格', source.price.toLocaleString());
        if (source.weight != null) appendMeta(host, '重量', source.weight);
        host.appendChild(element('p', '', source.description || craftItem && craftItem.description || '資料尚未建立'));
        const isEquipment = checkIsEquipment(itemId, source, craftItem);
        if (isEquipment && typeof global.openDetailModal === 'function') {
            const full = element('button', 'category-btn world-atlas-full-item', '查看完整資料');
            full.type = 'button';
            full.dataset.worldAction = 'equipment-detail';
            full.dataset.itemId = itemId;
            host.appendChild(full);
        }
        return { title: source.name, content: host, entityId: itemId };
    }

    function openEntityModal(rendered, trigger, options) {
        if (!rendered) return;
        const overlay = document.getElementById('world-atlas-modal-overlay');
        const modal = document.getElementById('world-atlas-modal');
        const title = document.getElementById('world-atlas-modal-title');
        const content = document.getElementById('world-atlas-modal-content');
        if (!overlay || !modal || !title || !content) return;
        modalTrigger = trigger || document.activeElement;
        title.textContent = rendered.title;
        clear(content);
        content.appendChild(rendered.content);
        overlay.hidden = false;
        modal.hidden = false;
        document.body.classList.add('world-atlas-modal-open');
        modal.querySelector('.world-atlas-modal-close').focus();
        if (!(options && options.skipHistory)) writeState('push', { monster: options && options.monsterId, npc: options && options.npcId, item: options && options.itemId });
    }

    function closeEntityModal(options) {
        const overlay = document.getElementById('world-atlas-modal-overlay');
        const modal = document.getElementById('world-atlas-modal');
        if (!overlay || !modal || modal.hidden) return;
        overlay.hidden = true;
        modal.hidden = true;
        document.body.classList.remove('world-atlas-modal-open');
        hideTooltip();
        if (!(options && options.skipHistory)) writeState('push', { clearEntity: true });
        if (modalTrigger && typeof modalTrigger.focus === 'function') modalTrigger.focus();
        modalTrigger = null;
    }

    function tooltipContent(itemId, fallbackName) {
        const source = itemSource(itemId, fallbackName);
        const host = element('div', 'world-atlas-tooltip-inner');
        host.append(createItemImage(itemId, source.name, 'world-atlas-tooltip-image'), element('strong', '', source.name));
        appendMeta(host, '分類', formatCategory(source));
        if (source.safe != null) appendMeta(host, '安定值', `+${source.safe}`);
        if (source.price != null) appendMeta(host, '價格', source.price.toLocaleString());
        if (source.weight != null) appendMeta(host, '重量', source.weight);
        host.appendChild(element('p', '', source.description || '資料未建立'));
        return host;
    }

    function showTooltip(target, event) {
        let itemId = target.dataset.itemId;
        const itemName = target.dataset.itemName;
        if (!itemId && itemName && global.DB && global.DB.items) {
            for (const [id, item] of Object.entries(global.DB.items)) {
                if (item.n === itemName) {
                    itemId = id;
                    break;
                }
            }
        }
        if (!itemId) return;
        const tooltip = document.getElementById('world-atlas-tooltip');
        if (!tooltip) return;
        tooltipItemId = itemId;
        clear(tooltip);
        tooltip.appendChild(tooltipContent(itemId, itemName));
        tooltip.hidden = false;
        const x = event && event.clientX || target.getBoundingClientRect().right;
        const y = event && event.clientY || target.getBoundingClientRect().top;
        const rect = tooltip.getBoundingClientRect();
        tooltip.style.left = `${Math.max(8, Math.min(x + 14, global.innerWidth - rect.width - 8))}px`;
        tooltip.style.top = `${Math.max(8, Math.min(y + 14, global.innerHeight - rect.height - 8))}px`;
    }

    function hideTooltip() {
        const tooltip = document.getElementById('world-atlas-tooltip');
        if (tooltip) tooltip.hidden = true;
        tooltipItemId = null;
    }

    function searchGroups(value) {
        const q = normalize(value);
        const regions = model.regions.filter(region => normalize(region.name).includes(q));
        const maps = [];
        model.regions.forEach(region => regionMaps(region).forEach(mapName => {
            if (normalize(mapName).includes(q)) maps.push({ region, mapName });
        }));
        const monsters = globalSearch(value).slice(0, 40);
        const npcResults = npcs.filter(npc => normalize(`${npc.name} ${npc.id}`).includes(q));
        const drops = monsterReady && global.MonsterWikiData ? global.MonsterWikiData.searchDrops(value) : [];
        return { regions, maps, monsters, npcs: npcResults, drops };
    }

    function renderSearchResults(host, value) {
        const groups = searchGroups(value);
        const definitions = [
            ['地區', groups.regions, entry => ({ label: entry.name, action: 'region', regionKey: entry.key })],
            ['地圖', groups.maps, entry => ({ label: entry.mapName, meta: entry.region.name, action: 'search-map', regionKey: entry.region.key, mapName: entry.mapName })],
            ['怪物', groups.monsters, entry => ({ label: entry.canonical && entry.canonical.displayName || entry.legacy && entry.legacy.name, meta: entry.canonical && entry.canonical.monsterId, action: 'monster', monsterKey: recordKey(entry) })],
            ['NPC', groups.npcs, entry => ({ label: entry.name || entry.id, meta: entry.locationText, action: 'npc', npcId: entry.id })],
            ['掉落物', groups.drops, entry => ({ label: entry.item.displayName || entry.item.itemId, meta: `${entry.monsters.length} 隻怪物`, action: 'drop-result', itemId: entry.item.itemId, itemName: entry.item.displayName || entry.item.itemId })]
        ];
        let count = 0;
        definitions.forEach(([title, entries, mapEntry]) => {
            if (!entries.length) return;
            count += entries.length;
            const section = element('section', 'world-atlas-search-group');
            section.appendChild(element('h3', '', `${title}（${entries.length}）`));
            const list = element('div', 'world-atlas-search-list');
            entries.slice(0, 40).forEach(entry => {
                const data = mapEntry(entry);
                const button = element('button', 'world-atlas-search-result');
                button.type = 'button';
                button.dataset.worldAction = data.action;
                Object.keys(data).filter(key => !['label', 'meta', 'action'].includes(key)).forEach(key => { button.dataset[key] = data[key] || ''; });
                button.append(element('strong', '', data.label || EMPTY), element('span', '', data.meta || ''));
                list.appendChild(button);
            });
            section.appendChild(list);
            host.appendChild(section);
        });
        if (!count) host.appendChild(element('p', 'world-atlas-empty', '找不到符合的地區、地圖、怪物、NPC 或掉落物。'));
    }

    function writeState(mode, entity) {
        const href = global.location.href || ((global.location.origin || 'https://wiki-domain') + '/wiki.html' + (global.location.search || ''));
        const url = new URL(href);
        url.searchParams.set('tab', 'world');
        url.searchParams.delete('worldPreview');
        if (selectedRegionKey) url.searchParams.set('worldRegion', selectedRegionKey);
        else url.searchParams.delete('worldRegion');
        if (selectedMap) url.searchParams.set('worldMap', selectedMap);
        else url.searchParams.delete('worldMap');
        if (query) url.searchParams.set('worldSearch', query);
        else url.searchParams.delete('worldSearch');
        if (entity && entity.clearEntity) ['monster', 'worldNpc', 'worldItem'].forEach(key => url.searchParams.delete(key));
        if (entity && entity.monster) url.searchParams.set('monster', entity.monster);
        if (entity && entity.npc) url.searchParams.set('worldNpc', entity.npc);
        if (entity && entity.item) url.searchParams.set('worldItem', entity.item);
        if (global.history && typeof global.history.pushState === 'function') {
            global.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', url.toString());
        }
    }

    function selectRegion(key, historyMode) {
        selectedRegionKey = key;
        selectedMap = '';
        query = '';
        const input = document.getElementById('world-atlas-search');
        if (input) input.value = '';
        renderRegions();
        renderMain();
        writeState(historyMode || 'push');
    }

    function handleClick(event) {
        const target = event.target.closest('[data-world-action]');
        if (!target) return;
        const action = target.dataset.worldAction;
        if (action === 'region') selectRegion(target.dataset.regionKey);
        if (action === 'search-map') {
            selectedRegionKey = target.dataset.regionKey;
            selectedMap = target.dataset.mapName;
            query = '';
            document.getElementById('world-atlas-search').value = '';
            renderRegions();
            renderMain();
            writeState('push');
        }
        if (action === 'monster') {
            const rendered = renderMonsterModal(target.dataset.monsterKey);
            openEntityModal(rendered, target, { monsterId: rendered && rendered.entityId });
        }
        if (action === 'npc') openEntityModal(renderNpcModal(target.dataset.npcId), target, { npcId: target.dataset.npcId });
        if (action === 'item') {
            let itemId = target.dataset.itemId;
            const itemName = target.dataset.itemName;
            if (!itemId && itemName && global.DB && global.DB.items) {
                for (const [id, item] of Object.entries(global.DB.items)) {
                    if (item.n === itemName) {
                        itemId = id;
                        break;
                    }
                }
            }
            const item = itemSource(itemId, itemName);
            const craftItem = craftItemById(itemId);
            const isEquipment = checkIsEquipment(itemId, item, craftItem);
            
            if (isEquipment && typeof global.openDetailModal === 'function') {
                global.openDetailModal(itemId, { updateHistory: false });
            } else {
                if (global.matchMedia && global.matchMedia('(hover: hover)').matches && tooltipItemId !== itemId) showTooltip(target, event);
                else openEntityModal(renderItemModal(itemId, itemName), target, { itemId: itemId });
            }
        }
        if (action === 'drop-result') {
            const result = monsterReady && global.MonsterWikiData.searchDrops(target.dataset.itemId)[0];
            clear(document.getElementById('world-atlas-content'));
            const host = document.getElementById('world-atlas-content');
            host.appendChild(element('h3', '', `掉落物：${target.dataset.itemName}`));
            appendEntityGroup(host, '怪物', result ? result.monsters.map(monster => recordFromCanonical(monster)) : [], createMonsterCard);
            showTooltip(target, event);
        }
        if (action === 'equipment-detail') {
            closeEntityModal({ skipHistory: true });
            global.openDetailModal(target.dataset.itemId, { updateHistory: false });
        }
        if (action === 'close-modal') closeEntityModal();
    }

    function handleInput(event) {
        if (event.target.id !== 'world-atlas-search') return;
        query = event.target.value.trim();
        selectedMap = '';
        renderMain();
        writeState('replace');
    }

    function handleChange(event) {
        if (event.target.id === 'world-atlas-region-select') selectRegion(event.target.value);
    }

    function createPane() {
        const pane = element('div', 'tab-pane');
        pane.id = 'tab-content-world';
        const shell = element('div', 'world-atlas-shell');
        const left = element('aside', 'world-atlas-regions');
        left.appendChild(element('h2', '', '地區'));
        const regionList = element('div', 'world-atlas-region-list');
        regionList.id = 'world-atlas-region-list';
        left.appendChild(regionList);

        const main = element('main', 'world-atlas-main');
        const header = element('div', 'world-atlas-header');
        const heading = element('div');
        heading.appendChild(element('h2', '', '世界百科'));
        heading.appendChild(element('p', '', '地區、地圖、怪物、掉落與 NPC'));
        const search = element('div', 'search-box world-atlas-search');
        const input = element('input');
        input.id = 'world-atlas-search';
        input.type = 'search';
        input.placeholder = '搜尋地區、地圖、怪物、NPC 或掉落物';
        search.appendChild(input);
        header.append(heading, search);
        main.appendChild(header);
        const mobileRegions = element('label', 'world-atlas-mobile-regions recipe-meta', '地區：');
        const regionSelect = element('select', 'sort-select');
        regionSelect.id = 'world-atlas-region-select';
        mobileRegions.appendChild(regionSelect);
        main.appendChild(mobileRegions);
        const currentTitle = element('h2');
        currentTitle.id = 'world-atlas-current-title';
        main.appendChild(currentTitle);
        const regionSummary = element('p', 'world-atlas-region-summary');
        regionSummary.id = 'world-atlas-region-summary';
        main.appendChild(regionSummary);
        const content = element('div');
        content.id = 'world-atlas-content';
        main.appendChild(content);

        shell.append(left, main);
        pane.appendChild(shell);
        document.body.insertBefore(pane, document.getElementById('drawer-overlay'));
        pane.addEventListener('click', handleClick);
        pane.addEventListener('input', handleInput);
        pane.addEventListener('change', handleChange);

        const overlay = element('div', 'world-atlas-modal-overlay');
        overlay.id = 'world-atlas-modal-overlay';
        overlay.hidden = true;
        overlay.dataset.worldAction = 'close-modal';
        const modal = element('section', 'world-atlas-modal');
        modal.id = 'world-atlas-modal';
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'world-atlas-modal-title');
        const modalHeader = element('header', 'world-atlas-modal-header');
        modalHeader.appendChild(element('h2', '', ''));
        modalHeader.firstChild.id = 'world-atlas-modal-title';
        const closeButton = element('button', 'world-atlas-modal-close', '×');
        closeButton.type = 'button';
        closeButton.dataset.worldAction = 'close-modal';
        closeButton.setAttribute('aria-label', '關閉');
        modalHeader.appendChild(closeButton);
        const modalContent = element('div', 'world-atlas-modal-content');
        modalContent.id = 'world-atlas-modal-content';
        modal.append(modalHeader, modalContent);
        document.body.append(overlay, modal);
        overlay.addEventListener('click', handleClick);
        modal.addEventListener('click', handleClick);

        const tooltip = element('div', 'world-atlas-tooltip');
        tooltip.id = 'world-atlas-tooltip';
        tooltip.hidden = true;
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
        [pane, modal].forEach(host => {
            host.addEventListener('pointerover', event => {
                const target = event.target.closest('[data-world-action="item"]');
                if (target && global.matchMedia && global.matchMedia('(hover: hover)').matches) showTooltip(target, event);
            });
            host.addEventListener('pointerout', event => {
                const target = event.target.closest('[data-world-action="item"]');
                if (target && !target.contains(event.relatedTarget)) hideTooltip();
            });
        });
        return pane;
    }

    async function loadNpcs() {
        try {
            const response = await fetch(NPC_PATH);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            return [];
        }
    }

    async function loadCraftFallback() {
        if (global.CraftWikiData && global.CraftWikiData.isReady()) return;
        try {
            const responses = await Promise.all([fetch(CRAFT_RECIPES_PATH), fetch(CRAFT_ITEMS_PATH)]);
            if (!responses.every(response => response.ok)) return;
            const documents = await Promise.all(responses.map(response => response.json()));
            craftRecipes = Array.isArray(documents[0]) ? documents[0] : [];
            craftItems = new Map((Array.isArray(documents[1]) ? documents[1] : []).map(item => [item.id, item]));
        } catch (error) {
            craftRecipes = [];
            craftItems = new Map();
        }
    }

    async function fetchText(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
        return response.text();
    }

    async function loadSourceEvidence() {
        try {
            const sources = await Promise.all([fetchText(UPSTREAM_DATA_PATH), fetchText(UPSTREAM_RENDER_PATH)]);
            return buildSourceEvidence(sources[0], sources[1]);
        } catch (error) {
            previewDiagnostics.sourceFallback = true;
            try {
                const sources = await Promise.all([fetchText('./js/00-data.js'), fetchText('./js/09-vfx-render.js')]);
                return buildSourceEvidence(sources[0], sources[1]);
            } catch (fallbackError) {
                return buildSourceEvidence('', '');
            }
        }
    }

    function buildRegionModel() {
        const regions = Array.isArray(global.MONSTER_MERGED_CARD_REGIONS) ? global.MONSTER_MERGED_CARD_REGIONS : [];
        let model;
        if (global.MonsterMergedPreview && typeof global.MonsterMergedPreview.buildPreviewModel === 'function') {
            model = global.MonsterMergedPreview.buildPreviewModel(regions, monsterReady ? global.MonsterWikiData : null);
        } else {
            model = {
                regions: regions.map(region => ({
                    key: region.key,
                    name: region.name,
                    stat: region.stat,
                    vals: Array.isArray(region.vals) ? region.vals.slice() : [],
                    monsters: (region.mobs || []).map(legacy => ({ legacy, canonical: null }))
                }))
            };
        }
        if (model && model.regions) {
            model.regions.forEach(region => {
                if (region.monsters) {
                    region.monsters.forEach(record => {
                        if (!record.canonical && record.legacy && global.DB && global.DB.mobs) {
                            for (const [id, mob] of Object.entries(global.DB.mobs)) {
                                if (mob.n === record.legacy.name) {
                                    record.canonical = {
                                        monsterId: id,
                                        displayName: mob.n,
                                        boss: mob.boss === true,
                                        level: mob.lv,
                                        hp: mob.hp,
                                        element: mob.e,
                                        stats: {
                                            ac: mob.ac,
                                            mr: mob.mr,
                                            experience: mob.exp,
                                            hit: mob.hit
                                        }
                                    };
                                    break;
                                }
                            }
                        }
                    });
                }
            });
        }
        return model;
    }

    function applyLegacyIntent(params) {
        const oldTab = params.get('tab');
        if (!params.get('worldRegion')) {
            const legacyRegion = params.get('monsterRegion') || params.get('region');
            if (legacyRegion && model.regions.some(region => region.key === legacyRegion)) selectedRegionKey = legacyRegion;
        }
        if (!query) query = params.get('monsterSearch') || (['craft', 'cards', 'monster'].includes(oldTab) ? params.get('search') || '' : '');
    }

    function restoreEntityFromUrl() {
        const params = new URLSearchParams(global.location.search);
        const monsterId = params.get('monster');
        const npcId = params.get('worldNpc');
        const itemId = params.get('worldItem');
        if (monsterId) {
            const rendered = renderMonsterModal(`id:${monsterId}`);
            if (rendered) openEntityModal(rendered, null, { skipHistory: true, monsterId });
            return;
        }
        if (npcId) {
            const rendered = renderNpcModal(npcId);
            if (rendered) openEntityModal(rendered, null, { skipHistory: true, npcId });
            return;
        }
        if (itemId) {
            openEntityModal(renderItemModal(itemId, itemId), null, { skipHistory: true, itemId });
            return;
        }
        closeEntityModal({ skipHistory: true });
    }

    function openMonsterModalById(monsterId, trigger) {
        const rendered = renderMonsterModal('id:' + monsterId);
        if (rendered) {
            openEntityModal(rendered, trigger, { monsterId });
        }
    }

    function restoreStateFromUrl() {
        if (!initialized) return;
        const params = new URLSearchParams(global.location.search);
        selectedRegionKey = params.get('worldRegion') || model.regions[0].key;
        selectedMap = params.get('worldMap') || '';
        query = params.get('worldSearch') || '';
        const input = document.getElementById('world-atlas-search');
        if (input) input.value = query;
        renderRegions();
        renderMain();
        restoreEntityFromUrl();
    }

    function showSafeError(message) {
        let pane = document.getElementById('tab-content-world');
        if (!pane) pane = createPane();
        const content = document.getElementById('world-atlas-content');
        if (content) {
            clear(content);
            content.appendChild(element('div', 'world-atlas-error', message || '世界百科暫時無法載入，請稍後再試。'));
        }
    }

    function routeLegacy(tabId, searchKeyword) {
        if (!initialized || !isEnabled() || !['equip', 'craft', 'cards', 'monster'].includes(tabId)) return false;
        if (searchKeyword) {
            query = String(searchKeyword).trim();
            document.getElementById('world-atlas-search').value = query;
            renderMain();
        }
        writeState('replace');
        return true;
    }

    async function init() {
        if (initialized) return true;
        if (!isEnabled()) return false;
        try {
            if (global.MonsterWikiData) {
                if (typeof global.MonsterWikiData.setItemLabelSource === 'function' && global.EQUIP_DATA) {
                    global.MonsterWikiData.setItemLabelSource(global.EQUIP_DATA);
                }
                await global.MonsterWikiData.load();
            }
            monsterReady = Boolean(global.MonsterWikiData && global.MonsterWikiData.getState().ready);
            model = buildRegionModel();
            if (!model.regions.length) return false;
            [npcs] = await Promise.all([loadNpcs(), loadSourceEvidence(), loadCraftFallback()]);
            const params = new URLSearchParams(global.location.search);
            selectedRegionKey = params.get('worldRegion') || model.regions[0].key;
            selectedMap = params.get('worldMap') || '';
            query = params.get('worldSearch') || '';
            applyLegacyIntent(params);
            createPane();
            const nav = element('button', 'nav-btn', '🗺️ 世界百科');
            nav.id = 'btn-tab-world';
            nav.type = 'button';
            nav.addEventListener('click', () => global.switchTab('world'));
            document.querySelector('.nav-header .nav-links').appendChild(nav);
            ['btn-tab-equip', 'btn-tab-craft', 'btn-tab-cards', 'btn-tab-monster'].forEach(id => {
                const button = document.getElementById(id);
                if (button) {
                    button.hidden = true;
                    button.style.setProperty('display', 'none', 'important');
                }
            });
            document.documentElement.dataset.worldAtlas = 'enabled';
            document.documentElement.dataset.worldAtlasMonsterReady = String(monsterReady);
            renderRegions();
            document.getElementById('world-atlas-search').value = query;
            renderMain();
            initialized = true;
            restoreEntityFromUrl();
            if (!historyBound) {
                historyBound = true;
                global.addEventListener('popstate', restoreStateFromUrl);
                global.addEventListener('keydown', event => {
                    if (event.key === 'Escape' && !document.getElementById('world-atlas-modal').hidden) closeEntityModal();
                });
            }
            return true;
        } catch (error) {
            previewDiagnostics.initializationError = String(error && error.message || error);
            showSafeError('世界百科暫時無法載入；裝備百科與舊版入口仍可使用。');
            return false;
        }
    }

    const api = Object.freeze({
        isEnabled,
        init,
        routeLegacy,
        closeEntityModal,
        openMonsterModalById,
        restoreStateFromUrl,
        formatCategory,
        parseDiceFormula,
        formatElementText,
        globalSearch,
        searchGroups,
        buildSourceEvidence,
        resolveMonsterImage,
        itemSource,
        monsterFeatures,
        regionMapEvidence,
        isBossMonster,
        mapDisplayName,
        selectRegion,
        getDropPriorityScore,
        getModel: () => model,
        diagnostics: () => JSON.parse(JSON.stringify(previewDiagnostics))
    });
    global.WorldAtlas = api;
    global.WorldAtlasPreview = api;
})(window);
