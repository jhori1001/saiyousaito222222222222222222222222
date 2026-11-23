# AIM PROTOCOL — タクティカルFPS向けエイムトレーナー (プロトタイプ)

VALORANT の操作感（感度・FOV・移動/ストッピング・射撃精度）をブラウザで再現することを目指した
エイム練習用 3D FPS のプロトタイプです。**素材・マップ・名称はすべてオリジナル/仮素材**で、
公式アセットは一切使用していません。

## 起動方法

```bash
npm install
npm run dev
```

ブラウザ (Chrome / Edge) で **http://localhost:5173/** を開き、「クリックして開始」を押します。

その他: `npm test`（ユニットテスト） / `npm run build`（型チェック＋本番ビルド → `dist/`） / `npm run preview`

## 操作

| キー | 動作 |
|---|---|
| マウス | 視点 |
| 左クリック / 右クリック | 射撃 / ADS・スコープ |
| W A S D | 移動 |
| Shift / Ctrl (または C) / Space | 歩き / しゃがみ / ジャンプ |
| R / 1〜6 | リロード / 武器切替 |
| ESC | メニュー（モード変更・設定・結果） |

> Ctrl+W はブラウザがタブを閉じるため、通常はページ側で止められません。設定の
> 「フルスクリーン + キーボードロック」を有効にするか、しゃがみに **C** を使ってください。

## 構成

```
src/
  config/      数値の一元管理（出典タグ付き） reference / movement / weapons / provenance
  core/        Game (128Hz固定tick・描画), Input (Pointer Lock raw入力), Settings (localStorage)
  physics/     AABB・レイキャスト・衝突ワールド（グリッド分割）
  player/      PlayerController（摩擦+加速モデル、段差、しゃがみ、ジャンプ）
  weapons/     WeaponState（連射・拡散・リコイル・回復）, ViewModel, Effects（弾痕・着弾・トレーサー）
  bots/        Bot（回転対応ヒットボックス 頭/胴/脚）, BotBehaviors（戦略パターン）, BotManager
  map/         MapData（エンジン非依存のマップ形式）, MapLoader, maps/trainingGround（オリジナル）
  modes/       PracticeMode インターフェース, FreePractice / FlickMode / StoppingMode
  stats/       命中率・HS率・撃破時間・移動/停止別命中率
  ui/          HUD, Crosshair, Menu
  audio/       合成音（外部音源なし）
tests/         ユニットテスト (vitest)
docs/VALUES.md 数値の出典区分一覧
```

## 拡張ポイント

- **マップ差し替え**: `MapData` 形式に変換すれば読み込み可能。`license` フィールドで権利状態を管理。
- **BOT AI**: `BotBehavior` インターフェースを実装（ピーク、撃ち返し、難易度別など）。
- **練習モード**: `PracticeMode` を実装して `Game.setMode` に登録。
- **武器名・素材**: `referenceName` と表示名を分離済み。許諾取得後に差し替え可能。
- **デスクトップ移植**: 描画/入力以外（physics, player, weapons/WeaponState, config）は DOM 非依存。
