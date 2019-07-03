
exports.up = function(knex) {
    return knex.schema.createTable('users', function(table) {
        table.increments();
        table.string('name').notNullable();
        table.string('email').notNullable();
        table.string('password').notNullable();
        table.boolean('admin').notNullable();
        table.integer('department_id').unsigned().notNullable();
        table.timestamp('deleted_at');
        table.unique(['email']);
        table.foreign('department_id').references('id').inTable('departments');
    })
};

exports.down = function(knex) {
    return knex.schema.dropTable('users');
};
