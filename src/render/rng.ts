/** Der eine Darstellungs-Strom: Partikel und Sound, nie der Spielzustand. */
import { presentationRng, presentationSeed } from '../core/rng/streams';

export const presentation = presentationRng(presentationSeed());
