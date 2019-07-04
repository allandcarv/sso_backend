module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;
        
    const save = async (req, res) => {
        const category = { ...req.body };
    
        try {
            existsOrError(category.name, 'Faltando nome da Categoria');
            existsOrError(category.department_id, 'Faltando departamento da Categoria');
        } catch (err) {
            return res.status(400).json({ err });
        }

        const checkDepartmentID = await app.db('departments').where({ id: category.department_id }).select('id').first();
        
        try {
            existsOrError(checkDepartmentID, 'Departamento não encontrado')
        } catch (err) {
            return res.status(400).json({ err });
        }
        
        if (req.params.id) {
            category.id = req.params.id;

            app.db('categories')
                .update(category)
                .where({ id: category.id })
                .then(data => {
                    try {
                        existsOrError(data, 'Categoria não encontrada');                        
                    } catch (err) {
                        return res.status(400).json({ err });
                    }

                    return res.status(200).send();
                })
                .catch(err => res.status(500).json({
                    userErr: 'Internal Server Error',
                    err
                }));
        } else {
            app.db('categories')                
                .insert(category)                
                .then(() => res.status(200).json(category) )
                .catch(err => res.status(500).json({
                    userErr: 'Internal Server Error',
                    err
                }));
        }
    }

    const get = async (req, res) => {
        
        if (req.params.id) {
            app.db('categories')
                .select('*')
                .where({ id: req.params.id })
                .first()
                .then(data => {                    
                    try {
                        existsOrError(data, 'Categoria não encontrada')
                    } catch (err) {
                        return res.status(400).json({ err });                                                
                    }
                    
                    return res.status(200).json(data);
                })
                .catch(err => res.status(500).json({
                    userErr: 'Internal Server Error',
                    err
                }))
        } else {
            const limit = 10;
            const result = await app.db('categories').count('id').first();
            const count = Object.values(result)[0];
            const page = req.query.page || 1

            app.db('categories')
                .select('*')
                .limit(limit).offset(page * limit - limit)
                .orderBy('id')
                .then(data => res.status(200).json(data, count, limit) )
                .catch(err => res.status(500).json({
                    userErr: 'Internal Server Error',
                    err
                }))
        }
    }

    const remove = async (req, res) => {
        const id = req.params.id;
        const hasSolicitations = await app.db('solicitations').select('id').where({ category_id: id }).first()

        try {
            notExistsOrError(hasSolicitations, 'Categoria possui Solicitações');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('categories')
            .where({ id })
            .del()
            .then(rows => {
                try {
                    existsOrError(rows, 'Categoria não encontrada');
                } catch (err) {
                    return res.status(400).json({ err });
                }

                return res.status(204).send();
            })
            .catch(err => res.status(500).json({
                userErr: 'Internal Server Error',
                err
            }));
    }

    return { save, get, remove };
}