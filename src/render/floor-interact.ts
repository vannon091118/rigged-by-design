/** Verarbeitet Radial-Menu-Aktionen vom Floor. */
import { worldStore } from '../store/use-world-store';

export function handleFloorInteract(actionId: string, targetId?: number): void {
    switch (actionId) {
        case 'CLEAN_STAIN': worldStore.cleanStain(targetId!); break;
        case 'TAKE_DRINK': worldStore.takeDrink(targetId); break;
        case 'SERVE_DRINK': worldStore.serveDrink(targetId!); break;
        case 'GET_MOP': worldStore.getMopAtToilet(targetId); break;
        case 'DROP_MOP': worldStore.dropMop(); break;
        case 'GET_DRINKS': worldStore.orderDrinks(1); break;
        case 'GET_PARTS': worldStore.orderParts(1); break;
        case 'PICKUP_CRATE': worldStore.pickup(targetId!); break;
        case 'SERVE_DESK': worldStore.serveDesk(); break;
        case 'TALK': worldStore.talk(targetId!); break;
        case 'CALM': worldStore.calm(targetId!); break;
        case 'FIGHT': worldStore.fightBrawl(targetId!); break;
    }
}
