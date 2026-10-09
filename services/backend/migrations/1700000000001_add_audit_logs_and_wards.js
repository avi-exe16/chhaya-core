/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Wards Table
  pgm.createTable('wards', {
    id: { type: 'varchar(64)', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    district: { type: 'varchar(255)', notNull: false },
    state: { type: 'varchar(255)', notNull: false },
    boundary: { type: 'geometry(MultiPolygon, 4326)', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('wards', 'boundary', { method: 'gist', ifNotExists: true });

  // 2. Cryptographic Audit Logs Table
  pgm.createTable('audit_logs', {
    sequence_num: { type: 'bigserial', primaryKey: true },
    actor_id: { type: 'varchar(255)', notNull: true },
    actor_type: { type: 'varchar(64)', notNull: true },
    action: { type: 'varchar(128)', notNull: true },
    entity_type: { type: 'varchar(64)', notNull: true },
    entity_id: { type: 'varchar(255)', notNull: true },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    prev_hash: { type: 'varchar(64)', notNull: true },
    entry_hash: { type: 'varchar(64)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('audit_logs', 'sequence_num', { ifNotExists: true });
  pgm.createIndex('audit_logs', 'entry_hash', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs', { ifExists: true });
  pgm.dropTable('wards', { ifExists: true });
};
