<?php

final class ViteWP_Bridge_Internal
{
    public static function handleInternalRequests(): void
    {
        if (isset($_GET['vitewp_internal_auth_action'])) {
            self::handleInternalAuthAction();
        }

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

        ViteWP_Bridge_Internal::json(ViteWP_Bridge_Internal::authContext($action, $redirect_to));
    }

    public static function handleInternalAuthAction(): void
    {

        ViteWP_Bridge_Internal::requireInternalRequest();

        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            ViteWP_Bridge_Internal::jsonError(405, 'method_not_allowed', 'Auth actions must use POST.');
        }

        $payload = json_decode((string) file_get_contents('php://input'), true);

        if (! is_array($payload)) {
            ViteWP_Bridge_Internal::jsonError(400, 'invalid_json', 'Invalid JSON payload.');
        }

        $action = sanitize_key((string) ($payload['action'] ?? ''));
        $redirect_to = esc_url_raw((string) ($payload['redirectTo'] ?? home_url('/')));

        if ($action === 'login') {
            ViteWP_Bridge_Internal::handlePasswordLogin($payload, $redirect_to);
        }

        if ($action === 'logout') {
            wp_logout();
            ViteWP_Bridge_Internal::json(ViteWP_Bridge_Internal::authContext('wp_rest', $redirect_to));
        }

        if ($action === 'register') {
            ViteWP_Bridge_Internal::handleUserRegistration($payload, $redirect_to);
        }

        if ($action === 'request_password_reset') {
            ViteWP_Bridge_Internal::handlePasswordResetRequest($payload);
        }

        if ($action === 'reset_password') {
            ViteWP_Bridge_Internal::handlePasswordReset($payload);
        }

