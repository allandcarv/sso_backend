module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const internalError = err => {
        return { err: 'Internal Server Error', err };
    };

    const save = (req, res) => {
        const department = { ...req.body };            

        try {
            existsOrError(department.name, 'Faltando nome do Departamento');
            existsOrError(department.initials, 'Faltando sigla do departamento');
        } catch (err) {
            return res.status(400).json({ err });
        }

        department.initials = department.initials.toUpperCase();
        
        app.db('departments')                
            .insert(department)
            .then(() => res.status(200).send())
            .catch(err => {
                console.log(err);    
                res.status(500).send(err)
            });
        
    }

    const update = async (req, res) => {
        const id = req.params.id;
        const department = { name: req.body.name, initials: req.body.initials };

        try {            
            const hasUsers = await app.db('users')
                .whereNull('deleted_at')
                .where({ department_id: id })
                .select('id')
                .limit(1)
                .first()
                .catch(err => res.status(500).json(internalError(err)));
            notExistsOrError(hasUsers, 'Departamento possui usuários, não pode ser alterado.');

            const hasCategories = await app.db('categories')
                .where({ department_id: id })
                .select('id')
                .limit(1)
                .first()
                .catch(err => res.status(500).json(internalError(err)));
            notExistsOrError(hasCategories, 'Departamento possui categorias, não pode ser alterado.');
        } catch (err) {
            return res.status(400).json({ err });
        }
        
        if (department.initials) department.initials = department.initials.toUpperCase();
        
        app.db('departments')
            .where({ id })
            .update(department)
            .then(data => {
                try {
                    existsOrError(data, 'Departamento não encontrado.');
                    return res.status(200).send();
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const get = async (req, res) => {                
                
        const limit = 10;
        const result = await app.db('departments').count('id').first();                
        const count = Object.values(result)[0];
        const page = req.query.page || 1;

        app.db('departments')
            .select('*')
            .limit(limit).offset(page * limit - limit)
            .orderBy('id')
            .then(data => res.status(200).json({ data, count, limit }))
            .catch(err => res.status(500).json(internalError(err)));
    
    }

    const getByDepartmentId = (req, res) => {
        const id = req.params.id;

        app.db('departments')
            .where({ id })
            .select('*')
            .limit(1)
            .first()
            .then(data => {
                try {
                    existsOrError(data, 'Departamento não encontrado');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
    }

    const remove = async (req, res) => {
        const id = req.params.id;
        
        try {
            const hasUsers = await app.db('users').select('id').where({ department_id: id}).limit(1).first();
            const hasCategories = await app.db('categories').select('id').where({ department_id: id}).limit(1).first();
            notExistsOrError(hasUsers, 'Departamento possui Usuários');
            notExistsOrError(hasCategories, 'Departamento possui Categorias');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('departments')
            .where({ id })
            .del()
            .then(rows => {
                try {
                    existsOrError(rows, 'Departamento Não Encontrado');
                    return res.status(204).send();
                } catch (err) {
                    return res.status(404).json({ err });                    
                }                
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, get, getByDepartmentId, update, remove };
}