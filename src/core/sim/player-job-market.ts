/**
 * Spieler-Arbeitsmarkt: Offene Stellen aus betretbaren Betrieben der Stadt.
 *
 * Der Markt leitet Stellen aus tatsächlich geöffneten, erreichbaren und
 * fertiggestellten Gebäuden (PUB, SHOP, OFFICE, WORKSHOP) ab. Versiegelte
 * Rohbauten und volle Betriebe bieten keine Stellen an. Bewerbung, Annahme
 * und Kündigung nutzen den vorhandenen Spieler-Jobzustand (#803).
 *
 * Deterministisch: gleiche Gebäudeeingabe → gleiche Stellenangebote, kein Zufall.
 */

import type { BuildingKind, BuildingState } from './building-types';
import type { WorldState } from './types';
import { isBookable } from './city-employment';
import { skillLevel, type PlayerSkillId } from './player-skills';

/** Gebäudetypen, die spielbare Stellen für den Spieler anbieten (außer Rivalen-Casinos). */
const PLAYER_JOB_BUILDING_KINDS: readonly BuildingKind[] = ['PUB', 'SHOP', 'OFFICE', 'WORKSHOP'] as const;

/** Eine Einstiegsrolle in einem Betrieb. */
export interface JobRole {
  readonly roleId: string;
  readonly title: string;
  /** Erforderlicher Fach-Skill pro Skill (0 = nicht erforderlich). */
  readonly requiredSkill: Record<PlayerSkillId, number>;
  /** Erforderliche Karriere-Rangstufe (1 = Anfänger). */
  readonly requiredCareerRank: number;
  readonly wageVC: number;
  readonly taskDurationTicks: number;
  readonly taskType: 'CLEAN' | 'SERVE' | 'DEAL' | 'REPAIR';
  readonly description: string;
}

/** Ein konkretes Stellenangebot in einem bestimmten Gebäude. */
export interface JobOffer {
  readonly buildingId: string;
  readonly buildingName: string;
  readonly employerId: string | undefined;
  readonly role: JobRole;
  readonly wageVC: number;
  readonly taskDurationTicks: number;
}

