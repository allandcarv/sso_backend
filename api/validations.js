module.exports = app => {
    function existsOrError (value, err) {
        if (!value) throw err;
        if (Array.isArray(value) && value.length() === 0) throw err;
        if (value === Object(value) && Object.keys(value) === 0) throw err;
        if (typeof value === 'string' && !value.trim()) throw err;
    }

    function notExistsOrError (value, err) {
        try {
            existsOrError(value, err);
        } catch(err) {
            return
        }

        throw err;
    }

    function equalsOrError (value1, value2, err) {
        if (value1 !== value2) throw err;
    }

    return { existsOrError, notExistsOrError, equalsOrError };
}