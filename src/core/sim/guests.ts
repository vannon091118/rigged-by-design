/** Fassade des Gastverhaltens: die Details liegen in kleinen, getrennten Modulen. */
export { moveGuest, releaseAndChoose } from './guest-core';
export { chooseActivity, startActivity } from './guest-choice';
export { actAtTarget } from './guest-play';
export { becomeAngry, leave, payAndLeave, targetedFurniture } from './guest-service';