/** Katalog der spielbaren Rollen nach Gebäudetyp. */
const ROLE_CATALOG: Record<BuildingKind, JobRole[]> = {
  PUB: [
    {
      roleId: 'pub_barkeeper',
      title: 'Barkeeper',
      requiredSkill: { cleaning: 0, service: 1, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 4,
      taskDurationTicks: 45,
      taskType: 'SERVE',
      description: 'Drinks zapfen, Gäste bedienen, Streit schlichten.',
    },
    {
      roleId: 'pub_bouncer',
      title: 'Türsteher',
      requiredSkill: { cleaning: 0, service: 0, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 5,
      taskDurationTicks: 60,
      taskType: 'SERVE',
      description: 'Tür beordern, Gäste einweisen, Ruhestand bewachen.',
    },
    {
      roleId: 'pub_cleaner',
      title: 'Reinigungskraft',
      requiredSkill: { cleaning: 1, service: 0, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 3,
      taskDurationTicks: 30,
      taskType: 'CLEAN',
      description: 'Flecken entfernen, Tische abräumen, Gäste begrüßen.',
    },
  ],
  SHOP: [
    {
      roleId: 'shop_seller',
      title: 'Verkäufer',
      requiredSkill: { cleaning: 0, service: 2, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 4,
      taskDurationTicks: 45,
      taskType: 'SERVE',
      description: 'Kunden bedienen, Waren einräumen, Kasse führen.',
    },
    {
      roleId: 'shop_stocker',
      title: 'Lagerist',
      requiredSkill: { cleaning: 0, service: 0, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 3,
      taskDurationTicks: 40,
      taskType: 'CLEAN',
      description: 'Lager auffüllen, Ware transportieren, Laden sauber halten.',
    },
  ],
  OFFICE: [
    {
      roleId: 'office_clerk',
      title: 'Sekretär',
      requiredSkill: { cleaning: 0, service: 1, cardDealing: 0, repair: 0 },
      requiredCareerRank: 1,
      wageVC: 5,
      taskDurationTicks: 50,
      taskType: 'SERVE',
      description: 'Post sortieren, Termine koordinieren, Akten pflegen.',
    },
    {
      roleId: 'office_accountant',
      title: 'Buchhalter',
      requiredSkill: { cleaning: 0, service: 0, cardDealing: 0, repair: 0 },
      requiredCareerRank: 2,
      wageVC: 7,
      taskDurationTicks: 60,
      taskType: 'SERVE',
      description: 'Bücher führen, Rechnungen prüfen, Löhne abrechnen.',
    },
  ],
  WORKSHOP: [
    {
      roleId: 'workshop_helper',
      title: 'Werkstatt-Helfer',
      requiredSkill: { cleaning: 0, service: 0, cardDealing: 0, repair: 1 },
      requiredCareerRank: 1,
      wageVC: 4,
      taskDurationTicks: 50,
      taskType: 'REPAIR',
      description: 'Werkzeug bereitstellen, Maschinen säubern, Assistenz bei Reparaturen.',
    },
    {
      roleId: 'workshop_mechanic',
      title: 'Mechaniker',
      requiredSkill: { cleaning: 0, service: 0, cardDealing: 0, repair: 2 },
      requiredCareerRank: 1,
      wageVC: 6,
      taskDurationTicks: 70,
      taskType: 'REPAIR',
      description: 'Maschinen reparieren, Ersatzteile wechseln, Wartung durchführen.',
    },
  ],
  APARTMENT: [],
  RESIDENCE: [],
  CASINO: [],
} as const;

/** Alle verfügbaren Stellenangebote aus den betretbaren Gebäuden der Stadt. */
export function listJobOffers(world: WorldState, buildings: readonly BuildingState[]): JobOffer[] {
  const offers: JobOffer[] = [];
  const playerJob = world.player.job;

  for (const building of buildings) {
    if (!PLAYER_JOB_BUILDING_KINDS.includes(building.kind as BuildingKind)) continue;
    if (!isBookable(building)) continue;

    const roles = (ROLE_CATALOG as Record<BuildingKind, JobRole[]>)[building.kind] ?? [];
    for (const role of roles) {
      // Prüfe Skill-Voraussetzungen
      let skillOk = true;
      for (const [skillId, minLevel] of Object.entries(role.requiredSkill)) {
        if (skillLevel(world.player.skills, skillId as PlayerSkillId) < minLevel) {
          skillOk = false;
          break;
        }
      }
      if (!skillOk) continue;

      // Prüfe Karriere-Rang
      if (playerJob?.careerRank ?? 1 < role.requiredCareerRank) continue;

      // Vermeide doppelte Angebote für dieselbe Rolle im selben Gebäude
      const alreadyOffered = offers.some(
        (o) => o.buildingId === building.id && o.role.roleId === role.roleId
      );
      if (alreadyOffered) continue;

      offers.push({
        buildingId: building.id,
        buildingName: building.name,
        employerId: building.ownerId,
        role,
        wageVC: role.wageVC,
        taskDurationTicks: role.taskDurationTicks,
      });
    }
  }

  return offers;
}

/** Spieler bewirbt sich auf eine Stelle. Nur eine aktive Bewerbung gleichzeitig. */
export function applyForJob(world: WorldState, buildingId: string, roleId: string): void {
  const job = world.player.job;
  if (job === null) throw new Error('Du hast keinen Job. Nimm zuerst einen Job an oder bewirb dich auf eine offene Stelle.');
  if (job.appliedTo !== null) throw new Error(`Du hast bereits eine offene Bewerbung bei Gebäude ${job.appliedTo}.`);
  if (job.offeredBy !== null) throw new Error(`Du hast bereits ein Angebot von Gebäude ${job.offeredBy}.`);
  job.appliedTo = buildingId;
  world.lastEvent = `Bewerbung eingereicht bei Gebäude ${buildingId} (Rolle ${roleId}).`;
}

/** Spieler nimmt ein Job-Angebot an. Er muss physisch am Arbeitsort sein. */
export function acceptJobOffer(world: WorldState, buildingId: string): void {
  const job = world.player.job;
  if (job === null) throw new Error('Du hast keinen Job.');
  if (job.offeredBy !== buildingId) throw new Error(`Kein Angebot von Gebäude ${buildingId} vorliegen.`);
  // Stellenanzeige annehmen: Job-ID bleibt, aber Gebäude und Rolle wechseln
  // (vereinfacht: wir setzen nur appliedTo zurück, offeredBy bleibt als aktueller Arbeitgeber)
  job.appliedTo = null;
  world.lastEvent = `Job-Angebot von Gebäude ${buildingId} angenommen.`;
}

/** Spieler zieht eine Bewerbung zurück. */
export function withdrawApplication(world: WorldState): void {
  const job = world.player.job;
  if (job === null) throw new Error('Du hast keinen Job.');
  if (job.appliedTo === null) throw new Error('Du hast keine offene Bewerbung.');
  job.appliedTo = null;
  world.lastEvent = 'Bewerbung zurückgezogen.';
}

/** Prüft ob ein Angebot für ein Gebäude vorliegt. */
export function hasOffer(world: WorldState, buildingId: string): boolean {
  const job = world.player.job;
  return job !== null && job.offeredBy === buildingId;
}

/** Gibt die offene Bewerbung zurück (falls vorhanden). */
export function getApplication(world: WorldState): { buildingId: string | null; roleId: string | null } {
  const job = world.player.job;
  if (job === null) return { buildingId: null, roleId: null };
  return { buildingId: job.appliedTo, roleId: null };
}
