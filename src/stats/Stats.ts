import type { HitZone } from '../bots/Bot';

export interface ShotRecord {
  time: number;
  speed: number; // m/s at fire time
  spreadDeg: number;
  moving: boolean; // above the accurate-speed threshold
  hit: HitZone | null;
}

export class Stats {
  shots = 0;
  hits = 0;
  head = 0;
  body = 0;
  leg = 0;
  kills = 0;
  damage = 0;
  elapsed = 0;
  /** Time from target spawn to kill (s). */
  killTimes: number[] = [];
  shotLog: ShotRecord[] = [];

  reset(): void {
    this.shots = this.hits = this.head = this.body = this.leg = this.kills = this.damage = 0;
    this.elapsed = 0;
    this.killTimes = [];
    this.shotLog = [];
  }

  recordShot(rec: ShotRecord): void {
    this.shots++;
    if (rec.hit) {
      this.hits++;
      this[rec.hit]++;
    }
    this.shotLog.push(rec);
    if (this.shotLog.length > 2000) this.shotLog.shift();
  }

  get accuracy(): number { return this.shots ? this.hits / this.shots : 0; }
  get hsRate(): number { return this.hits ? this.head / this.hits : 0; }
  get avgKillTime(): number {
    return this.killTimes.length ? this.killTimes.reduce((a, b) => a + b, 0) / this.killTimes.length : 0;
  }

  /** Accuracy split for stopping analysis. */
  movingSplit() {
    const still = this.shotLog.filter((s) => !s.moving);
    const moving = this.shotLog.filter((s) => s.moving);
    const acc = (a: ShotRecord[]) => (a.length ? a.filter((s) => s.hit).length / a.length : 0);
    return { stillShots: still.length, stillAcc: acc(still), movingShots: moving.length, movingAcc: acc(moving) };
  }
}
