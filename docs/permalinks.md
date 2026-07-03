# Permalinks

ViteWP supports pretty WordPress permalinks through its PHP router and unified proxy.

WordPress normally adds `/index.php` to permalink choices when it cannot detect Apache/Nginx rewrite support. ViteWP is neither Apache nor Nginx, but its generated PHP router performs the same front-controller behavior. The ViteWP bridge therefore tells WordPress that URL rewriting is available with:

```php
add_filter('got_url_rewrite', '__return_true');
add_filter('got_rewrite', '__return_true');
```

If a previous save produced a structure like:

```txt
/index.php/%postname%/
```

ViteWP normalizes it on the next admin request to:

```txt
/%postname%/
```

Then it flushes rewrite rules without touching `.htaccess`.

If the Permalinks screen still shows `index.php`, reload wp-admin and save Settings → Permalinks again.
