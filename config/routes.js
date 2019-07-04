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
}