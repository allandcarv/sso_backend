
exports.up = function(knex) {
  return knex.schema.createTable('categories', function(table) {
      table.increments();
      table.string('name').notNullable();
      table.integer('department_id').unsigned().notNullable();
      table.foreign('department_id').references('id')
        .inTable('departments');
      table.unique(['name']);
  })    
};

exports.down = function(knex) {
  return knex.schema.dropTable('categories');
};
