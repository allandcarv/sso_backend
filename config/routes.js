module.exports = app => {
    app.route('/departments')
        .get(app.api.departments.get)
        .post(app.api.departments.save);

    app.route('/departments/:id')
        .get(app.api.departments.get)
        .post(app.api.departments.save)
        .delete(app.api.departments.remove);
}