# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# 糖化アンケート作成ツール

糖化に関するアンケートを作成・管理するためのシステムです。

---

## 📖 操作マニュアル

### 基本的な使い方

1. https://touka-survey.vercel.app にアクセス
2. 「リストから選択」で医療機関を選ぶ
3. QRコードが自動生成される
4. 「印刷 / PDF保存」ボタンでアンケートを印刷

---

### 医療機関リストの管理

#### 設定画面を開く

1. 画面右上の **「設定」** ボタンをクリック
2. 「詳細設定」パネルが開く
3. 「医療機関リスト管理」セクションで操作

---

#### 医療機関を追加する

1. 「新しい医療機関名を入力...」欄に名前を入力
2. **「+ 追加」** ボタンをクリック
3. リストに追加され、スプレッドシートとGoogleフォームも自動更新

```
┌─────────────────────────────────────┬──────────┐
│ 新しい医療機関名を入力...            │ + 追加   │
└─────────────────────────────────────┴──────────┘
```

---

#### 医療機関名を編集する

1. 編集したい医療機関にマウスを合わせる
2. 右側に表示される **鉛筆アイコン（✏️）** をクリック
3. 名前を編集
4. **保存アイコン（💾）** をクリック、またはEnterキーを押す

```
┌─────────────────────────────────────┬─────┬─────┐
│ 北大附属病院                         │ ✏️  │ 🗑️  │
└─────────────────────────────────────┴─────┴─────┘
```

---

#### 医療機関を削除する

1. 削除したい医療機関にマウスを合わせる
2. 右側に表示される **ゴミ箱アイコン（🗑️）** をクリック
3. 確認ダイアログで「OK」をクリック

⚠️ **注意**: 削除するとスプレッドシートとGoogleフォームの選択肢からも削除されます

---

#### リストを更新する

他の人が追加・編集した内容を反映するには：

1. 「医療機関リスト管理」の横にある **「🔄 更新」** をクリック
2. 最新のリストが読み込まれる

---

### 印刷・PDF保存

1. 医療機関を選択（リストから選択 または 手入力）
2. QRコードが生成されたことを確認
3. **「印刷 / PDF保存」** ボタンをクリック
4. 印刷ダイアログが開く
   - **印刷**: プリンターを選択して印刷
   - **PDF保存**: 「PDFに保存」を選択

---

### URLのコピー・共有

生成されたフォームURLを共有したい場合：

1. 医療機関を選択
2. 「生成されたフォームURL」欄の横にある **「コピー」** ボタンをクリック
3. URLがクリップボードにコピーされる
4. メールやチャットに貼り付けて共有

---

## 🌐 URL

| 項目 | URL |
|------|-----|
| Reactアプリ | https://touka-survey.vercel.app |
| GitHub | https://github.com/hashimoto-hiroyuki/touka-survey |

---

## 📊 システム構成図

