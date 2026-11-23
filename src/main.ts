import './styles.css';
import { Game } from './core/Game';
import { loadSettings } from './core/Settings';
import { trainingGround } from './map/maps/trainingGround';
import { Menu } from './ui/Menu';

const app = document.getElementById('app')!;
const settings = loadSettings();

let game: Game;
try {
  game = new Game(app, settings, trainingGround);
} catch (e) {
  app.innerHTML = `<div class="fatal">WebGLの初期化に失敗しました。ハードウェアアクセラレーションが有効なChrome/Edgeで開いてください。<pre>${String(e)}</pre></div>`;
  throw e;
}

const menu = new Menu(app, game);
game.onLockChange = (locked) => menu.setVisible(!locked);
game.onFinish = () => menu.setVisible(true);

// Clicking the canvas while the menu is hidden but unlocked (e.g. after alt-tab) re-locks.
game.renderer.domElement.addEventListener('click', () => {
  if (!game.input.locked && menu.root.style.display === 'none') void menu.start();
});

// Debug / test hook (used by automated browser tests).
(window as unknown as { __aim: unknown }).__aim = { game, menu };
