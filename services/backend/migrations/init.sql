-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Clean Types
CREATE TYPE incident_status AS ENUM ('pending', 'triaged', 'dispatched', 'resolved', 'rejected');
CREATE TYPE asset_sector AS ENUM ('drainage', 'water_supply', 'roads', 'electrical', 'solid_waste', 'unknown');

-- 1. Dynamic Wards / Administrative Boundaries (Pan-India)
CREATE TABLE IF NOT EXISTS wards (
    id VARCHAR(100) PRIMARY KEY,              -- e.g. 'BEGUSARAI_W04', 'HYD_GHMC_W12', 'AHM_AMC_W02'
    district VARCHAR(100) NOT NULL,           -- e.g. 'Begusarai', 'Hyderabad', 'Ahmedabad'
    state VARCHAR(100) NOT NULL,              -- e.g. 'Bihar', 'Telangana', 'Gujarat'
    name VARCHAR(150) NOT NULL,               -- e.g. 'Lohar Patti', 'Banjara Hills', 'Navrangpura'
    vulnerability_index NUMERIC(3, 2) NOT NULL DEFAULT 0.50, -- 0.00 (Affluent) to 1.00 (Critical Slum/Peri-urban)
    boundary GEOMETRY(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_wards_spatial ON wards USING GIST(boundary);

-- 2. Clustered Incidents (Spatial Hotspots)
CREATE TABLE IF NOT EXISTS incident_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ward_id VARCHAR(100) REFERENCES wards(id) ON DELETE SET NULL,
    asset_category asset_sector NOT NULL DEFAULT 'unknown',
    centroid GEOMETRY(Point, 4326) NOT NULL,
    incident_count INT NOT NULL DEFAULT 1,
    vps_score NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    sai_score NUMERIC(4, 3) NOT NULL DEFAULT 0.000,
    is_shadow_alert BOOLEAN NOT NULL DEFAULT FALSE,
    headline VARCHAR(255),
    technical_root_cause TEXT,
    sow_memo JSONB,
    status incident_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_clusters_spatial ON incident_clusters USING GIST(centroid);
CREATE INDEX idx_clusters_vps ON incident_clusters(vps_score DESC);

-- 3. Individual Civic Telemetry Reports
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id UUID REFERENCES incident_clusters(id) ON DELETE SET NULL,
    ward_id VARCHAR(100) REFERENCES wards(id) ON DELETE SET NULL,
    phone_hash VARCHAR(64) NOT NULL,
    source VARCHAR(30) NOT NULL,
    coordinates GEOMETRY(Point, 4326) NOT NULL,
    gps_accuracy_meters NUMERIC(6, 2),
    hardware_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    media_url TEXT,
    audio_url TEXT,
    phash VARCHAR(64),
    raw_text TEXT,
    translated_text TEXT,
    is_rejected BOOLEAN DEFAULT FALSE,
    rejection_reason TEXT,
    status incident_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_incidents_spatial ON incidents USING GIST(coordinates);
CREATE INDEX idx_incidents_phash ON incidents(phash);