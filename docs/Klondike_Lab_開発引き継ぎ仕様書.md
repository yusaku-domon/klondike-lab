# Klondike Lab 開発引き継ぎ仕様書

更新日: 2026-08-22  
対象: 別のAIエージェントおよび実装担当者  
位置づけ: クリック操作のみのKlondike MVPを実装するための着手用仕様

## 1. プロジェクト概要

Klondike Labは、ブラウザ上で動作するオフラインファーストのクロンダイク・ソリティアである。同じゲームを再現できるシード方式を採用し、将来の日替わりチャレンジや不具合再現につなげる。

### MVPの目的

- 一般的なクロンダイクを、マウスまたはタップのクリック操作だけで最後まで遊べる
- 通信切断後も起動・継続プレイできる
- ページ再読込やブラウザ再起動後も進行中ゲームを復元できる
- Undo、スコア、経過時間、シードによる盤面再現を備える
- ゲームルールをUIやPiniaから分離し、自動テスト可能にする

### 対象外

- ドラッグ＆ドロップ
- 3枚めくり
- オンライン対戦、ランキング、アカウント、サーバー同期
- 課金、広告
- ヒント、自動解答、必ず解ける盤面の生成
- 時間ペナルティおよびクリア時のタイムボーナス
- Undo履歴の永続化
- モバイル専用最適化（MVPはPC優先。ただしタップ操作を妨げない）

## 2. 採用技術

| 分類 | 採用技術・方針 |
| --- | --- |
| UI | Vue 3 Single-File Components |
| 言語 | TypeScript（strictを有効化） |
| ビルド | Vite |
| 状態管理 | Pinia |
| PWA | vite-plugin-pwa。MVPでは`generateSW`を基本とする |
| 永続化 | localStorage |
| テスト | Vitest。ルール層を中心に単体テストする |
| カード表示 | 外部画像を必須とせず、HTML/CSSで描画 |

Vueコンポーネントは`<script setup lang="ts">`とComposition APIを基本とする。ゲームの正否判定をVueコンポーネントに直接書かない。

## 3. ゲームルール

### 3.1 デッキと初期配置

- 標準52枚。ジョーカーなし
- スート: clubs / diamonds / hearts / spades
- ランク: A, 2〜10, J, Q, K
- 色: clubs・spadesは黒、diamonds・heartsは赤
- 場札は7列。左から1〜7枚を配り、各列の一番上だけ表向き、残りは裏向き
- 残り24枚は山札とする
- 組札は4か所、開始時は空
- 初期配置完了時のスコアは0、経過時間は0秒、状態はplaying

### 3.2 山札と捨て札

- 山札クリックで1枚を表向きにして捨て札へ移す
- 捨て札では一番上のカードだけ操作可能
- 山札が空のとき山札領域をクリックすると、捨て札を裏返して山札へ戻す
- 再利用回数は無制限
- 捨て札から山札へ戻す際、カード順は次の1枚が元の周回と同じになるよう復元する
- 再利用時はスコアを100点減算する。ただし0点未満にはしない

### 3.3 場札

- 空の列には表向きのK、またはKを先頭とする有効な連続カード群だけ置ける
- 空でない列には、移動先の一番上よりランクが1小さく、色が反対のカードを置ける
- 表向きの連続カード群は、群全体が「1ランクずつ降順かつ赤黒交互」の場合のみ移動可能
- 場札の一番上に裏向きカードが露出したら、自動で表向きにする
- 裏返しだけを独立した操作にはしない

### 3.4 組札

- スートごとにAからKまで昇順に積む
- 空の組札にはAだけ置ける
- 組札の一番上のカードだけ場札へ戻せる
- 4スートすべてKまで揃った時点でクリア

### 3.5 クリック操作

操作は「移動元を選択し、移動先をクリック」の2段階を基本とする。

1. 操作可能なカードをクリックすると選択状態になる
2. 場札ではクリックした表向きカードから列末尾までを選択する
3. 移動先をクリックし、合法なら移動する
4. 不正な移動では盤面を変更せず、選択を維持する
5. 選択中の同じカードまたは盤面の空白をクリックすると選択解除する
6. 別の操作可能カードをクリックすると選択対象を切り替える
7. 山札クリックはカード選択より優先して山札操作を行う

ダブルクリックによる組札への自動移動はMVP必須要件に含めない。

## 4. スコア仕様

Windows版に近い通常の加減算方式とし、MVPでは以下に固定する。

