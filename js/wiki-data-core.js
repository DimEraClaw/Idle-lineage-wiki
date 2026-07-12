(function (global) {
    'use strict';

    const VALID_DATASET_STATUSES = new Set(['idle', 'registering', 'ready', 'fallback', 'error']);
    const REQUIRED_REPOSITORY_METHODS = [
        'getById', 'getAll', 'has', 'search', 'getStatus', 'getValidationErrors'
    ];
    const datasets = new Map();
    const repositoryRegistry = new Map();
    const adapterRegistry = new Map();
    let diagnosticEntries = [];

    function freezeDiagnostic(entry) {
        return Object.freeze({
            code: entry.code || 'unknown',
            severity: entry.severity || 'warning',
            dataset: entry.dataset || null,
            entityType: entry.entityType || null,
            entityId: entry.entityId || null,
            message: entry.message || '',
            sourceLocation: entry.sourceLocation || null,
            blocking: entry.blocking === true
        });
    }

    const diagnostics = Object.freeze({
        add(entry) {
            const diagnostic = freezeDiagnostic(entry || {});
            diagnosticEntries.push(diagnostic);
            return diagnostic;
        },
        getAll() {
            return diagnosticEntries.slice();
        },
        getByDataset(name) {
            return diagnosticEntries.filter(entry => entry.dataset === name);
        },
        getByCode(code) {
            return diagnosticEntries.filter(entry => entry.code === code);
        },
        clear(datasetName) {
            if (datasetName == null) {
                diagnosticEntries = [];
                return;
            }
            diagnosticEntries = diagnosticEntries.filter(entry => entry.dataset !== datasetName);
        },
        count(options) {
            const filters = options || {};
            return diagnosticEntries.filter(entry => {
                if (filters.dataset != null && entry.dataset !== filters.dataset) return false;
                if (filters.code != null && entry.code !== filters.code) return false;
                if (filters.severity != null && entry.severity !== filters.severity) return false;
                if (filters.blocking != null && entry.blocking !== filters.blocking) return false;
                return true;
            }).length;
        }
    });

    function cloneValue(value, seen) {
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return seen.get(value);
        const clone = Array.isArray(value) ? [] : {};
        seen.set(value, clone);
        Reflect.ownKeys(value).forEach(key => {
            clone[key] = cloneValue(value[key], seen);
        });
        return clone;
    }

    function deepFreeze(value, seen) {
        if (value === null || typeof value !== 'object' || seen.has(value)) return value;
        seen.add(value);
        Reflect.ownKeys(value).forEach(key => deepFreeze(value[key], seen));
        return Object.freeze(value);
    }

    function immutableClone(value) {
        return deepFreeze(cloneValue(value, new Map()), new Set());
    }

    function createReadOnlyRepository(options) {
        const config = options || {};
        const name = config.name;
        const entityType = config.entityType || name;
        const status = config.status || 'ready';
        const validationErrors = (config.validationErrors || []).map(immutableClone);
        const snapshot = (config.entities || []).map(immutableClone);
        const byId = new Map();
        snapshot.forEach(entity => {
            if (!entity || typeof entity.id !== 'string' || !entity.id) {
                throw new Error(`${name} repository contains an invalid entity ID`);
            }
            if (byId.has(entity.id)) throw new Error(`${name} repository contains duplicate ID: ${entity.id}`);
            byId.set(entity.id, entity);
        });
        const searchFields = Array.isArray(config.searchFields) && config.searchFields.length
            ? config.searchFields.slice()
            : ['id', 'name'];

        const base = {
            getById(id) {
                return byId.get(id) || null;
            },
            getAll() {
                return snapshot.slice();
            },
            has(id) {
                return byId.has(id);
            },
            search(keyword) {
                const query = String(keyword == null ? '' : keyword).trim().toLocaleLowerCase();
                const matches = query
                    ? snapshot.filter(entity => searchFields.some(field => {
                        const value = entity[field];
                        return typeof value === 'string' && value.toLocaleLowerCase().includes(query);
                    }))
                    : snapshot;
                return matches.map(entity => Object.freeze({
                    entityType,
                    entityId: entity.id,
                    entity
                }));
            },
            getStatus() {
                return status;
            },
            getValidationErrors() {
                return validationErrors.slice();
            }
        };
        const context = Object.freeze({ entities: snapshot, byId });
        const extensions = typeof config.extensions === 'function' ? config.extensions(context) : {};
        return Object.freeze(Object.assign(base, extensions || {}));
    }

    function validateRepository(name, repository) {
        if (!repository || typeof repository !== 'object') {
            throw new Error(`Repository must be an object: ${name}`);
        }
        REQUIRED_REPOSITORY_METHODS.forEach(method => {
            if (typeof repository[method] !== 'function') {
                throw new Error(`Repository ${name} is missing method: ${method}`);
            }
        });
    }

    function publicDataset(record) {
        if (!record) return null;
        return Object.freeze({
            name: record.name,
            version: record.version,
            status: record.status,
            adapterType: record.adapterType,
            repositories: Object.freeze(Array.from(record.repositories.keys())),
            diagnostics: diagnostics.getByDataset(record.name)
        });
    }

    function registerDataset(definition) {
        const config = definition || {};
        const name = config.name;
        if (typeof name !== 'string' || !name) {
            diagnostics.add({
                code: 'repository_registration_error', severity: 'error', dataset: name || null,
                entityType: null, entityId: null, message: 'Dataset name is required.',
                sourceLocation: 'WikiDataCore.registerDataset', blocking: true
            });
            return false;
        }
        if (datasets.has(name)) {
            diagnostics.add({
                code: 'duplicate_dataset', severity: 'warning', dataset: name,
                entityType: null, entityId: null, message: `Dataset is already registered: ${name}`,
                sourceLocation: 'WikiDataCore.registerDataset', blocking: false
            });
            return false;
        }
        const requestedStatus = config.status || 'ready';
        if (!VALID_DATASET_STATUSES.has(requestedStatus)) {
            diagnostics.add({
                code: 'repository_registration_error', severity: 'error', dataset: name,
                entityType: null, entityId: null, message: `Invalid Dataset status: ${requestedStatus}`,
                sourceLocation: 'WikiDataCore.registerDataset', blocking: true
            });
            return false;
        }
        const record = {
            name,
            version: config.version == null ? 1 : config.version,
            status: 'registering',
            adapterType: config.adapterType || 'native',
            repositories: new Map()
        };
        datasets.set(name, record);
        const pendingRepositories = config.repositories || {};
        try {
            Object.keys(pendingRepositories).forEach(repositoryName => {
                if (repositoryRegistry.has(repositoryName)) {
                    diagnostics.add({
                        code: 'index_collision', severity: 'error', dataset: name,
                        entityType: null, entityId: repositoryName,
                        message: `Repository name is already registered: ${repositoryName}`,
                        sourceLocation: 'WikiDataCore.registerDataset.repositories', blocking: true
                    });
                    throw new Error(`Repository collision: ${repositoryName}`);
                }
                validateRepository(repositoryName, pendingRepositories[repositoryName]);
            });
            Object.keys(pendingRepositories).forEach(repositoryName => {
                const repository = pendingRepositories[repositoryName];
                record.repositories.set(repositoryName, repository);
                repositoryRegistry.set(repositoryName, { dataset: name, repository });
            });
            (config.diagnostics || []).forEach(entry => diagnostics.add(Object.assign({}, entry, { dataset: name })));
            const hasBlocking = diagnostics.getByDataset(name).some(entry => entry.blocking);
            record.status = hasBlocking ? 'error' : requestedStatus;
            return record.status !== 'error';
        } catch (error) {
            record.status = 'error';
            record.repositories.forEach((repository, repositoryName) => repositoryRegistry.delete(repositoryName));
            record.repositories.clear();
            if (!diagnostics.getByDataset(name).some(entry => entry.code === 'index_collision')) {
                diagnostics.add({
                    code: 'repository_registration_error', severity: 'error', dataset: name,
                    entityType: null, entityId: null, message: error.message,
                    sourceLocation: 'WikiDataCore.registerDataset.repositories', blocking: true
                });
            }
            return false;
        }
    }

    function getRepository(name) {
        const registration = repositoryRegistry.get(name);
        if (registration) return registration.repository;
        diagnostics.add({
            code: 'unsupported_repository', severity: 'info', dataset: null,
            entityType: null, entityId: name || null, message: `Repository is not registered: ${name}`,
            sourceLocation: 'WikiDataCore.getRepository', blocking: false
        });
        return null;
    }

    function resetForTests(datasetName) {
        if (datasetName == null) {
            datasets.clear();
            repositoryRegistry.clear();
            diagnostics.clear();
            adapterRegistry.forEach(adapter => {
                if (typeof adapter.reset === 'function') adapter.reset();
            });
            return;
        }
        const record = datasets.get(datasetName);
        if (record) {
            record.repositories.forEach((repository, repositoryName) => {
                const registration = repositoryRegistry.get(repositoryName);
                if (registration && registration.dataset === datasetName) repositoryRegistry.delete(repositoryName);
            });
            datasets.delete(datasetName);
        }
        diagnostics.clear(datasetName);
        const adapter = adapterRegistry.get(datasetName);
        if (adapter && typeof adapter.reset === 'function') adapter.reset(datasetName);
    }

    const adapters = Object.freeze({
        install(name, adapter) {
            if (adapterRegistry.has(name)) return false;
            if (!adapter || typeof adapter.register !== 'function') return false;
            adapterRegistry.set(name, adapter);
            return true;
        },
        has(name) {
            return adapterRegistry.has(name);
        },
        invoke(name, source) {
            const adapter = adapterRegistry.get(name);
            if (!adapter) {
                diagnostics.add({
                    code: 'unsupported_repository', severity: 'warning', dataset: name,
                    entityType: null, entityId: null, message: `Adapter is not installed: ${name}`,
                    sourceLocation: 'WikiDataCore.adapters.invoke', blocking: false
                });
                return false;
            }
            return adapter.register(source);
        }
    });

    const repositories = Object.freeze({ createReadOnly: createReadOnlyRepository });

    global.WikiDataCore = Object.freeze({
        registerDataset,
        hasDataset: name => datasets.has(name),
        getDataset: name => publicDataset(datasets.get(name)),
        getDatasetStatus(name) {
            const record = datasets.get(name);
            return Object.freeze({
                name,
                status: record ? record.status : 'idle',
                ready: !!record && record.status === 'ready',
                adapterType: record ? record.adapterType : null
            });
        },
        getRepository,
        listRepositories: () => Array.from(repositoryRegistry.keys()).sort(),
        registerCraftAdapter: source => adapters.invoke('craft', source),
        diagnostics,
        repositories,
        adapters,
        resetForTests
    });
})(window);
