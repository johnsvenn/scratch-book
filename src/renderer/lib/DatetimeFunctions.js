const Datetime = function () {
    this.now = new Date();

    this.getDateTimeString = () => {
        return this.now.toISOString();
    };
};

export function getOrdinalSuffix(i) {
    const j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return 'st';
    }
    if (j === 2 && k !== 12) {
        return 'nd';
    }
    if (j === 3 && k !== 13) {
        return 'rd';
    }
    return 'th';
}

export function formatDate(value) {
    if (value) {
        const date = new Date(value);
        const day = date.getDate();
        const month = date.toLocaleString('en-GB', { month: 'long' });
        const year = date.getFullYear();
        const time = date.toLocaleString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return `${day}${getOrdinalSuffix(day)} ${month} ${year} ${time}`;
    }
    return '';
}

export default Datetime;