| 操作 | 点数 |
| --- | ---: |
| 捨て札 → 場札 | +5 |
| 捨て札 → 組札 | +10 |
| 場札 → 組札 | +10 |
| 場札の裏向きカードを表にする | +5 |
| 組札 → 場札 | -15 |
| 捨て札を山札へ戻す | -100 |
| 場札 → 場札 | 0 |

- スコアの下限は常に0
- 1回の操作で移動と裏返しが発生した場合は双方を加算する
- Undoでは、その操作によるスコア変更も含めて直前状態へ完全復元する
- 新しい操作を実行したら、Undo前に存在した将来履歴は破棄する

注: 個々の配点は「Windows版に近い」という合意を実装可能な値に落とした暫定固定値である。ユーザー確認により変更する場合は、`SCORING_VERSION`を更新し、テスト期待値も変更する。

## 5. タイマーと一時停止

- ゲーム開始後、playing中だけ経過秒数を加算する
- pauseでタイマーを止め、盤面を操作不可・非表示相当にする
- resumeで再開する
- ページがバックグラウンドになった時間を無条件に加算しない。`startedAt`との差分ではなく、playing中に確定した経過時間を管理する
- クリア時にタイマーを停止する
- MVPでは時間によるスコア加減算を行わない

## 6. 状態モデル

推奨型定義は次のとおり。名称変更は可能だが、意味と不変条件は維持する。

```ts
type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
type GameStatus = 'playing' | 'paused' | 'won'

interface Card {
  id: string              // 例: "hearts-13"
  suit: Suit
  rank: Rank
  faceUp: boolean
}

interface GameState {
  schemaVersion: 1
  rulesVersion: 1
  shuffleVersion: 1
  scoringVersion: 1
  seed: number
  stock: Card[]
  waste: Card[]
  tableau: [Card[], Card[], Card[], Card[], Card[], Card[], Card[]]
  foundations: Record<Suit, Card[]>
  score: number
  elapsedSeconds: number
  status: GameStatus
  moveCount: number
}
```

UI固有状態（選択カード、モーダル表示、ホバー等）は保存対象の`GameState`に混ぜない。全状態を通じ、52個のカードIDが重複も欠落もなく一度ずつ存在しなければならない。

## 7. ルール層と状態更新

推奨ディレクトリ構成:

```text
src/
  domain/
    cards.ts
    deck.ts
    shuffle.ts
    deal.ts
    rules.ts
    moves.ts
    scoring.ts
    invariants.ts
  stores/
    game.ts
  persistence/
    gameStorage.ts
    migrations.ts
  components/
    PlayingCard.vue
    StockPile.vue
    WastePile.vue
    FoundationPile.vue
    TableauColumn.vue
    GameBoard.vue
    GameToolbar.vue
  views/
    GameView.vue
```

- `domain`はVue・Pinia・DOM・localStorageに依存しない純粋TypeScriptとする
- 合法手判定と状態遷移を分離し、無効な操作は元状態を変更しない
- 配列やカードを直接破壊せず、新しい状態または安全なスナップショットを返す
- Pinia actionだけを盤面変更の公開入口とする
- コンポーネントはユーザー操作をactionへ通知し、表示用の判定はgetter/computedから得る

推奨する移動表現:

```ts
type PileRef =
  | { type: 'stock' }
  | { type: 'waste' }
  | { type: 'tableau'; column: number; cardIndex: number }
  | { type: 'foundation'; suit: Suit }

interface MoveCommand {
  from: PileRef
  to: Exclude<PileRef, { type: 'stock' } | { type: 'waste' }>
}
```

## 8. シード固定シャッフル

- seedは符号なし32ビット整数（0〜`0xffffffff`）
- `Math.random()`を使用しない
- PRNGは`mulberry32`、シャッフルはFisher–Yatesを`shuffleVersion: 1`として固定する
- 同じ初期デッキ、seed、shuffleVersionなら常に同じ並びを返す
- 入力配列を変更しない
- 乱数アルゴリズムを将来変更する場合は既存versionを残し、新versionを追加する

公開API例:

```ts
type ShuffleSeed = number

function shuffleDeck(
  deck: readonly Card[],
  seed: ShuffleSeed,
): Card[]
```

固定シードの完全な期待順序を最低1件テストに保存し、意図しないアルゴリズム変更を検知する。

## 9. Undo

