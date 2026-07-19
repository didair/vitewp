<?php
/**
 * Plugin Name: ViteWP Bridge
 * Description: Development bridge between WordPress and ViteWP.
 */

const VITEWP_THEME = 'vitewp';

$vitewp_bridge_dir = __DIR__ . '/vitewp-bridge';

require_once $vitewp_bridge_dir . '/class-bridge.php';
require_once $vitewp_bridge_dir . '/class-rest.php';
require_once $vitewp_bridge_dir . '/class-theme.php';
require_once $vitewp_bridge_dir . '/class-internal.php';
require_once $vitewp_bridge_dir . '/class-assets.php';
require_once $vitewp_bridge_dir . '/class-content.php';

ViteWP_Bridge::boot();
