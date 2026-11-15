/**
 * Rollenkatalog des Spieler-Arbeitsmarkts: welche Einstiegsrollen ein
 * Betriebstyp anbietet, mit Skill-Anforderung, Lohn und Aufgabendauer.
 *
 * Reine Daten, damit `player-job-market.ts` im Logik-Budget bleibt; die
 * Ableitung der offenen Stellen steht dort.
 */
import type { BuildingKind } from './building-types';
import type { PlayerSkillId } from './player-skills';

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

/** Katalog der spielbaren Rollen nach Gebäudetyp. */
export const ROLE_CATALOG: Record<BuildingKind, JobRole[]> = {
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
