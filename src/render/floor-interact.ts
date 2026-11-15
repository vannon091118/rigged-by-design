/** Verarbeitet MenuAction-Aktionen vom Floor. */
import type { MenuAction } from './floor-actions';
import { worldStore } from '../store/use-world-store';

/**
 * Eine ID ohne Pfad ist ein Vertragsbruch, kein stiller Klick ohne Wirkung.
 * Dieselbe Meldung nutzt die Action-Registry in `ui/app-wiring`.
 */
export function unhandledMenuActionError(id: string): Error {
    return new Error(`MenuAction ohne ausfuehrbaren Handler: ${id}`);
}

export function handleFloorInteract(action: MenuAction): void {
    const targetId = action.targetId;
    switch (action.id) {
        case 'MOVE_HERE': if (action.point) worldStore.queue.enqueueMove(action.point); break;
        case 'CLEAN_STAIN': worldStore.queue.enqueueCleanStain(targetId!); break;
        case 'CLEAN_ROOM': worldStore.queue.enqueueCleanRoom(); break;
        case 'TAKE_DRINK': worldStore.takeDrink(targetId); break;
        case 'EAT_AT_HOME': worldStore.eatAtHome(); break;
        case 'DRINK_AT_HOME': worldStore.drinkAtHome(); break;
        case 'SERVE_DRINK': worldStore.serveDrink(targetId!); break;
        case 'GET_MOP': worldStore.queue.enqueueGetMop(); break;
        case 'DROP_MOP': worldStore.queue.enqueueReturnMop(); break;
        case 'PICKUP_MOP': worldStore.queue.enqueuePickupMop(targetId!); break;
        case 'GET_DRINKS': worldStore.orderDrinks(1); break;
        case 'GET_PARTS': worldStore.orderParts(1); break;
        case 'PICKUP_CRATE': worldStore.pickup(targetId!); break;
        case 'SERVE_DESK': worldStore.serveDesk(); break;
        case 'TALK': worldStore.talk(targetId!); break;
        case 'CALM': worldStore.calm(targetId!); break;
        case 'FIGHT': worldStore.fightBrawl(targetId!); break;
        // Der Weg zum Platz laeuft ueber den normalen Approach; hier wird nur
        // bestaetigt, dass die Figur steht. Ein Sitzzustand existiert nicht.
        case 'FOREIGN_SIT': worldStore.interaction.notify('Du stehst an deinem Platz im fremden Haus.'); break;
        // Hinweisaktionen im fremden Haus: sie nennen den Grund, statt zu verpuffen.
        case 'FOREIGN_LOOK':
        case 'FOREIGN_TALK': worldStore.interaction.notify(action.reason ?? action.label); break;
        default: throw unhandledMenuActionError(action.id);
    }
}
