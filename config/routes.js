module.exports = app => {
    app.route('/departments')
        .get(app.api.departments.get)
        .post(app.api.departments.save);

    app.route('/departments/:id')
        .get(app.api.departments.get)
        .put(app.api.departments.save)
        .delete(app.api.departments.remove);

    app.route('/categories')
        .get(app.api.categories.get)
        .post(app.api.categories.save);

    app.route('/categories/:id')
        .get(app.api.categories.get)
        .put(app.api.categories.save)
        .delete(app.api.categories.remove);

    app.route('/users')
        .get(app.api.users.get)
        .post(app.api.users.save);

    app.route('/users/:id')
        .get(app.api.users.get)
        .put(app.api.users.update)
        .delete(app.api.users.remove);

    app.route('/solicitations')
        .get(app.api.solicitations.get)
        .post(app.api.solicitations.save)

    app.route('/solicitations/user/:id/closed')
        .get(app.api.solicitations.getClosedByUserId);

    app.route('/solicitations/user/:id')
        .get(app.api.solicitations.getByUserId);

    app.route('/solicitations/closed')
        .get(app.api.solicitations.getClosed);

    app.route('/solicitations/:id/close')
        .put(app.api.solicitations.close);
    
    app.route('/solicitations/:id')
        .get(app.api.solicitations.getById)
        .put(app.api.solicitations.update)
        .delete(app.api.solicitations.remove)
}