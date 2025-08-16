// Portal entity and interaction logic

export function createPortal(map, x, y) {
    return {
        x: x,
        y: y,
        type: 'portal'
    };
}

export function checkPortalInteraction(playerX, playerY, portal) {
    // Only check if player is actually at the portal position
    return playerX === portal.x && playerY === portal.y;
}
