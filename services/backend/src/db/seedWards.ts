import fs from 'fs';
import path from 'path';
import { db, pool } from './client';

async function seedDynamicDistrict(filePath: string) {
  try {
    const absolutePath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`GeoJSON source file not found at: ${absolutePath}`);
    }

    const rawData = fs.readFileSync(absolutePath, 'utf8');
    const geojson = JSON.parse(rawData);

    const district = geojson.district || 'Unknown District';
    const state = geojson.state || 'Unknown State';

    console.log(`[GeoSeeder] Beginning ingestion for \({district},\){state}...`);

    for (const feature of geojson.features) {
      const wardId = feature.properties.ward_id || feature.properties.id;
      const wardName = feature.properties.name || feature.properties.ward_name;
      const vulnerability = feature.properties.vulnerability_index ?? 0.50;

      let geometry = feature.geometry;

      // Ensure Polygon is cast to MultiPolygon to match schema enforcement
      if (geometry.type === 'Polygon') {
        geometry = {
          type: 'MultiPolygon',
          coordinates: [geometry.coordinates],
        };
      }

      const geomJsonString = JSON.stringify(geometry);

      // Parameterized query: zero SQL injection risk
      const query = `
        INSERT INTO wards (id, district, state, name, vulnerability_index, boundary)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))
        ON CONFLICT (id) DO UPDATE SET
          district = EXCLUDED.district,
          state = EXCLUDED.state,
          name = EXCLUDED.name,
          vulnerability_index = EXCLUDED.vulnerability_index,
          boundary = EXCLUDED.boundary;
      `;

      await db.query(query, [wardId, district, state, wardName, vulnerability, geomJsonString]);
      console.log(`  ✔ Ingested Ward: [\({wardId}]\){wardName} (Vulnerability Index: ${vulnerability})`);
    }

    console.log(`[GeoSeeder] Complete! Successfully populated \({geojson.features.length} wards for\){district}.`);
  } catch (error: any) {
    console.error('[GeoSeeder Error]:', error.message);
  } finally {
    await pool.end();
  }
}

// Accepts any file path from command line arguments, defaults to begusarai sample
const targetFile = process.argv[2] || 'src/db/begusarai-sample.json';
seedDynamicDistrict(targetFile);