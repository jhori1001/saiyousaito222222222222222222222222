# 数値の出典区分 (Provenance)

全ての挙動パラメータは `src/config/*.ts` に集約され、各値に以下のタグが付いています。
**推定値 (estimate) を正確な再現値として扱わないでください。**

| タグ | 意味 |
|---|---|
| `official` | リファレンスゲームのゲーム内表示 / パッチノートで公開されている値（開発時点の知識。**現行パッチでの再確認が必要**） |
| `community` | 公式発表ではないが、コミュニティで計測・広く使用されている値 |
| `estimate` | 本プロジェクトの暫定値。**実機での計測・調整が必須** |

## 視点・基本

| 項目 | 値 | 区分 | ファイル |
|---|---|---|---|
| 感度係数 | 0.07°/count × 感度 | community | `config/reference.ts` |
| 水平FOV | 103° 固定 | official | `config/reference.ts` |
| シミュレーションレート | 128 Hz | official(サーバーtick) | `config/reference.ts` |
| スコープ時感度 | 感度 × 倍率 ÷ ズーム倍率 | estimate | `core/Game.ts` `look()` |

## 移動 (`config/movement.ts`)

| 項目 | 値 | 区分 |
|---|---|---|
| 走り速度 | 6.75 m/s | community |
| 歩き / しゃがみ倍率 | 0.6 / 0.5 | estimate |
| 加速・摩擦・stopSpeed | 11 / 9 / 1.5 | estimate |
| 重力 / ジャンプ初速 | 20 m/s² / 6.0 m/s | estimate |
| プレイヤー寸法・視点高さ | 1.75m / 目線1.6m 等 | estimate |

現在の設定での実測（ユニットテスト出力）: 最高速から「精度が戻る速度」まで
**キーを離すだけ: 約133ms / 逆キー(カウンターストレイフ): 約47ms**

## 武器 (`config/weapons.ts`)

| 武器(仮名) | 参考 | 連射/装弾/リロード/装備 | ダメージ | 初弾精度 |
|---|---|---|---|---|
| VR-9 Vanguard | ヴァンダル | official | official (160/40/34, 減衰なし) | official 0.25° |
| PX-4 Phalanx | ファントム | official | official (距離減衰3段) | official 0.2° |
| SR-6 Marshal | シェリフ | official | official | official 0.25° |
| GS-15 Wisp | ゴースト | official（装弾数は要確認） | official | official 0.3° |
| GD-12 Sentinel | ガーディアン | 連射速度は **estimate**（パッチで変動） | official | official 0.1° |
| OP-5 Longbow | オペレーター | official | official | スコープ時 estimate |

**全武器共通で estimate のもの:** リコイルパターンの形状、連射時の拡散増加、移動誤差（走り・歩き・空中）、
精度が戻る速度しきい値 (`accurateSpeedFrac`=走り速度の30%)、反動回復速度、視点キック比率、
しゃがみ補正、ADS補正、武器ごとの移動速度倍率。
