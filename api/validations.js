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

    async function checkAccess(userId, userDepartment, userAdmin, solicitationId) {
        const isAdmin = userAdmin;        

        const result = await app.db({ s: 'solicitations'})
            .where({ 's.id': solicitationId })
            .join({ c: 'categories' }, 's.category_id', '=', 'c.id')
            .select('s.user_id', 'c.department_id')
            .limit(1)
            .first();                   

        if (result) {
            const isUser = result.user_id === userId;
            const isOperator = result.department_id === userDepartment;           

            return (isUser || isOperator || isAdmin);
        } else {
            return 404;
        }

    }

    return { existsOrError, notExistsOrError, equalsOrError, checkAccess };
}