BookScan Ver.0.6 - iPhone camera restart fix

撮影後の四隅補正画面を開く前にカメラのMediaStreamを解放し、補正画面を閉じた際に新しいMediaStreamを取得して再開します。自動撮影は再開直後の重複撮影を防ぐため、次のページ変化を待ちます。

GitHub Pagesのリポジトリ直下へ index.html, app.js, sw.js を上書きしてください。既存の style.css, correction.js などは維持します。

注意：iPhone Safari実機未検証です。カメラ権限を再確認する場合があります。
