import * as THREE from 'three';
import { Sound } from '../audio/Sound';
import { BotManager } from '../bots/BotManager';
import { MOVEMENT } from '../config/movement';
import { REFERENCE } from '../config/reference';
import { damageAt, WEAPON_BY_ID, WEAPONS, type WeaponDef } from '../config/weapons';
import { type LoadedMap, loadMap } from '../map/MapLoader';
import type { MapData } from '../map/MapData';
import { FlickMode } from '../modes/FlickMode';
import { FreePractice } from '../modes/FreePractice';
import type { ModeHost, PracticeMode } from '../modes/PracticeMode';
import { StoppingMode } from '../modes/StoppingMode';
import { PlayerController } from '../player/PlayerController';
import { Stats } from '../stats/Stats';
import { Crosshair } from '../ui/Crosshair';
import { HUD } from '../ui/HUD';
import { Effects } from '../weapons/Effects';
import { ViewModel } from '../weapons/ViewModel';
import { type FireContext, type ShotEvent, WeaponState } from '../weapons/WeaponState';
import { Input } from './Input';
import { type ModeId, radPerCount, saveSettings, type Settings } from './Settings';

const DEG = Math.PI / 180;
const TICK = 1 / REFERENCE.tickRate.value;

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly input: Input;
  readonly sound = new Sound();
  readonly stats = new Stats();
  readonly hud: HUD;
  readonly crosshair: Crosshair;
  readonly effects = new Effects();
  readonly viewModel = new ViewModel();

  map!: LoadedMap;
  player!: PlayerController;
  bots!: BotManager;
  mode!: PracticeMode;

  // Look state (radians). Updated directly from mouse events.
  yaw = 0;
  pitch = 0;
  private lookDxFrame = 0;
  private lookDyFrame = 0;
  private camRecoilYaw = 0;
  private camRecoilPitch = 0;

  weapons = new Map<string, WeaponState>();
  weapon!: WeaponState;
  ads = false;
  private zoom = 1;

  /** Simulation time (s), advances only while playing. */
  now = 0;
  private acc = 0;
  private lastFrame = performance.now();
  private prevPos = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  playing = false;
  finished = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private hudTime = 0;
  private stepDist = 0;
  private sun!: THREE.DirectionalLight;
  private rng = Math.random;

  onFinish: () => void = () => {};
  onLockChange: (locked: boolean) => void = () => {};

  constructor(private container: HTMLElement, public settings: Settings, mapData: MapData) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: settings.quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';

    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.03, 400);
    this.camera.rotation.order = 'YXZ';

    const overlay = document.createElement('div');
    overlay.className = 'overlay-layer';
    container.appendChild(overlay);
    this.hud = new HUD(overlay);
    this.crosshair = new Crosshair(overlay);
    this.crosshair.apply(settings.crosshair);

    this.input = new Input(this.renderer.domElement);
    this.input.onLook = (dx, dy) => this.look(dx, dy);
    this.input.onLockChange = (l) => {
      this.playing = l && !this.finished;
      this.lastFrame = performance.now();
      this.onLockChange(l);
    };

    this.setupScene(mapData);
    for (const def of WEAPONS) this.weapons.set(def.id, new WeaponState(def));
    this.equip(settings.weaponId, true);
    this.applySettings(settings);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.setMode(settings.mode);
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ setup

  private setupScene(mapData: MapData): void {
    const sky = mapData.sky;
    this.scene.background = Game.skyTexture(sky.top, sky.bottom);
    this.scene.fog = new THREE.Fog(sky.fog, sky.fogNear, sky.fogFar);
    this.scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x5a5a55, 1.3));
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
    this.sun.position.set(30, 60, 20);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 150;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);

    this.map = loadMap(mapData, this.renderer, this.settings.quality === 'high');
    this.scene.add(this.map.group);
    this.player = new PlayerController(this.map.world);
    this.bots = new BotManager(mapData, this.map.world, this.rng);
    this.scene.add(this.bots.group);
    this.scene.add(this.effects.group);
  }

  private static skyTexture(top: number, bottom: number): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, `#${top.toString(16).padStart(6, '0')}`);
    grd.addColorStop(1, `#${bottom.toString(16).padStart(6, '0')}`);
    g.fillStyle = grd; g.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  applySettings(s: Settings): void {
    this.settings = s;
    saveSettings(s);
    this.crosshair.apply(s.crosshair);
    this.sound.volume = s.volume;
    const q = s.quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(1, dpr) * 0.75 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2));
    const shadows = q === 'high';
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    this.map.meshes.forEach((m) => { m.receiveShadow = shadows; m.castShadow = shadows; });
    this.scene.traverse((o) => { if ((o as THREE.Mesh).material) ((o as THREE.Mesh).material as THREE.Material).needsUpdate = true; });
    if (s.weaponId !== this.weapon?.def.id) this.equip(s.weaponId, true);
    this.resize();
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.updateFov();
  }

  /** Horizontal FOV is fixed (reference behaviour); vertical FOV derives from aspect. */
  private updateFov(): void {
    const hfov = REFERENCE.horizontalFovDeg.value * DEG;
    const zoomedHalf = Math.atan(Math.tan(hfov / 2) / this.zoom);
    const vfov = 2 * Math.atan(Math.tan(zoomedHalf) / this.camera.aspect);
    this.camera.fov = vfov / DEG;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ modes

  setMode(id: ModeId): void {
    this.mode = id === 'flick' ? new FlickMode() : id === 'stopping' ? new StoppingMode() : new FreePractice();
    this.restart();
  }

  restart(): void {
    this.finished = false;
    this.stats.reset();
    this.effects.clearDecals();
    for (const w of this.weapons.values()) { w.ammo = w.def.magSize.value; w.reloadLeft = 0; w.heat = 0; }
    this.mode.start(this.host);
    this.hud.set('mode', this.mode.label);
  }

  readonly host: ModeHost = makeHost(this);

  spawnPlayer(key: string): void {
    const sp = this.map.data.playerSpawns[key] ?? this.map.data.playerSpawns.default;
    this.player.teleport(sp.pos[0], sp.pos[1], sp.pos[2]);
    this.yaw = sp.yawDeg * DEG;
    this.pitch = 0;
    this.prevPos.set(this.player.pos.x, this.player.pos.y, this.player.pos.z);
    this.curPos.copy(this.prevPos);
  }

  finishSession(): void {
    this.finished = true;
    this.playing = false;
    this.input.unlock();
    this.onFinish();
  }

  // ------------------------------------------------------------------ input

  private look(dx: number, dy: number): void {
    if (!this.playing) return;
    let k = radPerCount(this.settings);
    if (this.ads && this.weapon.def.ads) k *= this.settings.scopedMultiplier / this.weapon.def.ads.zoom.value;
    this.yaw -= dx * k;
    this.pitch -= dy * k * (this.settings.invertY ? -1 : 1);
    const lim = REFERENCE.maxPitchDeg.value * DEG;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    this.lookDxFrame += dx;
    this.lookDyFrame += dy;
  }

  equip(id: string, instant = false): void {
    const st = this.weapons.get(id) ?? this.weapons.get(WEAPONS[0].id)!;
    if (this.weapon === st && !instant) return;
    if (this.weapon) this.weapon.reloadLeft = 0;
    this.weapon = st;
    st.equip();
    if (instant) st.equipLeft = 0;
    this.ads = false;
    this.viewModel.setWeapon(st.def);
    if (this.settings.weaponId !== st.def.id) { this.settings.weaponId = st.def.id; saveSettings(this.settings); }
  }

  eyePos(): THREE.Vector3 {
    const p = this.player.pos;
    return new THREE.Vector3(p.x, p.y + this.player.eyeHeight, p.z);
  }

  // ------------------------------------------------------------------ loop

  private frame = (t: number): void => {
    requestAnimationFrame(this.frame);
    let dt = (t - this.lastFrame) / 1000;
    this.lastFrame = t;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;

    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.hud.set('fps', `${Math.round(this.fpsFrames / this.fpsTime)} FPS`);
      this.fpsFrames = 0; this.fpsTime = 0;
    }

    if (this.playing) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK && steps < 32) {
        this.tick(TICK);
        this.acc -= TICK;
        steps++;
      }
      if (steps === 32) this.acc = 0;
    }
    this.render(dt);
  };

  /** Fixed-rate simulation step (128 Hz). */
  tick(dt: number): void {
    this.now += dt;
    const inp = this.input;
    const def = this.weapon.def;

    // weapon switching
    for (const w of WEAPONS) if (inp.consumePress(w.slotKey)) this.equip(w.id);
    if (inp.consumePress('KeyR') && this.weapon.startReload()) this.sound.reload();

    // ADS
    if (def.ads) {
      if (this.settings.adsMode === 'hold') this.ads = inp.mouseRight;
      else if (inp.consumeRightPress()) this.ads = !this.ads;
      if (this.weapon.reloading || this.weapon.equipping) this.ads = false;
    } else {
      this.ads = false;
      inp.consumeRightPress();
    }

    // movement
    const f = (inp.isDown('KeyW') ? 1 : 0) - (inp.isDown('KeyS') ? 1 : 0);
    const r = (inp.isDown('KeyD') ? 1 : 0) - (inp.isDown('KeyA') ? 1 : 0);
    const crouch = inp.isDown('ControlLeft') || inp.isDown('ControlRight') || inp.isDown('KeyC');
    const walk = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight');
    const jump = inp.consumePress('Space');
    const speedMult = def.moveSpeedMult.value * (this.ads && def.ads ? def.ads.moveMult.value : 1);
    this.prevPos.copy(this.curPos);
    this.player.step(dt, { forward: f, right: r, walk, crouch, jump, yaw: this.yaw, speedMult });
    this.curPos.set(this.player.pos.x, this.player.pos.y, this.player.pos.z);

    // footsteps (running only — walking/crouching is silent)
    const hs = this.player.horizontalSpeed;
    if (this.player.onGround && !walk && !crouch && hs > MOVEMENT.runSpeed.value * 0.7) {
      this.stepDist += hs * dt;
      if (this.stepDist > 2.2) { this.stepDist = 0; this.sound.step(); }
    }

    // shooting
    const trigger = inp.mouseLeft;
    const pressed = inp.consumeLeftPress();
    const ctx = this.fireContext();
    const ammoBefore = this.weapon.ammo;
    const wasReloading = this.weapon.reloading;
    const shots = this.weapon.tick(dt, trigger, pressed, ctx);
    if (pressed && shots.length === 0 && ammoBefore === 0 && !this.weapon.reloading) this.sound.empty();
    for (const s of shots) this.fire(s, hs);
    if (!wasReloading && this.weapon.reloading) this.sound.reload();

    // bots
    const eye = this.eyePos();
    const botCtx = { world: this.map.world, playerPos: eye, rng: this.rng, now: this.now, bounds: undefined as ReturnType<BotManager['zoneBounds']> };
    for (const b of this.bots.bots) {
      if (!b.alive) continue;
      botCtx.bounds = this.bots.zoneBounds(b.zoneId);
      b.behavior.update(b, dt, botCtx);
      b.hitFlash = Math.max(0, b.hitFlash - dt * 6);
    }

    if (!this.finished) this.stats.elapsed += dt;
    this.mode.tick(dt, this.host);
  }

  fireContext(): FireContext {
    const def = this.weapon.def;
    const run = MOVEMENT.runSpeed.value * def.moveSpeedMult.value;
    return {
      speedFrac: this.player.horizontalSpeed / run,
      walkFrac: MOVEMENT.walkMultiplier.value,
      onGround: this.player.onGround,
      crouched: this.player.crouchAmount > 0.5,
      ads: this.ads,
      infiniteAmmo: this.settings.infiniteAmmo,
      rng: this.rng,
    };
  }

  private dirFrom(yaw: number, pitch: number): THREE.Vector3 {
    const cp = Math.cos(pitch);
    return new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }

  /** Resolves one bullet as an instant hitscan ray. */
  private fire(shot: ShotEvent, speed: number): void {
    const yaw = this.yaw - shot.yawDeg * DEG;
    const pitch = this.pitch + shot.pitchDeg * DEG;
    const d = this.dirFrom(yaw, pitch);
    const o = this.eyePos();
    const maxDist = 500;
    const wh = this.map.world.raycast(o, d, maxDist);
    const bh = this.bots.raycast(o, d, wh ? wh.t : maxDist);
    const def = this.weapon.def;
    this.viewModel.fire();
    this.sound.shot(def.id === 'sniper_o');

    const muzzle = o.clone().addScaledVector(d, 0.6).add(new THREE.Vector3(0, -0.08, 0));
    let hitZone: 'head' | 'body' | 'leg' | null = null;
    if (bh) {
      const p = o.clone().addScaledVector(d, bh.t);
      const dmg = damageAt(def, bh.t, bh.zone);
      bh.bot.hp -= dmg;
      bh.bot.hitFlash = 1;
      hitZone = bh.zone;
      this.stats.damage += dmg;
      this.effects.puff(p, bh.zone === 'head' ? 0xffe066 : 0xff5544, bh.zone === 'head' ? 1.3 : 1);
      this.effects.tracer(muzzle, p);
      if (bh.bot.hp <= 0) {
        bh.bot.kill();
        this.stats.kills++;
        this.stats.killTimes.push(this.now - bh.bot.spawnTime);
        this.hud.hit('kill');
        this.sound.kill();
        this.mode.onKill(bh.bot, this.host);
      } else {
        this.hud.hit(bh.zone === 'head' ? 'head' : 'body');
        if (bh.zone === 'head') this.sound.hitHead(); else this.sound.hitBody();
      }
    } else if (wh) {
      const p = o.clone().addScaledVector(d, wh.t);
      const n = new THREE.Vector3(wh.nx, wh.ny, wh.nz);
      this.effects.decal(p, n);
      this.effects.puff(p.addScaledVector(n, 0.02), 0xcfc8b8, 0.7);
      this.effects.tracer(muzzle, p);
    }
    const accurateFrac = def.spread.accurateSpeedFrac.value;
    const run = MOVEMENT.runSpeed.value * def.moveSpeedMult.value;
    const rec = {
      time: this.now, speed, spreadDeg: shot.spreadDeg,
      moving: !this.player.onGround || speed > accurateFrac * run, hit: hitZone,
    };
    this.stats.recordShot(rec);
    this.mode.onShot(rec, this.host);
  }

  // ------------------------------------------------------------------ render

  private render(dt: number): void {
    const alpha = this.playing ? this.acc / TICK : 1;
    const p = this.prevPos.clone().lerp(this.curPos, alpha);
    const def = this.weapon.def;

    // camera recoil (visual kick only; the aim point is yaw/pitch)
    const [ry, rp] = this.weapon.currentRecoil(this.player.crouchAmount > 0.5, this.ads);
    const k = def.recoil.viewKick.value;
    const blend = Math.min(1, dt * 40);
    this.camRecoilYaw += (ry * k - this.camRecoilYaw) * blend;
    this.camRecoilPitch += (rp * k - this.camRecoilPitch) * blend;

    this.camera.position.set(p.x, p.y + this.player.eyeHeight - this.player.stepSmoothY, p.z);
    this.camera.rotation.set(this.pitch + this.camRecoilPitch * DEG, this.yaw - this.camRecoilYaw * DEG, 0);

    const targetZoom = this.ads && def.ads ? def.ads.zoom.value : 1;
    if (Math.abs(this.zoom - targetZoom) > 1e-4) {
      this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 20);
      if (Math.abs(this.zoom - targetZoom) < 0.002) this.zoom = targetZoom;
      this.updateFov();
    }

    for (const b of this.bots.bots) if (b.alive) b.syncMesh();
    this.effects.update(dt);
    const run = MOVEMENT.runSpeed.value * def.moveSpeedMult.value;
    this.viewModel.update(dt, {
      speedFrac: this.player.horizontalSpeed / run,
      onGround: this.player.onGround,
      lookDx: this.lookDxFrame, lookDy: this.lookDyFrame,
      ads: this.ads,
      reloadProgress: this.weapon.reloadProgress,
      equipProgress: this.weapon.equipping ? 1 - this.weapon.equipLeft / def.equipTime.value : 1,
      aspect: this.camera.aspect,
    });
    this.lookDxFrame = 0;
    this.lookDyFrame = 0;

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.viewModel.scene, this.viewModel.camera);

    this.hud.update(dt);
    this.hudTime += dt;
    if (this.hudTime > 1 / 30) { this.hudTime = 0; this.updateHud(); }
  }

  private updateHud(): void {
    const w = this.weapon, def = w.def, st = this.stats, h = this.hud;
    h.set('weapon', `${def.name}`);
    h.set('ammo', this.settings.infiniteAmmo ? '∞' : String(w.ammo));
    h.set('mag', `/${def.magSize.value}`);
    h.style('reloadbar', 'width', `${(w.reloading ? w.reloadProgress : 0) * 100}%`);
    h.set('wstate', w.reloading ? 'リロード中' : w.equipping ? '装備中' : this.ads ? 'ADS' : '');
    h.set('kills', String(st.kills));
    h.set('acc', `${(st.accuracy * 100).toFixed(1)}%`);
    h.set('hs', `${(st.hsRate * 100).toFixed(1)}%`);
    h.set('hp', '100');
    const tl = this.mode.timeLeft;
    const tt = tl !== null ? tl : st.elapsed;
    const mm = Math.floor(tt / 60), ss = Math.floor(tt % 60), cs = Math.floor((tt * 10) % 10);
    h.set('timer', `${mm}:${String(ss).padStart(2, '0')}${tl !== null ? '.' + cs : ''}`);

    const ctx = this.fireContext();
    const spread = w.currentSpread(ctx);
    const speed = this.player.horizontalSpeed;
    const accurate = this.player.onGround && ctx.speedFrac <= def.spread.accurateSpeedFrac.value;
    h.html('extra', this.mode.hud(this.host, { speed, spread, accurate }));
    if (this.settings.showSpeedometer && this.mode.id !== 'stopping') h.set('speedo', `${speed.toFixed(2)} m/s`);
    else h.set('speedo', '');

    // dynamic crosshair (firing error) in pixels
    const vh = this.renderer.domElement.clientHeight;
    const vfovHalf = (this.camera.fov * DEG) / 2;
    const px = (Math.tan(spread * DEG) / Math.tan(vfovHalf)) * (vh / 2);
    this.crosshair.layout(px);
    const scoped = !!(this.ads && def.ads?.scopeOverlay);
    h.style('scope', 'display', scoped ? 'block' : 'none');
    this.crosshair.setHidden(scoped);
  }

  // ------------------------------------------------------------------ public helpers

  weaponDefs(): WeaponDef[] { return WEAPONS; }
  weaponById(id: string): WeaponDef | undefined { return WEAPON_BY_ID[id]; }
}

function makeHost(g: Game): ModeHost {
  return {
    get settings() { return g.settings; },
    get bots() { return g.bots; },
    get stats() { return g.stats; },
    get map() { return g.map.data; },
    get now() { return g.now; },
    eye: () => g.eyePos(),
    yaw: () => g.yaw,
    spawnPlayer: (key: string) => g.spawnPlayer(key),
    finish: () => g.finishSession(),
  };
}
