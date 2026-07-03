# WordPress theme handling

WordPress requires an active theme for admin, editor, theme support, and several core assumptions. ViteWP still renders the public frontend with Astro, but it ships a tiny placeholder WordPress theme to keep WordPress healthy:

```txt
wordpress/content/themes/vitewp
```

The ViteWP bridge mu-plugin forces WordPress to use this theme during development via option filters for `template`, `stylesheet`, and `current_theme`. The generated `wp-config.php` also defines:

```php
define('WP_DEFAULT_THEME', 'vitewp');
```

This means users should not need Twenty Twenty-Five or any other classic/block theme installed just to use wp-admin with ViteWP.
