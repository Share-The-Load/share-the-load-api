import log from "../utils/log.js";

const logger = log.createLogger("sharetheload-routes-invite");

const APP_STORE_URL = "https://apps.apple.com/us/app/share-the-load/id6480417573";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.sharetheload.app";

export default function (app, dbConn) {

    // Public invite landing page — no auth required
    app.get("/invite/:code", async (req, res) => {
        try {
            const code = req.params.code;

            // Look up the group name for a nicer preview
            const group = await dbConn.models.group.findOne({
                where: { invite_code: code },
                attributes: ["name"],
                raw: true,
            });

            const groupName = group ? group.name : "a group";
            const deepLink = `share-the-load://invite/${code}`;
            const ogImageUrl = "https://api.sharetheload.strousetechnologies.com/invite/app-icon-all.png";

            const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join ${escapeHtml(groupName)} on Share The Load</title>

    <!-- Open Graph / Link Preview -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="Join ${escapeHtml(groupName)} on Share The Load!">
    <meta property="og:description" content="You've been invited to join ${escapeHtml(groupName)}. Tap to open the app and start sharing the load!">
    <meta property="og:image" content="${ogImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Join ${escapeHtml(groupName)} on Share The Load!">
    <meta name="twitter:description" content="You've been invited to join ${escapeHtml(groupName)}. Tap to open the app and start sharing the load!">
    <meta name="twitter:image" content="${ogImageUrl}">

    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #C7E0EF 0%, #89B4D4 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: white;
            border-radius: 24px;
            padding: 40px 32px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        }
        .logo { width: 80px; height: 80px; margin-bottom: 20px; border-radius: 18px; }
        h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 8px; }
        .subtitle { font-size: 16px; color: #666; margin-bottom: 28px; line-height: 1.4; }
        .group-name { font-weight: 600; color: #2E86C1; }
        .btn {
            display: block;
            width: 100%;
            padding: 16px;
            border-radius: 14px;
            font-size: 17px;
            font-weight: 600;
            text-decoration: none;
            margin-bottom: 12px;
            cursor: pointer;
            border: none;
        }
        .btn-primary {
            background: #2E86C1;
            color: white;
        }
        .btn-secondary {
            background: #f0f0f0;
            color: #333;
        }
        .store-links { margin-top: 20px; }
        .store-links p { font-size: 14px; color: #999; margin-bottom: 12px; }
        .store-buttons { display: flex; gap: 12px; justify-content: center; }
        .store-buttons a {
            font-size: 14px;
            color: #2E86C1;
            text-decoration: none;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="card">
        <img src="${ogImageUrl}" alt="Share The Load" class="logo">
        <h1>You're invited!</h1>
        <p class="subtitle">
            Join <span class="group-name">${escapeHtml(groupName)}</span> on Share The Load
        </p>
        <a class="btn btn-primary" id="openApp" href="${deepLink}">Open in App</a>
        <div class="store-links">
            <p>Don't have the app yet?</p>
            <div class="store-buttons">
                <a href="${APP_STORE_URL}">App Store</a>
                <a href="${PLAY_STORE_URL}">Google Play</a>
            </div>
        </div>
    </div>
    <script>
        // Try to open the app via deep link
        // If it fails (app not installed), the user stays on this page
        // and can tap the store links
        var deepLink = "${deepLink}";
        var userAgent = navigator.userAgent || navigator.vendor;

        // Attempt auto-open on mobile
        if (/iPhone|iPad|iPod/i.test(userAgent)) {
            window.location.href = deepLink;
            setTimeout(function() {
                // If we're still here, the app didn't open
                // Don't redirect automatically — let the user choose
            }, 1500);
        } else if (/Android/i.test(userAgent)) {
            window.location.href = deepLink;
            setTimeout(function() {
                // If we're still here, the app didn't open
            }, 1500);
        }
    </script>
</body>
</html>`;

            res.set("Content-Type", "text/html");
            res.send(html);
        } catch (error) {
            logger.error(error);
            res.status(500).send("Something went wrong");
        }
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
