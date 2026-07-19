<?php

final class ViteWP_Bridge_Internal
{
    public static function handleInternalRequests(): void
    {
        if (isset($_GET['vitewp_internal_auth'])) {
            self::handleInternalAuth();
        }

        if (! isset($_GET['vitewp_internal_hook'])) {
            return;
        }

        self::handleInternalHook();
    }

    public static function handleInternalHook(): void
    {

        ViteWP_Bridge_Internal::requireInternalRequest();

        $payload = json_decode((string) file_get_contents('php://input'), true);

        if (! is_array($payload)) {
            status_header(400);
            header('Content-Type: application/json; charset=utf-8');
            echo wp_json_encode(['message' => 'Invalid JSON payload']);
            exit;
        }

        $type = (string) ($payload['type'] ?? '');
        $hook = (string) ($payload['hook'] ?? '');
        $args = is_array($payload['args'] ?? null) ? array_values($payload['args']) : [];
        $context = is_array($payload['context'] ?? null) ? $payload['context'] : [];
        $omit_default_assets = ViteWP_Bridge_Internal::shouldOmitDefaultAssets();

        if ($hook === '' || ! in_array($type, ['action', 'filter'], true)) {
            status_header(400);
            header('Content-Type: application/json; charset=utf-8');
            echo wp_json_encode(['message' => 'Missing hook or invalid hook type']);
            exit;
        }

        ViteWP_Bridge_Internal::setupHookContext($context);

        if ($omit_default_assets) {
            ViteWP_Bridge_Internal::omitDefaultHookAssets($hook);
        }

        if ($type === 'action') {
            ob_start();
            do_action_ref_array($hook, $args);
            $rendered = (string) ob_get_clean();

            ViteWP_Bridge_Internal::json([
                'type' => 'action',
                'hook' => $hook,
                'rendered' => $rendered,
            ]);
        }

        $value = $payload['value'] ?? '';
        $filter_args = array_merge([$value], $args);
        $filtered = apply_filters_ref_array($hook, $filter_args);

        ViteWP_Bridge_Internal::json([
            'type' => 'filter',
            'hook' => $hook,
            'value' => $filtered,
            'rendered' => is_scalar($filtered) ? (string) $filtered : wp_json_encode($filtered),
        ]);
    }

    public static function handleInternalAuth(): void
    {

        ViteWP_Bridge_Internal::requireInternalRequest();

        $action = sanitize_text_field((string) ($_GET['action'] ?? 'wp_rest'));
        $redirect_to = esc_url_raw((string) ($_GET['redirect_to'] ?? home_url('/')));
        $user = wp_get_current_user();
        $logged_in = is_user_logged_in() && $user instanceof WP_User && $user->exists();

        ViteWP_Bridge_Internal::json([
            'loggedIn' => $logged_in,
            'user' => $logged_in ? ViteWP_Bridge_Internal::currentUser($user) : null,
            'nonce' => [
                'action' => $action,
                'value' => wp_create_nonce($action),
            ],
            'restNonce' => wp_create_nonce('wp_rest'),
            'loginUrl' => wp_login_url($redirect_to),
            'logoutUrl' => wp_logout_url($redirect_to),
            'lostPasswordUrl' => wp_lostpassword_url($redirect_to),
            'registerUrl' => wp_registration_url(),
            'woocommerce' => ViteWP_Bridge_Internal::woocommerceAuthContext(),
        ]);
    }

    public static function requireInternalRequest(): void
    {

        $configured_secret = defined('VITEWP_INTERNAL_SECRET') ? (string) VITEWP_INTERNAL_SECRET : '';
        $request_secret = (string) ($_SERVER['HTTP_X_VITEWP_INTERNAL_SECRET'] ?? '');

        if ($configured_secret === '' || ! hash_equals($configured_secret, $request_secret)) {
            status_header(403);
            header('Content-Type: application/json; charset=utf-8');
            echo wp_json_encode(['message' => 'Forbidden']);
            exit;
        }
    }

    public static function currentUser(WP_User $user): array
    {

        $capabilities = [];

        foreach ((array) $user->allcaps as $capability => $enabled) {
            if ($enabled) {
                $capabilities[] = (string) $capability;
            }
        }

        return [
            'id' => (int) $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'name' => $user->display_name,
            'displayName' => $user->display_name,
            'firstName' => (string) get_user_meta($user->ID, 'first_name', true),
            'lastName' => (string) get_user_meta($user->ID, 'last_name', true),
            'roles' => array_values((array) $user->roles),
            'capabilities' => $capabilities,
            'avatarUrls' => ViteWP_Bridge_Internal::avatarUrls((int) $user->ID),
        ];
    }

    public static function avatarUrls(int $user_id): array
    {

        return [
            '24' => get_avatar_url($user_id, ['size' => 24]) ?: '',
            '48' => get_avatar_url($user_id, ['size' => 48]) ?: '',
            '96' => get_avatar_url($user_id, ['size' => 96]) ?: '',
        ];
    }

