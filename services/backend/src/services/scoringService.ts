// Strict union mirroring the PostgreSQL asset_sector enum
export type AssetSector =
  | 'drainage'
  | 'water_supply'
  | 'roads'
  | 'electrical'
  | 'solid_waste'
  | 'unknown';

export interface SectorWeightConfig {
  base: number;
  multiplier: number;
}

export interface ScoringFactors {
  vulnerabilityIndex: number;
  incidentCount: number;
  assetSector: string;
}

export interface ScoringResult {
  vpsScore: number;
  saiScore: number;
  isShadowAlert: boolean;
}

export class ScoringService {
  /**
   * Exhaustive map: TypeScript ensures every AssetSector key is present
   * and conforms strictly to SectorWeightConfig.
   */
  private static readonly SECTOR_WEIGHTS: Record<AssetSector, SectorWeightConfig> = {
    drainage: { base: 0.75, multiplier: 1.20 },
    water_supply: { base: 0.85, multiplier: 1.30 },
    roads: { base: 0.50, multiplier: 1.00 },
    electrical: { base: 0.60, multiplier: 1.15 },
    solid_waste: { base: 0.45, multiplier: 0.95 },
    unknown: { base: 0.50, multiplier: 1.00 },
  };

  /**
   * Formats and clamps values safely to the PostgreSQL numeric(4,3) bounds [0.000, 1.000].
   */
  private static formatScore(value: number): number {
    const clamped = Math.min(Math.max(value, 0.0), 1.0);
    return Number(clamped.toFixed(3));
  }

  /**
   * Runtime type guard to safely index into the exhaustive configuration map.
   */
  private static isAssetSector(sector: string): sector is AssetSector {
    return sector in ScoringService.SECTOR_WEIGHTS;
  }

  public static calculateScores(factors: ScoringFactors): ScoringResult {
    const { vulnerabilityIndex, incidentCount, assetSector } = factors;

    const normalized = (assetSector || 'unknown').toLowerCase().trim();
    const sectorKey: AssetSector = this.isAssetSector(normalized) ? normalized : 'unknown';
    const config = this.SECTOR_WEIGHTS[sectorKey];

    const cleanVulnerability = Math.min(Math.max(vulnerabilityIndex, 0.0), 1.0);
    const count = Math.max(incidentCount, 1);

    // 1. VPS Formula: Baseline (40%) + Ward Vulnerability (35%) + Log-Dampened Volume (25%)
    const volumeScore = Math.min(count, 10) * 0.025;
    const rawVps = (config.base * 0.40) + (cleanVulnerability * 0.35) + volumeScore;
    const vpsScore = this.formatScore(rawVps);

    // 2. SAI Formula: VPS * (1 + ln(count) / 2.5) * Hazard Multiplier
    const logFactor = count > 1 ? Math.log(count) / 2.5 : 0;
    const rawSai = vpsScore * (1 + logFactor) * config.multiplier;
    const saiScore = this.formatScore(rawSai);

    // 3. Shadow Alert Threshold (SAI >= 0.750)
    const isShadowAlert = saiScore >= 0.750;

    return { vpsScore, saiScore, isShadowAlert };
  }
}