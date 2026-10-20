const filestore = {
    saveFile: async (filename, data) => {
        try {
            await window.electronAPI.saveFile(filename, data);
            console.log('File saved to disc', filename);
        } catch (e) {
            console.error('Save failed', e);
            throw e;
        }
    },

    listFiles: async () => {
        return await window.electronAPI.listFiles();
    },

    getFile: async (filename) => {
        return await window.electronAPI.getFile(filename);
    },

    deleteFile: async (filename) => {
        return await window.electronAPI.deleteFile(filename);
    },
};

export default filestore;