    public static function woocommerceAuthContext(): ?array
    {

        if (! class_exists('WooCommerce')) {
            return null;
        }

        return [
            'active' => true,
            'customer' => ViteWP_Bridge_Internal::woocommerceCustomer(),
            'myAccountUrl' => function_exists('wc_get_page_permalink') ? wc_get_page_permalink('myaccount') : home_url('/my-account/'),
            'cartUrl' => function_exists('wc_get_cart_url') ? wc_get_cart_url() : home_url('/cart/'),
            'checkoutUrl' => function_exists('wc_get_checkout_url') ? wc_get_checkout_url() : home_url('/checkout/'),
            'storeApiNonce' => wp_create_nonce('wc_store_api'),
        ];
    }

    public static function woocommerceCustomer(): ?array
    {

        $user_id = get_current_user_id();

        if ($user_id <= 0 || ! class_exists('WC_Customer')) {
            return null;
        }

        $customer = new WC_Customer($user_id);
        $user = get_userdata($user_id);

        return [
            'id' => $user_id,
            'email' => $customer->get_email(),
            'firstName' => $customer->get_first_name(),
            'lastName' => $customer->get_last_name(),
            'displayName' => $user instanceof WP_User ? $user->display_name : trim($customer->get_first_name() . ' ' . $customer->get_last_name()),
            'billing' => [
                'firstName' => $customer->get_billing_first_name(),
                'lastName' => $customer->get_billing_last_name(),
                'company' => $customer->get_billing_company(),
                'address1' => $customer->get_billing_address_1(),
                'address2' => $customer->get_billing_address_2(),
                'city' => $customer->get_billing_city(),
                'postcode' => $customer->get_billing_postcode(),
                'country' => $customer->get_billing_country(),
                'state' => $customer->get_billing_state(),
                'email' => $customer->get_billing_email(),
                'phone' => $customer->get_billing_phone(),
            ],
            'shipping' => [
                'firstName' => $customer->get_shipping_first_name(),
                'lastName' => $customer->get_shipping_last_name(),
                'company' => $customer->get_shipping_company(),
                'address1' => $customer->get_shipping_address_1(),
                'address2' => $customer->get_shipping_address_2(),
                'city' => $customer->get_shipping_city(),
                'postcode' => $customer->get_shipping_postcode(),
                'country' => $customer->get_shipping_country(),
                'state' => $customer->get_shipping_state(),
                'phone' => method_exists($customer, 'get_shipping_phone') ? $customer->get_shipping_phone() : '',
            ],
        ];
    }

    public static function shouldOmitDefaultAssets(): bool
    {

        return defined('VITEWP_OMIT_DEFAULT_ASSETS') && (bool) VITEWP_OMIT_DEFAULT_ASSETS;
    }

    public static function omitDefaultHookAssets(string $hook): void
    {

        if (! in_array($hook, ['wp_head', 'wp_footer'], true)) {
            return;
        }

        if (is_admin()) {
            return;
        }

        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_head', 'wp_generator');
        remove_action('wp_head', 'wlwmanifest_link');
        remove_action('wp_head', 'rsd_link');
        remove_action('wp_head', 'wp_shortlink_wp_head');
        remove_action('wp_head', 'rest_output_link_wp_head', 10);
        remove_action('wp_head', 'wp_oembed_add_discovery_links');
        remove_action('wp_head', 'wp_oembed_add_host_js');

        add_action('wp_enqueue_scripts', 'ViteWP_Bridge_Internal::dequeueDefaultAssets', 1000);
        add_action('wp_print_scripts', 'ViteWP_Bridge_Internal::dequeueDefaultAssets', 0);
        add_action('wp_print_styles', 'ViteWP_Bridge_Internal::dequeueDefaultAssets', 0);
        ViteWP_Bridge_Internal::dequeueDefaultAssets();
    }

    public static function dequeueDefaultAssets(): void
    {

        if (is_admin()) {
            return;
        }

        $scripts = [
            'jquery',
            'jquery-core',
            'jquery-migrate',
            'wp-emoji',
            'wp-emoji-release',
        ];
        $styles = [
            'wp-emoji-styles',
            'emoji-styles',
            'global-styles',
            'classic-theme-styles',
            'wp-block-library-theme',
        ];

        foreach ($scripts as $handle) {
            wp_dequeue_script($handle);
        }

        foreach ($styles as $handle) {
            wp_dequeue_style($handle);
        }
    }

    public static function setupHookContext(array $context): void
    {

        $route = is_array($context['route'] ?? null) ? $context['route'] : [];
        $item = is_array($route['item'] ?? null) ? $route['item'] : [];
        $post_id = (int) ($item['id'] ?? 0);

        if ($post_id <= 0) {
            return;
        }

        $context_post = get_post($post_id);

        if (! $context_post) {
            return;
        }

        global $post;
        $post = $context_post;
        $GLOBALS['post'] = $context_post;
        setup_postdata($context_post);

        if (function_exists('wc_get_product') && $context_post->post_type === 'product') {
            $GLOBALS['product'] = wc_get_product($context_post);
        }
    }

    public static function json(array $payload): void
    {

        header('Content-Type: application/json; charset=utf-8');
        echo wp_json_encode($payload);
        exit;
    }

}
