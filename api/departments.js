const nodemail = require('../config/nodemail');

module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const save = (req, res) => {
        const department = { ...req.body };       

        try {
            existsOrError(department.name, 'Faltando nome do Departamento');
            existsOrError(department.initials, 'Faltando sigla do departamento');
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
                        return res.status(400).json({ err });                        
                    }                    
                    return res.status(200).send();
                })
                .catch(err => res.status(500).json({ err }));
        } else {
            app.db('departments')                
                .insert(department)
                .then(() => res.status(200).send())
                .catch(err => res.status(500).json({ err }));
        }
    }

    const get = async (req, res) => {                
        
        if (req.params.id) {
            app.db('departments')
                .select('*')
                .where({ id: req.params.id })
                .first()
                .then(data => {
                    try {
                        existsOrError(data, 'Departamento não encontrado');                        
                    } catch (err) {
                        return res.status(400).json({ err });                        
                    }

                    return res.status(200).json(data);
                })
                .catch(err => res.status(500).json({ err }));
        } else {
            const limit = 10;
            const result = await app.db('departments').count('id').first();                
            const count = Object.values(result)[0];
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
            return res.status(400).json({ err });
        }

        app.db('departments')
            .where({ id })
            .del()
            .then(rows => {
                try {
                    existsOrError(rows, 'Departamento Não Encontrado');
                } catch (err) {
                    return res.status(400).json({ err });                    
                }
                
                return res.status(204).send();
            })
            .catch(err => res.status(500).json({ err }));
    }

    return { save, get, remove };
}