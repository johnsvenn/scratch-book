/**
 * The separator used to split meta data and the content
 */
const separator = '\n++++++++++\n';

const splitSeparator = '+=+=+=+=+=+=+';

const fileFormatter = {
    prepareItem: (item) => {
        // Extract the data from the item.
        let { content = '', ...metaData } = item;
        // Format the JSON so it isn't all on one line.
        return JSON.stringify(metaData, null, '    ') + separator + content;
    },

    extract: (fileData) => {
        // fileData can be a buffer to we need to convert to a string to use the replace method.(
        if (fileData) {
            let str = fileData.toString();
            if (str) {
                // An array containing a string of json and the actual content
                let splitData = fileData
                    .toString()
                    .replace(separator, splitSeparator)
                    .split(splitSeparator);
                // We need to parse the JSON string into an object.
                let metaData = null;
                try {
                    metaData = JSON.parse(splitData[0]);
                } catch (e) {
                    //
                }
                return [metaData, splitData[1]];
            }
        }
        return [{}, ''];
    },
};

export default fileFormatter;
