module.exports = app => {

    const internalError = err => {
        return { userErr: 'Internal Server Error', err };
    };

    const userStats = async (req, res) => {
        const userId = req.params.id;
        
        const closedSolicitations = await app.db('solicitations')
            .where({ user_id: userId})
            .whereNotNull('closing_date')
            .count('id')
            .first()
            .catch(err => res.status(500).json(internalError(err)));

        const openByCategory = await app.db({ s: 'solicitations' })
            .whereNull('closing_date')
            .join({ c: 'categories'}, 's.category_id', '=', 'c.id')
            .select({ categoria: 'c.name'})
            .count({ total: 's.id'})
            .groupBy('s.category_id')
            .where({ 's.user_id': userId })
            .catch(err => res.status(500).json(internalError(err)));

        const openSolicitations = openByCategory.reduce((acc, act) => acc + act.total, 0);              

        return res.status(200).json({
            open: openSolicitations,
            closed: Object.values(closedSolicitations)[0],
            byCategory: JSON.parse(JSON.stringify(openByCategory))
        })       
    }

    const operatorStats = async (req, res) => {
        
        if (!req.user.oper) return res.status(401).json({ err: 'Usuário sem permissão.' });

        const departmentId = parseInt(req.params.id);

        const closedSolicitations = await app.db({ s: 'solicitations' })
            .whereNotNull('s.closing_date')
            .join({ c: 'categories' }, 'c.department_id', '=', departmentId)            
            .count('s.id')            
            .first()
            .catch(err => res.status(500).json(internalError(err)));

        const openByCategory = await app.db({ s: 'solicitations'})
            .whereNull('s.closing_date')
            .join({ c: 'categories' }, 'c.department_id', '=', departmentId)
            .select({ categoria: 'c.name' })
            .count({ total: 'c.id' })            
            .groupBy('c.id')
            .catch(err => res.status(500).json(internalError(err)));
        
        const openByUser = await app.db({ s: 'solicitations' })
            .whereNull('s.closing_date') 
            .join({ c: 'categories'}, 'c.department_id', '=', departmentId)                       
            .join({ u: 'users'}, 'u.id', '=', 's.user_id')
            .select({ usuario: 'u.name' })
            .count({ total: 'u.id' })            
            .groupBy('u.name')
            .catch(err => res.status(500).json(internalError(err)));
        
        const openSolicitations = openByCategory.reduce((acc, act) => acc + act.total, 0);

        return res.status(200).json({
            open: openSolicitations,
            closed: Object.values(closedSolicitations)[0],
            byCategory: JSON.parse(JSON.stringify(openByCategory)),
            byUser: JSON.parse(JSON.stringify(openByUser))
        });
    }

    const adminStats = async (req, res) => {
        
        const closedSolicitations = await app.db('solicitations')
            .whereNotNull('closing_date')
            .count('id')
            .first()
            .catch(err => res.status(500).json(internalError(err)));

        const openByCategory = await app.db({ s: 'solicitations' })
            .whereNull('closing_date')
            .join({ c: 'categories' }, 's.category_id', '=', 'c.id')
            .select({ categoria: 'c.name' })
            .count({ total: 's.id' })
            .groupBy('s.category_id')
            .catch(err => res.status(500).json(internalError(err)));

        const openByUser = await app.db({ s: 'solicitations' })
            .whereNull('closing_date')
            .join({ u: 'users' }, 's.user_id', '=', 'u.id')
            .select({ nome: 'u.name' })
            .count({ total: 's.id' })
            .groupBy('s.user_id')
            .limit(5)
            .catch(err => res.status(500).json(internalError(err)));

        const openSolicitations = openByCategory.reduce((acc, act) => acc + act.total, 0);

        return res.status(200).json({
            open: openSolicitations,
            closed: Object.values(closedSolicitations)[0],
            byCategory: JSON.parse(JSON.stringify(openByCategory)),
            byUser: JSON.parse(JSON.stringify(openByUser))
        })
    }

    return { userStats, operatorStats, adminStats };
}