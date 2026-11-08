const filestore = {
    saveFile: async (filename, data) => {
        try {
            // false means the main process could not write the file. Callers that need to know check it.
            const saved = await window.electronAPI.saveFile(filename, data);
            if (saved) {
                console.log('File saved to disc', filename);
            }
            return saved;
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