- 盤面を変更するユーザー操作の直前に`GameState`のスナップショットをメモリへ保存する
- 対象: 山札をめくる、山札再利用、すべてのカード移動
- 対象外: 選択・選択解除、pause/resume、表示設定
- 1回の操作に伴う自動裏返し、得点、moveCount更新を1つのUndo単位にする
- Undo後は選択状態を解除する
- Undo可能回数はMVPでは最大100手
- Undo履歴はlocalStorageへ保存しない。再読込後はUndo不可でよい
- Undo自体で得点ペナルティを追加しない

## 10. localStorage

- キー: `klondike-lab.game`
- 保存対象: `GameState`と`savedAt`
- 保存タイミング: 有効な盤面変更、新規ゲーム、pause/resume、1秒単位ではなく定期的な経過時間確定時、`visibilitychange`、`beforeunload`
- Undo履歴と選択状態は保存しない
- JSON読込後にschemaVersion、型、52枚の一意性、各山の基本不変条件を検証する
- 不正・未知version・破損データは例外で画面を停止させず、新規ゲーム開始を提示する
- `migrations.ts`にversionごとの移行口を用意する。schemaVersion 1では実処理が空でもよい
- localStorage書込み失敗時も現在のプレイは継続し、非致命的な通知を表示する

## 11. PWA・オフライン要件

- 初回オンライン読込後、アプリシェル、JS、CSS、アイコン等をプリキャッシュする
- ゲーム進行にネットワークAPIを必要としない
- オフラインで再読込してもゲーム画面が開き、保存済みゲームを再開できる
- 更新適用方式はユーザーに再読込を促す`prompt`を基本とし、プレイ中の強制更新を避ける
- PWAの本番確認はHTTPS配信環境で行う

## 12. UI要件

- PC横画面を優先し、7列の場札を同時に把握できる
- 選択中カード群を枠線・浮き上がり等で明確に表示する
- 操作可能/不可能を色だけに依存して伝えない
- カードにはスート記号とランク文字を表示し、裏面と表面を明確に区別する
- ボタン: 新しいゲーム、Undo、一時停止/再開
- 表示: スコア、経過時間、手数、seed
- 新しいゲーム開始時にseedを生成し、任意seed入力による再開始も可能にする
- 勝利時は完了表示、最終スコア、時間、手数、seedを表示する
- Undo不可、paused、wonの各状態では利用不能な操作をdisabledにする

アクセシビリティの最低条件:

- すべての操作対象を`button`相当としてキーボードフォーカス可能にする
- `aria-label`でカード、山、列、操作内容を識別可能にする
- 選択状態を`aria-pressed`または同等情報で通知する
- クリック専用とは「ドラッグ不要」を意味し、キーボード操作を妨げない

## 13. テスト方針と必須ケース

### 単体テスト（最優先）

- デッキが52枚でID重複なし
- 同一seedの順序一致、異なるseedの通常の不一致、seed境界値
- shuffleが入力を破壊しない。空配列・1枚でも成功
- 初期配置が1〜7枚、各列先頭のみ表、山札24枚
- 場札の赤黒交互・降順、Kの空列移動
- 不正な連続カード群を移動できない
- 組札の同一スート・昇順、A開始
- 山札1枚めくりと再利用時の順序
- 各移動のスコア、複合得点、0点下限
- 勝利判定
- すべての合法/不正操作後に52枚の不変条件を維持
- Undoで盤面、表裏、スコア、手数を完全復元
- 保存/読込の往復、破損JSON、未知version

### コンポーネント/統合テスト

- クリック2回で合法移動が実行される
- 不正移動では盤面が変わらない
- 選択表示と解除
- pause中はカード操作不可
- 再読込相当で保存状態が復元される
- won表示と追加操作の禁止

### 手動PWA確認

1. オンラインで一度起動する
2. 数手プレイしてブラウザを閉じ、再開できることを確認する
3. DevTools等でオフラインにし、再読込して操作できることを確認する
4. 更新版公開時、プレイ中に強制再読込されないことを確認する

## 14. 推奨実装順

各段階でテストを通し、UIを先行させない。

1. プロジェクト初期化、strict TypeScript、Vitest
2. Card型、52枚生成、カード不変条件
3. mulberry32 + Fisher–Yatesのシード固定シャッフル
4. 初期配置生成
5. 純粋な合法手判定と状態遷移
6. スコア、勝利判定
7. Pinia storeとUndo
8. 最小UIとクリック選択・移動
9. localStorage保存、検証、復元
10. タイマー、一時停止、勝利UI
11. PWA化とオフライン手動試験
12. アクセシビリティ、表示調整、回帰テスト

