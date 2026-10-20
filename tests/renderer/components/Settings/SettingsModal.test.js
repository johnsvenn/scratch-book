import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsModal from '../../../../src/renderer/components/Settings/SettingsModal.vue';
import db from '../../../../src/renderer/lib/db';
import SyncService from '../../../../src/renderer/lib/SyncService';

// Mock dependencies
vi.mock('../../../../src/renderer/lib/db', () => ({
    default: {
        getSetting: vi.fn(),
        putSetting: vi.fn(),
    }
}));

vi.mock('../../../../src/renderer/lib/SyncService', () => ({
    default: {
        performSync: vi.fn(),
    }
}));

vi.mock('../../../../src/renderer/lib/migrateToPageBundles', () => ({
    default: vi.fn(),
}));

// Mock window.electronAPI and confirm/alert
global.window.electronAPI = {
    setWatcherEnabled: vi.fn(),
    exportData: vi.fn(),
    importData: vi.fn(),
};
global.confirm = vi.fn(() => true);
global.alert = vi.fn();
// Mock window.location.reload
Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: vi.fn() },
});

describe('SettingsModal.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.getSetting.mockResolvedValue(true);
    });

    it('loads settings on mount', async () => {
        db.getSetting.mockResolvedValue(false);
        const wrapper = mount(SettingsModal);

        // Wait for onMounted
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(db.getSetting).toHaveBeenCalledWith('enableWatcher');
        expect(wrapper.find('#watcher-toggle').element.checked).toBe(false);
    });

    it('emits close-settings when close is clicked', async () => {
        const wrapper = mount(SettingsModal);
        await wrapper.find('.base-modal__close').trigger('click');
        expect(wrapper.emitted('close-settings')).toBeTruthy();
    });

    it('updates db and electronAPI when watcher is toggled', async () => {
        const wrapper = mount(SettingsModal);
        // Wait for onMounted (db.getSetting)
        await new Promise(resolve => setTimeout(resolve, 0));

        const checkbox = wrapper.find('#watcher-toggle');

        await checkbox.setValue(false);
        await wrapper.vm.$nextTick();

        expect(db.putSetting).toHaveBeenCalledWith('enableWatcher', false);
        expect(window.electronAPI.setWatcherEnabled).toHaveBeenCalledWith(false);
    });

    it('calls SyncService.performSync when Sync Now is clicked', async () => {
        const wrapper = mount(SettingsModal);
        await wrapper.findAll('.settings__list-item button')[0].trigger('click'); // Sync Now

        expect(SyncService.performSync).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith('Manual sync complete!');
    });

    it('calls SyncService.performSync(true) when Rebuild Database is clicked', async () => {
        const wrapper = mount(SettingsModal);
        await wrapper.findAll('.settings__list-item button')[1].trigger('click'); // Rebuild Database

        expect(global.confirm).toHaveBeenCalled();
        expect(SyncService.performSync).toHaveBeenCalledWith(true);
        expect(global.alert).toHaveBeenCalledWith('Database rebuild complete! The application will now reload.');
        expect(window.location.reload).toHaveBeenCalled();
    });

    it('calls electronAPI.exportData when Export Data is clicked', async () => {
        window.electronAPI.exportData.mockResolvedValue(true);
        const wrapper = mount(SettingsModal);
        await wrapper.findAll('.settings__list-item button')[2].trigger('click'); // Export Data

        expect(window.electronAPI.exportData).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith('Data exported successfully!');
    });

    it('calls electronAPI.importData when Import Data is clicked', async () => {
        window.electronAPI.importData.mockResolvedValue(true);
        const wrapper = mount(SettingsModal);
        await wrapper.findAll('.settings__list-item button')[3].trigger('click'); // Import Data

        expect(global.confirm).toHaveBeenCalled();
        expect(window.electronAPI.importData).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith('Data imported successfully! The application will now reload.');
        expect(window.location.reload).toHaveBeenCalled();
    });
});
