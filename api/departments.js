module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const save = (req, res) => {
        const department = { ...req.body };       

        try {
            existsOrError(department.name, 'Missing Department Name');
            existsOrError(department.initials, 'Missing Department Initials');
        } catch (err) {
            return res.status(400).json({ err });
        }

        department.initials = department.initials.toUpperCase();

        if (req.params.id) {
            department.id = req.params.id;

            app.db('departments')
                .update(department)
                .where({ id: department.id })
                .then(data => {
                    try {
                        existsOrError(data, 'Departamento não encontrado');
                    } catch (err) {
                        res.status(400).json({ err });
                    }
                })
                .catch(err => res.status(500).json({ err }));
        } else {
            app.db('departments')
                .returning('*')
                .insert(department)
                .then(data => {  
                    department.id = data[0];                  
                    res.status(200).json(department);
                })
                .catch(err => res.status(500).json({ err }));
        }
    }

    const get = async (req, res) => {
        const limit = 10;

        const result = await app.db('departments')
            .count('id')
            .first();
                
        const count = result['count(`id`)'];
        
        if (req.params.id) {
            app.db('departments')
                .select('*')
                .where({ id: req.params.id })
                .first()
                .then(data => {
                    try {
                        existsOrError(data, 'Departamento não encontrado');                        
                    } catch (err) {
                        res.status(400).json({ err });
                    }

                    res.status(200).json(data);
                })
                .catch(err => res.status(500).json({ err }));
        } else {
            const page = req.query.page || 1;

            app.db('departments')
                .select('*')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id')
                .then(data => res.status(200).json({ data, count, limit }))
                .catch(err => res.status(500).json({ err }));
        }
    }

    const remove = async (req, res) => {
        const id = req.params.id;

        const hasUsers = await app.db('users').select('id').where({ department_id: id}).first();
        const hasCategories = await app.db('categories').select('id').where({ department_id: id}).first();
                
        try {
            notExistsOrError(hasUsers, 'Departamento possui Usuários');
            notExistsOrError(hasCategories, 'Departamento possui Categorias');
        } catch (err) {
            res.status(400).json({ err });
        }

        app.db('departments')
            .where({ id })
            .del()
            .then(rows => {
                try {
                    existsOrError(rows, 'Departamento Não Encontrado');
                } catch (err) {
                    res.status(400).json({ err });
                    return;
                }
                
                res.status(204).send();
            })
            .catch(err => res.status(500).json({ err }));
    }

    return { save, get, remove };
}