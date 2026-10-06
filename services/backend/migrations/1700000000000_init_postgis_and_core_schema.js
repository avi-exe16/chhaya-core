/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Extensions
  pgm.createExtension('postgis', { ifNotExists: true });
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // 2. Enums
  pgm.createType('incident_status', [
    'pending',
    'triaged',
    'dispatched',
    'resolved',
    'rejected',
  ]);

  // 3. Incident Clusters Table
  pgm.createTable('incident_clusters', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    ward_id: { type: 'varchar(64)', notNull: false },
    asset_category: { type: 'varchar(64)', notNull: false },
    centroid: { type: 'geometry(Point, 4326)', notNull: true },
    incident_count: { type: 'integer', notNull: true, default: 1 },
    vps_score: { type: 'numeric(5, 2)', notNull: true, default: 0.00 },
    sai_score: { type: 'numeric(5, 2)', notNull: true, default: 0.00 },
    is_shadow_alert: { type: 'boolean', notNull: true, default: false },
    headline: { type: 'text', notNull: false },
    technical_root_cause: { type: 'text', notNull: false },
    sow_memo: { type: 'jsonb', notNull: false },
    status: { type: 'incident_status', notNull: true, default: 'pending' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // 4. Incidents Table
  pgm.createTable('incidents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    whatsapp_message_id: { type: 'varchar(255)', notNull: false, unique: true },
    cluster_id: {
      type: 'uuid',
      references: 'incident_clusters',
      onDelete: 'SET NULL',
      notNull: false,
    },
    coordinates: { type: 'geometry(Point, 4326)', notNull: true },
    phash: { type: 'varchar(64)', notNull: false },
    media_url: { type: 'text', notNull: false },
    phone_hash: { type: 'varchar(64)', notNull: false },
    raw_text: { type: 'text', notNull: false },
    source: { type: 'varchar(32)', notNull: true, default: 'whatsapp' },
    status: { type: 'incident_status', notNull: true, default: 'pending' },
    hardware_timestamp: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });

  // 5. Spatial & Operational Indexes
  pgm.createIndex('incident_clusters', 'centroid', { method: 'gist' });
  pgm.createIndex('incident_clusters', ['status', 'sai_score', 'vps_score']);
  pgm.createIndex('incidents', 'coordinates', { method: 'gist' });
  pgm.createIndex('incidents', 'cluster_id');
  pgm.createIndex('incidents', 'phash');
};

exports.down = (pgm) => {
  pgm.dropTable('incidents');
  pgm.dropTable('incident_clusters');
  pgm.dropType('incident_status');
};