### 最初の実装タスク

既存リポジトリにカード型・デッキ生成がある場合は、まず`mulberry32`とFisher–Yatesによる`shuffleDeck()`を純粋関数として実装する。存在しない場合は、Card型と52枚生成を先に作成する。

シャッフルの完了条件:

- 同じseedで毎回同じ結果
- 異なるseedで通常は異なる結果
- 52枚に重複・欠落なし
- 入力配列を変更しない
- seed `0`と`0xffffffff`に対応
- 固定seedの期待順序テストを含む
- Vitestがすべて成功

## 15. AIエージェント向け作業ルール

1. まずリポジトリ、README、`package.json`、設定、既存テスト、未コミット差分を確認する
2. 既存コードを仕様書の想定で上書きせず、差異があれば報告する
3. 一度に1つの完了可能な縦切りまたはドメイン機能だけ実装する
4. 仕様にない機能を追加しない
5. ルール判断は純粋関数、状態変更はPinia action、描画はVueへ分離する
6. 変更にはテストを追加し、typecheck・test・buildを実行する
7. 不具合修正では再現テストを先に追加する
8. 既存seedの並び、保存schema、スコア挙動を変える変更はversionを上げる
9. 終了時に変更ファイル、実装内容、検証結果、残課題を報告する
10. 本仕様の「要確認事項」に該当しない限り、実装可能な事項を質問だけで止めない

## 16. 完成条件（MVP Definition of Done）

- 52枚を正しい初期配置で開始できる
- クリックだけで全合法手を実行でき、不正手で状態が壊れない
- 1枚めくり、無制限再利用、組札、勝利判定が動作する
- Undoが直前100手まで動作する
- スコア、経過時間、手数、seedが表示・更新される
- 再読込後に保存ゲームを継続できる
- 初回読込後はオフラインでも起動・プレイできる
- 同じseedから同じ初期盤面を生成できる
- ルール・シャッフル・保存・Undoの必須テストが成功する
- TypeScriptの型検査と本番ビルドが成功する
- 重大なコンソールエラーがない

## 17. 要確認事項

以下は過去の合意で明示されていないため、MVPを止めない暫定仕様として本書では固定している。

- スコア個別配点（表の値）
- 不正移動後に選択を維持する挙動
- Undo上限100手
- PRNGとしてmulberry32を採用すること
- localStorageキー名
- PWA更新をprompt方式にすること
- ダブルクリック自動移動をMVP対象外とすること

ユーザーが変更を希望した場合は、関連するテスト、version定数、保存互換性への影響を確認してから更新する。

## 18. 根拠・参考資料

- Vue公式はTypeScriptを第一級サポートし、SFCとComposition APIの併用では`<script setup>`を推奨している。  
  https://vuejs.org/guide/typescript/overview.html  
  https://vuejs.org/api/sfc-script-setup
- Pinia公式ではstate、getter、actionをそれぞれ状態、算出値、処理として整理している。  
  https://pinia.vuejs.org/core-concepts/  
  https://pinia.vuejs.org/core-concepts/actions.html
- vite-plugin-pwaはViteアプリのオフライン対応とService Worker生成を支援し、`generateSW`と`injectManifest`を提供する。  
  https://vite-pwa-org.netlify.app/guide/  
  https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors
- VitestはViteの設定・変換処理を共有できるテストランナーである。  
  https://vitest.dev/guide/  
  https://vitest.dev/guide/why
- `Math.random()`には呼出側が再現用seedを指定する標準機能がない。  
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random

## 19. AIエージェントへ渡す短縮プロンプト

```text
Klondike Labを開発してください。最初に添付の「Klondike Lab 開発引き継ぎ仕様書」を全文読み、リポジトリのREADME、package.json、既存コード、テスト、未コミット差分を確認してください。

クリック操作のみのKlondike MVPとし、Vue 3 + TypeScript + Vite + Pinia + PWA、localStorage、Undo、Windows版に近いスコア、シード固定シャッフルを採用します。ゲームルールはVue/Piniaから独立した純粋TypeScriptで実装してください。

まず現在の実装状況と仕様との差分を簡潔に報告し、未実装の最上位タスクを1つ実装してください。既存にCard型とデッキ生成があれば、mulberry32 + Fisher–YatesのshuffleDeckとVitestから始めてください。なければCard型と52枚生成を先に実装してください。

typecheck、test、buildを実行し、最後に変更ファイル、検証結果、残課題を報告してください。仕様外の機能は追加しないでください。
```