```
┌─────────────────────────────────────────────────────────────────────┐
│                        データ管理層                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [スプレッドシート①]                [スプレッドシート②]               │
│   医療機関リスト                     フォーム回答データ                │
│   ├─ 医療機関名の追加/編集/削除       ├─ 回答が自動保存                │
│   └─ Apps Scriptと連携               └─ 質問追加時、列が自動追加      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                    │                           ↑
                    ↓                           │
┌─────────────────────────────────────────────────────────────────────┐
│                        サーバー層                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Google Apps Script]  ← Web App（デプロイURLで公開）                │
│   ├─ 医療機関リスト取得 (getHospitalList)                            │
│   ├─ 医療機関追加/編集/削除                                          │
│   ├─ Googleフォームの選択肢を自動同期                                 │
│   └─ rebuildFullForm() ← 質問追加時はここも更新                      │
│                                                                     │
│  【設定】                                                            │
│   ├─ アクセスできるユーザー: 全員                                     │
│   └─ デプロイURL → ReactアプリのAPI_URLと一致させる                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      フロントエンド層                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Googleフォーム]                   [Reactアプリ（Vercel）]          │
│   ├─ オンライン回答用                ├─ 紙アンケート印刷用            │
│   ├─ 質問の追加/編集                 ├─ 医療機関ドロップダウン選択     │
│   ├─ 回答→スプレッドシート②に保存    ├─ prefill URL自動生成          │
│   └─ 選択肢はApps Scriptと同期       ├─ QRコード生成                 │
│                                      └─ PDF印刷                     │
│                                                                     │
│  【ファイル】                                                        │
│   └─ SurveyEditor.jsx                                               │
│       ├─ API_URL ← デプロイURLと一致させる                           │
│       └─ 質問追加時は印刷レイアウトも更新                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        バックアップ                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [GitHub]                                                           │
│   ├─ src/SurveyEditor.jsx  ← Reactアプリのソース                     │
│   └─ Code.gs               ← Apps Scriptのバックアップ               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✏️ 質問を追加する時の変更箇所チェックリスト

| # | 変更箇所 | 作業内容 | 必須 |
|---|----------|----------|------|
| 1 | **Googleフォーム** | 質問を追加 | ✅ |
| 2 | **SurveyEditor.jsx** | 紙アンケートのレイアウトに質問を追加 | ✅ |
| 3 | **Code.gs** | rebuildFullForm()に質問を追加、番号修正 | ⚠️ 推奨 |
| 4 | **Apps Script デプロイ** | 新バージョンをデプロイ | ⚠️ Code.gs変更時 |
| 5 | **SurveyEditor.jsx API_URL** | デプロイURLが変わった場合のみ更新 | ⚠️ URL変更時 |
| 6 | **GitHub** | 変更したファイルをコミット | ⚠️ 推奨 |
| 7 | **スプレッドシート（回答）** | 変更不要（列は自動追加） | ー |
| 8 | **スプレッドシート（医療機関）** | 変更不要 | ー |

---

## 📁 ファイル構成

```
touka-survey/
├── src/
│   └── SurveyEditor.jsx   # メインのReactコンポーネント
├── public/
├── Code.gs                 # Google Apps Script（バックアップ）
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## 💾 ファイルの保存場所

### GitHub / Vercel にあるもの（ソースコード）

| ファイル | 説明 |
|----------|------|
| src/SurveyEditor.jsx | 紙アンケート印刷アプリ |
| Code.gs | Apps Scriptのバックアップ |
| README.md | ドキュメント |
| index.html | HTMLテンプレート |
| package.json | 依存関係 |
| vite.config.js | ビルド設定 |

### Googleドライブにあるもの（クラウド上）

| ファイル | 説明 |
|----------|------|
| **Googleフォーム** | オンライン回答用フォーム |
| **Google Apps Script** | サーバー処理（API）※実際に動作する本体 |
| **スプレッドシート①** | 医療機関リスト |
| **スプレッドシート②** | フォーム回答データ |

### 図で表すと

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   GitHub / Vercel           │     │   Googleドライブ             │
│   (ソースコード)             │     │   (データ・フォーム)          │
├─────────────────────────────┤     ├─────────────────────────────┤
│ ・SurveyEditor.jsx          │     │ ・Googleフォーム             │
│ ・Code.gs (バックアップ)     │     │ ・Google Apps Script         │
│ ・README.md                 │     │ ・スプレッドシート①          │
│ ・package.json              │     │   (医療機関リスト)           │
│ ・index.html                │     │ ・スプレッドシート②          │
│ ・vite.config.js            │     │   (回答データ)              │
└─────────────────────────────┘     └─────────────────────────────┘
```

### ⚠️ 注意

**Google Apps Script（Code.gs）** は2箇所にあります：
- **Googleドライブ**: 実際に動作している本体 → 変更はここで行う
- **GitHub**: バックアップ用のコピー → 変更後にコピーを保存

---

## 🔧 技術スタック

- **フロントエンド**: React + Vite
- **ホスティング**: Vercel
- **バックエンド**: Google Apps Script
- **データベース**: Google スプレッドシート
- **フォーム**: Google フォーム

---

## 📝 更新履歴

| 日付 | 内容 |
|------|------|
| 2026/01/07 | 血液型の質問を追加 |
| 2026/01/07 | A4 1枚に収まるようレイアウト調整 |
| 2026/01/07 | アクセス権限を「全員」に変更 |
