# 完全！感染！Eggman！ Infection Battle

Canvas ベースのレトロ RPG 風感染シミュレーションバトルです。

## 起動

```sh
python3 -m http.server 5174
```

ブラウザで `http://127.0.0.1:5174/` を開きます。

## Version 1

- VS `nato-san`
- 感染率システム
- ピクセル化システム
- `eggmanウィルス`
- `マヨビーム`
- 体力システム
- 感染完了演出
- リザルト画面
- プレイヤー画像: `assets/player/eggman.png`

## 敵追加ルール

敵は `assets/enemies/<id>/` に追加します。

必要なファイル:

- `normal.png`
- `pixel.png`
- `eggman.png`
- `enemy.json`

`enemy.json` の例:

```json
{
  "id": "nato",
  "displayName": "nato-san",
  "level": 5,
  "startsPixelized": false,
  "virusResistance": 1.0,
  "images": {
    "normal": "assets/enemies/nato/normal.png",
    "pixel": "assets/enemies/nato/pixel.png",
    "eggman": "assets/enemies/nato/eggman.png"
  }
}
```

ピクセル族は `startsPixelized` を `true`、`virusResistance` を高めにします。

## 体力ルール

- `eggmanウィルス`: 体力を少し消費して感染率を上げます。
- `マヨビーム`: 体力を大きく消費して感染率を大幅に上げます。
- nato-san の反撃を受けると体力が減ります。
- 体力が足りない時は `マヨビーム` を撃てません。

## 設定ページ

`settings.html` で感染させられる側の名前と3段階の画像を変更できます。

- 感染前画像
- 感染第一段階（ピクセル化）
- Eggman化

設定はブラウザの `localStorage` に保存します。Vercel のような静的ホスティングでも動きますが、保存内容は使っているブラウザごとに分かれます。
