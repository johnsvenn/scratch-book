<template>
    <BaseModal title="Settings" @close="close()">
        <ul class="settings__list">
            <li class="settings__list-item settings__list-item--sync">
                <div class="settings__row">
                    <input id="watcher-toggle" v-model="settings.enableWatcher" type="checkbox" @change="onWatcherToggle" />
                    <label for="watcher-toggle" class="settings__label">Enable Filesystem Sync Watcher (Dropbox/Sync support)</label>
                </div>
                <small class="settings__help">
                    When enabled, the app will watch for changes to <code>_sync_state.json</code> and update automatically.
                </small>
            </li>
            <li class="settings__list-item settings__list-item--actions">
                <BaseButton label="Sync Now (Force Refresh)" @click="forceSync()">Sync Now (Force Refresh)</BaseButton>
                <BaseButton label="Rebuild Database" @click="rebuildDatabase()">Rebuild Database</BaseButton>
                <BaseButton label="Export Data (.zip)" @click="exportData()">Export Data (.zip)</BaseButton>
                <BaseButton label="Import Data (from .zip)" @click="importData()">Import Data (from .zip)</BaseButton>
            </li>
        </ul>
    </BaseModal>
</template>

<script setup>
    import SyncService from '../../lib/SyncService';
    import db from '../../lib/db';
    import { ref, onMounted } from 'vue';
    import BaseModal from '../BaseModal/BaseModal.vue';
    import BaseButton from '../BaseButton/BaseButton.vue';
    import { SETTINGS, SETTING_DEFAULTS } from '../../../shared/protocol.js';

    const emit = defineEmits(['close-settings']);

    const settings = ref({
        enableWatcher: SETTING_DEFAULTS[SETTINGS.enableWatcher]
    });

    onMounted(async () => {
        const stored = await db.getSetting(SETTINGS.enableWatcher);
        if (stored !== null) {
            settings.value.enableWatcher = stored;
        }
    });

    async function onWatcherToggle() {
        const enabled = settings.value.enableWatcher;
        try {
            await db.putSetting(SETTINGS.enableWatcher, enabled);
        } catch (e) {
            // Nothing was saved, so the watcher keeps its previous state. Put the checkbox back.
            console.error('Could not save the watcher setting', e);
            settings.value.enableWatcher = !enabled;
            alert('Could not save the setting. The watcher is unchanged.');
            return;
        }
        if (window.electronAPI && window.electronAPI.setWatcherEnabled) {
            window.electronAPI.setWatcherEnabled(settings.value.enableWatcher);
        }
    }

    function close() {
        emit('close-settings');
    }

    async function forceSync() {
        try {
            await SyncService.performSync();
            alert('Manual sync complete!');
        } catch (e) {
            console.error(e);
            alert('Sync failed: ' + e.message);
        }
    }

    async function rebuildDatabase() {
        if (!confirm('This will wipe your local database and rebuild it entirely from the filesystem. Proceed?')) {
            return;
        }
        try {
            await SyncService.performSync(true);
            alert('Database rebuild complete! The application will now reload.');
            window.location.reload();
        } catch (e) {
            console.error(e);
            alert('Rebuild failed: ' + e.message);
        }
    }

    async function exportData() {
        const success = await window.electronAPI.exportData();
        if (success) {
            alert('Data exported successfully!');
        } else {
            alert('Export failed.');
        }
    }

    async function importData() {
        if (!confirm('This will OVERWRITE all current data. Are you sure?')) {
            return;
        }
        const success = await window.electronAPI.importData();
        if (success) {
            alert('Data imported successfully! The application will now reload.');
            window.location.reload();
        } else {
            alert('Import failed.');
        }
    }
</script>

<style scoped lang="scss">
    @use 'sass:color';

    .settings__list {
        list-style: none;
        padding: 10px 20px;
        margin: 0;
    }

    .settings__list-item--sync {
        border-bottom: 1px solid $grey-250;
        padding-bottom: 20px;
        margin-bottom: 20px;
    }

    .settings__row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }

    .settings__label {
        font-size: 14px;
        color: $grey-800;
    }

    .settings__help {
        display: block;
        color: $grey-700;
        font-size: 11px;
        margin-bottom: 10px;
    }

    .settings__list-item--actions {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .base-button {
            width: 200px;
        }
    }
</style>
