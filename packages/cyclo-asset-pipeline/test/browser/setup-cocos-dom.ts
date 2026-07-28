const gameFrame = document.createElement('div');
gameFrame.id = 'GameDiv';

const gameContainer = document.createElement('div');
gameContainer.id = 'Cocos3dGameContainer';

const gameCanvas = document.createElement('canvas');
gameCanvas.id = 'GameCanvas';

gameContainer.appendChild(gameCanvas);
gameFrame.appendChild(gameContainer);
document.body.appendChild(gameFrame);
