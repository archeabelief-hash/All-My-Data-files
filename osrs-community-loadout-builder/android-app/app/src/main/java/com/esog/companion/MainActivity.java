package com.esog.companion;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String PREFS = "esog_companion";
    private static final String KEY_SERVER = "server_url";
    private static final int BG = Color.rgb(9, 13, 11);
    private static final int PANEL = Color.rgb(17, 25, 21);
    private static final int TEXT = Color.rgb(243, 247, 244);
    private static final int MUTED = Color.rgb(147, 166, 155);
    private static final int GOLD = Color.rgb(215, 179, 90);

    private SharedPreferences prefs;
    private WebView webView;
    private LinearLayout root;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        showLauncher();
    }

    private TextView text(String value, float sp, int color) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(sp);
        v.setTextColor(color);
        return v;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showLauncher() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(22));
        root.setBackgroundColor(BG);
        root.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView eyebrow = text("VETERANS OF THE GRIND", 12, GOLD);
        eyebrow.setLetterSpacing(0.12f);
        root.addView(eyebrow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = text("ESOG Companion", 32, TEXT);
        title.setPadding(0, dp(8), 0, dp(6));
        root.addView(title, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView body = text("Connect this phone to the ESOG companion server running on your gaming PC. The phone and PC should be on the same network for local testing.", 15, MUTED);
        body.setLineSpacing(0, 1.25f);
        body.setPadding(0, 0, 0, dp(24));
        root.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        EditText server = new EditText(this);
        server.setSingleLine(true);
        server.setText(prefs.getString(KEY_SERVER, "http://192.168.1.2:8765"));
        server.setHint("http://YOUR-PC-IP:8765");
        server.setTextColor(TEXT);
        server.setHintTextColor(MUTED);
        server.setBackgroundColor(PANEL);
        server.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(server, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        Button connect = new Button(this);
        connect.setText("CONNECT TO ESOG");
        connect.setTextColor(Color.rgb(24, 18, 5));
        connect.setBackgroundColor(GOLD);
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        buttonParams.topMargin = dp(12);
        root.addView(connect, buttonParams);

        TextView hint = text("Tip: your PC will show its local dashboard address when the ESOG companion server starts.", 12, MUTED);
        hint.setPadding(0, dp(18), 0, 0);
        root.addView(hint, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        connect.setOnClickListener(v -> {
            String url = normalizeUrl(server.getText().toString());
            if (url == null) {
                server.setError("Enter a valid http:// or https:// address");
                return;
            }
            prefs.edit().putString(KEY_SERVER, url).apply();
            showWeb(url);
        });

        setContentView(root);
    }

    private String normalizeUrl(String input) {
        String value = input == null ? "" : input.trim();
        if (value.isEmpty()) return null;
        if (!value.startsWith("http://") && !value.startsWith("https://")) value = "http://" + value;
        try {
            Uri uri = Uri.parse(value);
            if (uri.getHost() == null) return null;
            return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
        } catch (Exception e) {
            return null;
        }
    }

    private void showWeb(String url) {
        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackgroundColor(BG);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(12), dp(7), dp(8), dp(7));
        bar.setBackgroundColor(Color.rgb(11, 16, 13));

        TextView label = text("ESOG", 14, GOLD);
        label.setGravity(Gravity.CENTER_VERTICAL);
        bar.addView(label, new LinearLayout.LayoutParams(0, dp(38), 1f));

        Button reload = new Button(this);
        reload.setText("↻");
        reload.setTextSize(18);
        reload.setTextColor(TEXT);
        reload.setBackgroundColor(PANEL);
        bar.addView(reload, new LinearLayout.LayoutParams(dp(52), dp(42)));

        Button settings = new Button(this);
        settings.setText("SERVER");
        settings.setTextSize(11);
        settings.setTextColor(TEXT);
        settings.setBackgroundColor(PANEL);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(dp(86), dp(42));
        sp.leftMargin = dp(6);
        bar.addView(settings, sp);

        shell.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        webView = new WebView(this);
        webView.setBackgroundColor(BG);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setLoadWithOverviewMode(false);
        ws.setUseWideViewPort(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMediaPlaybackRequiresUserGesture(true);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.equals(url)) showConnectionError(url, description);
            }
        });
        shell.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        reload.setOnClickListener(v -> webView.reload());
        settings.setOnClickListener(v -> showLauncher());
        setContentView(shell);
        webView.loadUrl(url);
    }

    private void showConnectionError(String url, String description) {
        String safeDescription = description == null ? "Connection failed" : description.replace("<", "&lt;").replace(">", "&gt;");
        String html = "<html><meta name='viewport' content='width=device-width,initial-scale=1'><body style='margin:0;background:#090d0b;color:#f3f7f4;font-family:sans-serif;padding:28px'>" +
                "<div style='color:#d7b35a;font-size:12px;letter-spacing:2px'>ESOG COMPANION</div>" +
                "<h1>PC server not reached</h1><p style='color:#93a69b;line-height:1.6'>Start the ESOG companion server on the gaming PC, keep both devices on the same network, and verify the PC address.</p>" +
                "<p style='color:#93a69b'><b>Address:</b> " + url + "<br><b>Result:</b> " + safeDescription + "</p>" +
                "<p style='color:#93a69b'>Use the SERVER button above to change the address.</p></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
