import { AssetSector } from './scoringService';

export interface SOWMemo {
  workOrderRef: string;
  classification: string;
  suggestedAction: string;
  requiredEquipment: string[];
  estimatedResolutionHours: number;
  generatedAt: string;
}

export interface PlaybookConfig {
  headline: string;
  rootCause: string;
  action: string;
  equipment: string[];
  hours: number;
}

export class SOWService {
  private static readonly PLAYBOOKS: Record<AssetSector, PlaybookConfig> = {
    water_supply: {
      headline: 'Severe Potable Water Pipeline Breach / Contamination Risk',
      rootCause: 'Suspected distribution line shear, joint failure, or high-pressure main leakage.',
      action: 'Isolate upstream isolation valve, deploy hydraulic excavation crew, and perform pipe repair/replacement.',
      equipment: ['Excavator', 'Dewatering Pump', 'Butt-fusion welder / Pipe clamps', 'Chlorine testing kit'],
      hours: 12,
    },
    drainage: {
      headline: 'Critical Drainage Network Siltation / Surface Inundation',
      rootCause: 'Solid waste blockages or trunk culvert sediment accumulation causing surface water stagnation.',
      action: 'Mobilize super-sucker de-silting machines and clear downstream outflow culverts.',
      equipment: ['Super Sucker Truck', 'High-pressure Jetting Machine', 'Sludge containment bags'],
      hours: 8,
    },
    roads: {
      headline: 'High-Hazard Carriageway Deformation / Deep Pothole Array',
      rootCause: 'Sub-base erosion and heavy axle load degradation during waterlogging.',
      action: 'Mill degraded bituminous layer, backfill sub-base with aggregate, and lay hot-mix asphalt.',
      equipment: ['Asphalt Roller', 'Hot-mix Bitumen Batcher', 'Pneumatic Jackhammer'],
      hours: 24,
    },
    electrical: {
      headline: 'Public Danger: Low-Tension Feeder Fault / Exposed Wiring',
      rootCause: 'Insulation deterioration, overhead line sag, or short-circuit in local distribution box.',
      action: 'De-energize feeder line, replace burnt conductors, and waterproof pole feeder junction box.',
      equipment: ['Boom Lift Truck', 'Insulated safety tools', 'Digital Multimeter / Megger tester'],
      hours: 4,
    },
    solid_waste: {
      headline: 'Uncontrolled Municipal Waste Dumping / Micro-biohazard',
      rootCause: 'Uncollected community dumping point overflowing beyond container threshold.',
      action: 'Deploy compactor vehicle, clear periphery debris, and spray sanitizing lime solution.',
      equipment: ['Hydraulic Refuse Compactor', 'Skid Steer Loader', 'Lime/bleach disinfectant spray'],
      hours: 6,
    },
    unknown: {
      headline: 'Civic Disruption Requiring Field Inspection',
      rootCause: 'Multiple citizen reports received; precise asset category awaiting engineering triage.',
      action: 'Dispatch ward junior engineer for rapid physical inspection and sector validation.',
      equipment: ['Field Inspection Kit', 'GIS Handheld Logger'],
      hours: 48,
    },
  };

  private static isAssetSector(sector: string): sector is AssetSector {
    return sector in SOWService.PLAYBOOKS;
  }

  public static generateMemo(
    clusterId: string,
    assetSector: string
  ): {
    headline: string;
    rootCause: string;
    sowMemo: SOWMemo;
  } {
    const normalized = (assetSector || 'unknown').toLowerCase().trim();
    const sectorKey: AssetSector = this.isAssetSector(normalized) ? normalized : 'unknown';
    const playbook = this.PLAYBOOKS[sectorKey];

    const cleanClusterId = clusterId ? clusterId.replace(/-/g, '').slice(0, 8).toUpperCase() : 'UNKNOWN';
    const workOrderRef = `WO-\({assetSector.toUpperCase().slice(0, 4)}-\){clusterId.slice(0, 8).toUpperCase()}`;

    return {
      headline: playbook.headline,
      rootCause: playbook.rootCause,
      sowMemo: {
        workOrderRef,
        classification: sectorKey,
        suggestedAction: playbook.action,
        requiredEquipment: playbook.equipment,
        estimatedResolutionHours: playbook.hours,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}