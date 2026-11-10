/** Verarbeitet Radial-Menu-Aktionen vom Floor. */
import type { MenuAction } from './floor-actions';
import { worldStore } from '../store/use-world-store';

export function handleFloorInteract(action: MenuAction): void {
    const targetId = action.targetId;
    switch (action.id) {
        case 'MOVE_HERE': if (action.point) worldStore.queue.enqueueMove(action.point); break;
        case 'CLEAN_STAIN': worldStore.queue.enqueueCleanStain(targetId!); break;
        case 'CLEAN_ROOM': worldStore.queue.enqueueCleanRoom(); break;
        case 'TAKE_DRINK': worldStore.takeDrink(targetId); break;
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
    }
}
