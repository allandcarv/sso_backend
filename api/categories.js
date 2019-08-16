module.exports = app => {
    const { existsOrError, notExistsOrError } = app.api.validations;

    const internalError = err => {
        return { userErr: 'Internal Server Error', err };
    };

    const save = async (req, res) => {
        const category = { ...req.body };

        try {
            existsOrError(category.name, 'Faltando nome da Categoria');
            existsOrError(category.department_id, 'Faltando departamento da Categoria');

            const checkDepartmentID = await app.db('departments').where({ id: category.department_id }).select('id').limit(1).first();
            existsOrError(checkDepartmentID, 'Departamento não encontrado');
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('categories')
            .insert(category)
            .then(() => res.status(201).send())
            .catch(err => res.status(500).json(internalError(err)));

    }

    const get = async (req, res) => {

        const limit = 10;
        const result = await app.db('categories').count('id').first();
        const count = Object.values(result)[0];
        const page = req.query.page || 1

        app.db({ c: 'categories'})
            .join('departments', 'departments.id', '=', 'c.department_id')
            .select('c.*', { departmentName: 'departments.name' })
            .limit(limit).offset(page * limit - limit)
            .orderBy('id')
            .then(data => res.status(200).json({ data, count, limit }))
            .catch(err => res.status(500).json(internalError(err)))

    }

    const getByCategoryId = (req, res) => {
        const categoryId = req.params.id;

        app.db('categories')
            .where({ 'categories.id': categoryId })
            .join('departments', 'departments.id', '=', 'categories.department_id')
            .select('categories.*', { departmentName: 'departments.name' })
            .limit(1)
            .first()
            .then(data => {
                try {                                        
                    existsOrError(data, 'Categoria não encontrada');
                    return res.status(200).json(data);
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const getByDepartmentId = (req, res) => {
        const departmentId = req.params.id;

        app.db('categories')
            .select('id', 'name')
            .where({ 'department_id': departmentId })
            .then(data => {
                if (data) {
                    res.status(200).json({ categories: data });
                } else {
                    res.status(404).json({ err: 'Nenhuma categoria encontrada.' });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const update = async (req, res) => {
        const id = req.params.id;
        const category = { name: req.body.name };
        
        try {           
            const hasSolicitations = await app.db('solicitations').where({ category_id: id }).select('id').limit(1).first().catch(err => res.status(500).json(internalError(err)));            
            notExistsOrError(hasSolicitations, 'Categoria possui solicitações, não pode ser alterada');            
        } catch (err) {
            return res.status(400).json({ err });
        }

        app.db('categories')
            .where({ id })
            .update(category)
            .then(data => {
                try {                    
                    existsOrError(data, 'Categoria não encontrada');
                    return res.status(200).send();
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    const remove = async (req, res) => {
        const id = req.params.id;

        try {
            const hasSolicitations = await app.db('solicitations').select('id').where({ category_id: id }).first()
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
                    return res.status(204).send();
                } catch (err) {
                    return res.status(404).json({ err });
                }
            })
            .catch(err => res.status(500).json(internalError(err)));
    }

    return { save, get, getByCategoryId, getByDepartmentId, update, remove };
}