        ViteWP_Bridge_Internal::jsonError(400, 'invalid_action', 'Unknown auth action.');
    }

    public static function handlePasswordLogin(array $payload, string $redirect_to): void
    {

        $login = sanitize_text_field((string) ($payload['login'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $remember = (bool) ($payload['remember'] ?? false);

        if ($login === '' || $password === '') {
            ViteWP_Bridge_Internal::jsonError(400, 'missing_credentials', 'Email/username and password are required.');
        }

        $user = wp_signon([
            'user_login' => $login,
            'user_password' => $password,
            'remember' => $remember,
        ], is_ssl());

        if (is_wp_error($user)) {
            ViteWP_Bridge_Internal::jsonError(401, $user->get_error_code(), wp_strip_all_tags($user->get_error_message()));
        }

        wp_set_current_user((int) $user->ID);
        ViteWP_Bridge_Internal::json(ViteWP_Bridge_Internal::authContext('wp_rest', $redirect_to));
    }

    public static function handleUserRegistration(array $payload, string $redirect_to): void
    {

        if (! ViteWP_Bridge_Internal::registrationEnabled()) {
            ViteWP_Bridge_Internal::jsonError(403, 'registration_disabled', 'User registration is disabled.');
        }

        $email = sanitize_email((string) ($payload['email'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $username = sanitize_user((string) ($payload['username'] ?? ''), true);
        $first_name = sanitize_text_field((string) ($payload['firstName'] ?? ''));
        $last_name = sanitize_text_field((string) ($payload['lastName'] ?? ''));
        $display_name = sanitize_text_field((string) ($payload['displayName'] ?? ''));
        $remember = (bool) ($payload['remember'] ?? false);
        $sign_in = (bool) ($payload['signIn'] ?? true);

        if ($email === '' || ! is_email($email)) {
            ViteWP_Bridge_Internal::jsonError(400, 'invalid_email', 'A valid email address is required.');
        }

        if (email_exists($email)) {
            ViteWP_Bridge_Internal::jsonError(409, 'email_exists', 'An account with this email already exists.');
        }

        if ($password === '') {
            ViteWP_Bridge_Internal::jsonError(400, 'missing_password', 'Password is required.');
        }

        if ($username === '') {
            $username = ViteWP_Bridge_Internal::uniqueUsernameFromEmail($email);
        } elseif (! validate_username($username)) {
            ViteWP_Bridge_Internal::jsonError(400, 'invalid_username', 'Username is invalid.');
        } elseif (username_exists($username)) {
            ViteWP_Bridge_Internal::jsonError(409, 'username_exists', 'An account with this username already exists.');
        }

        $user_id = ViteWP_Bridge_Internal::createUser($email, $username, $password);

        if (is_wp_error($user_id)) {
            ViteWP_Bridge_Internal::jsonError(400, $user_id->get_error_code(), wp_strip_all_tags($user_id->get_error_message()));
        }

        wp_update_user(array_filter([
            'ID' => (int) $user_id,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'display_name' => $display_name,
        ], static fn ($value) => $value !== ''));

        $user = get_userdata((int) $user_id);

        if (! $user instanceof WP_User) {
            ViteWP_Bridge_Internal::jsonError(500, 'user_not_found', 'The user was created but could not be loaded.');
        }

        if ($sign_in) {
            wp_set_current_user((int) $user_id);
            wp_set_auth_cookie((int) $user_id, $remember, is_ssl());
            do_action('wp_login', $user->user_login, $user);
        }

        ViteWP_Bridge_Internal::json([
            'ok' => true,
            'user' => ViteWP_Bridge_Internal::currentUser($user),
            'auth' => ViteWP_Bridge_Internal::authContext('wp_rest', $redirect_to),
        ]);
    }

    public static function registrationEnabled(): bool
    {

        if ((bool) get_option('users_can_register')) {
            return true;
        }

        return class_exists('WooCommerce') && get_option('woocommerce_enable_myaccount_registration') === 'yes';
    }

    public static function uniqueUsernameFromEmail(string $email): string
    {

        $email_parts = explode('@', $email);
        $base = sanitize_user((string) ($email_parts[0] ?? ''), true);

        if ($base === '') {
            $base = 'user';
        }

        $username = $base;
        $suffix = 2;

        while (username_exists($username)) {
            $username = $base . $suffix;
            $suffix++;
        }

        return $username;
    }

    public static function createUser(string $email, string $username, string $password): int|WP_Error
    {

        if (function_exists('wc_create_new_customer')) {
            return wc_create_new_customer($email, $username, $password);
        }

        return wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password,
        ]);
    }

    public static function handlePasswordResetRequest(array $payload): void
    {

        $login = sanitize_text_field((string) ($payload['login'] ?? ''));

        if ($login === '') {
            ViteWP_Bridge_Internal::jsonError(400, 'missing_login', 'Email or username is required.');
        }

        $result = retrieve_password($login);

        if (is_wp_error($result)) {
            ViteWP_Bridge_Internal::jsonError(400, $result->get_error_code(), wp_strip_all_tags($result->get_error_message()));
        }

        ViteWP_Bridge_Internal::json([
            'ok' => true,
            'message' => 'Password reset email sent.',
        ]);
    }

    public static function handlePasswordReset(array $payload): void
    {

        $login = sanitize_text_field((string) ($payload['login'] ?? ''));
        $key = sanitize_text_field((string) ($payload['key'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($login === '' || $key === '' || $password === '') {
            ViteWP_Bridge_Internal::jsonError(400, 'missing_reset_fields', 'Login, reset key, and new password are required.');
        }

        $user = check_password_reset_key($key, $login);

        if (is_wp_error($user)) {
            ViteWP_Bridge_Internal::jsonError(400, $user->get_error_code(), wp_strip_all_tags($user->get_error_message()));
        }

        reset_password($user, $password);

        ViteWP_Bridge_Internal::json([
            'ok' => true,
            'message' => 'Password reset.',
        ]);
    }

    public static function authContext(string $action, string $redirect_to): array
    {

        $user = wp_get_current_user();
        $logged_in = is_user_logged_in() && $user instanceof WP_User && $user->exists();

        return [
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
        ];
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

    public static function jsonError(int $status, string $code, string $message): void
    {

        status_header($status);
        ViteWP_Bridge_Internal::json([
            'ok' => false,
            'code' => $code,
            'message' => $message,
        ]);
    }

}
