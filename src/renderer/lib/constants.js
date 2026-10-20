const Constants = Object.freeze({
    FILESTORE: {
        FILE_SYSTEM: Symbol('FILE_SYSTEM'),
        INDEXDB: Symbol('INDEXDB'),
    },
    DATA_DIRECTORY: {
        DEFAULT: '.scratchbook/',
        DEVELOPMENT: '.scratchbookdev2/',
    },
    CURRENT_TAG: 'current',
    ARCHIVE_TAG: 'archive',
    FAVOURITE_TAG: 'favourite',
});

export default Constants;
