# RE:FLEET オンライン保存 接続手順

現行公開版を維持したまま、`feat/online-save-sharing` に実装を準備しています。Supabaseの接続情報をまだ設定していないため、オンライン機能は未稼働です。

## 接続後の作業

1. 利用するSupabaseプロジェクトを確認する。既存の別用途プロジェクトに無断で適用しない。新規プロジェクトのプラン・リージョン・費用は作成前に確認する。
2. `schema.sql` を一度適用する。シートデータと立ち絵（data URL）を同じJSONとして保存する初期構成。1シート3MB以下。画像専用ストレージへの分離は将来の拡張。
3. AuthenticationでEmailを有効にし、匿名ログインは無効のままにする。Magic Linkメールテンプレートを確認コード方式に設定し、本文に `{{ .Token }}` を入れる。
4. PLのメールアドレスへの配信に使う独自SMTPを設定する。Supabase標準メールはプロジェクトチーム向けの試用制限があるため、一般利用の配信には使わない。SMTPの認証情報はSupabaseの設定画面だけに登録する。
5. AuthのSite URLを `https://maritama8110-png.github.io/refleet-character-sheet/` に設定する。本実装はメールコード入力方式で、メールリンクのリダイレクトは使用しない。
6. `config.js` にSupabaseのProject URLとpublishable keyを設定する。secret / service_role / データベースパスワードはHTML・JavaScript・GitHubに置かない。
7. 下記の実サービス検証後、GitHubのmainへ反映する。

## 利用動作

- ログインしなくても従来のブラウザ保存・JSON入出力が使える。
- メールコードでログイン後、オンライン保存・別シート保存・一覧読込が可能。
- 共有発行時はシート全体がURL保持者に閲覧されることを確認する。
- 共有は推測困難なトークンのURLで閲覧する。シート一覧・持ち主ID・メールは非公開。
- 閲覧ページはローカルのキャラクターデータを読み込まず、上書きしない。
- 保存更新では共有URLを維持。共有停止後は旧URLが無効。再共有で別のURLになる。
- 保存競合時は上書きを拒否し、JSON退避・再読込を案内。
- ブラウザの手元データはログアウト後もその端末に残る。

## 接続後に必要な実サービス検証

- 管理者以外のメールでのコード受信・ログイン・ログアウト。
- ユーザーA/Bと未ログインの3条件で、他人の一覧閲覧・編集・削除を拒否すること。
- 未ログインで共有URLのみ閲覧可能であること。
- 共有停止・再共有・削除・同一URLでの更新。
- 立ち絵・14隻・ゲージ・クレジットを含む保存と再読込。
- 別端末、Chromeのスマホ幅、印刷表示。共有を開いても既存ローカルシートが変化しないこと。
- 二重保存・別タブ更新の競合。
- SDK配信失敗・ネットワーク切断時も既存の編集機能が動くこと。

## 公式資料

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp

## 実施済みの検証

`npm install && npm test` で再実行できます。PostgreSQL互換のPGliteで2ユーザー・匿名ユーザーのアクセス制限、競合拒否、共有停止を検証済み。jsdomと模擬APIでオンライン保存・共有・ローカルデータ保護を検証済み。実際のSupabaseへの接続・メール配信・ブラウザ表示は未検証です。
