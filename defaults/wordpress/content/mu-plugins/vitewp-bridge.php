<?php
/**
 * Plugin Name: ViteWP Bridge
 * Description: Development bridge between WordPress and ViteWP.
 */

const VITEWP_THEME = 'vitewp';

add_filter('pre_option_template', 'vitewp_bridge_force_theme');
add_filter('pre_option_stylesheet', 'vitewp_bridge_force_theme');
add_filter('pre_option_current_theme', function () {
    return 'ViteWP';
});

add_filter('got_url_rewrite', '__return_true');
add_filter('got_rewrite', '__return_true');

add_action('admin_init', function () {
    $structure = (string) get_option('permalink_structure');

    if (str_starts_with($structure, '/index.php/')) {
        update_option('permalink_structure', substr($structure, strlen('/index.php')));
        flush_rewrite_rules(false);
    }
});

function vitewp_bridge_force_theme(): string
{
    return VITEWP_THEME;
}

add_action('init', function () {
    if (! isset($_GET['vitewp_internal_hook'])) {
        return;
    }

    vitewp_bridge_handle_internal_hook();
}, 0);

add_action('init', 'vitewp_bridge_register_bundled_blocks', 20);
add_action('enqueue_block_assets', 'vitewp_bridge_enqueue_block_assets');
add_action('enqueue_block_editor_assets', 'vitewp_bridge_enqueue_block_assets');
add_action('wp_enqueue_scripts', 'vitewp_bridge_enqueue_plugin_assets');
add_action('admin_enqueue_scripts', 'vitewp_bridge_enqueue_plugin_assets');

add_action('rest_api_init', function () {
    register_rest_route('vitewp/v1', '/routing', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => function () {
            $page_on_front = (int) get_option('page_on_front');
            $page_for_posts = (int) get_option('page_for_posts');

            return [
                'show_on_front' => get_option('show_on_front'),
                'page_on_front' => $page_on_front,
                'page_for_posts' => $page_for_posts,
                'front_page' => vitewp_bridge_page_summary($page_on_front),
                'posts_page' => vitewp_bridge_page_summary($page_for_posts),
            ];
        },
    ]);

    register_rest_route('vitewp/v1', '/health', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => function () {
            return [
                'wordpressVersion' => get_bloginfo('version'),
                'phpVersion' => PHP_VERSION,
                'homeUrl' => home_url('/'),
                'siteUrl' => site_url('/'),
                'permalinkStructure' => (string) get_option('permalink_structure'),
                'activeTheme' => get_stylesheet(),
                'template' => get_template(),
                'activePlugins' => array_values((array) get_option('active_plugins', [])),
                'muPlugins' => array_values(array_keys(get_mu_plugins())),
            ];
        },
    ]);

    register_rest_route('vitewp/v1', '/types', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => function () {
            return [
                'postTypes' => vitewp_bridge_post_types(),
                'taxonomies' => vitewp_bridge_taxonomies(),
            ];
        },
    ]);

    register_rest_route('vitewp/v1', '/blocks', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => 'vitewp_bridge_blocks',
    ]);

    register_rest_route('vitewp/v1', '/menus', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => 'vitewp_bridge_menus',
    ]);

    register_rest_route('vitewp/v1', '/resolve', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'args' => [
            'path' => [
                'type' => 'string',
                'required' => true,
            ],
        ],
        'callback' => function (WP_REST_Request $request) {
            return vitewp_bridge_resolve_path((string) $request->get_param('path'));
        },
    ]);

    register_rest_route('vitewp/v1', '/archive', [
        'methods' => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback' => function (WP_REST_Request $request) {
            return vitewp_bridge_archive($request);
        },
    ]);
});

function vitewp_bridge_handle_internal_hook(): void
{
    $configured_secret = defined('VITEWP_INTERNAL_SECRET') ? (string) VITEWP_INTERNAL_SECRET : '';
    $request_secret = (string) ($_SERVER['HTTP_X_VITEWP_INTERNAL_SECRET'] ?? '');

    if ($configured_secret === '' || ! hash_equals($configured_secret, $request_secret)) {
        status_header(403);
        header('Content-Type: application/json; charset=utf-8');
        echo wp_json_encode(['message' => 'Forbidden']);
        exit;
    }

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

    if ($hook === '' || ! in_array($type, ['action', 'filter'], true)) {
        status_header(400);
        header('Content-Type: application/json; charset=utf-8');
        echo wp_json_encode(['message' => 'Missing hook or invalid hook type']);
        exit;
    }

    vitewp_bridge_setup_hook_context($context);

    if ($type === 'action') {
        ob_start();
        do_action_ref_array($hook, $args);
        $rendered = (string) ob_get_clean();

        vitewp_bridge_json([
            'type' => 'action',
            'hook' => $hook,
            'rendered' => $rendered,
        ]);
    }

    $value = $payload['value'] ?? '';
    $filter_args = array_merge([$value], $args);
    $filtered = apply_filters_ref_array($hook, $filter_args);

    vitewp_bridge_json([
        'type' => 'filter',
        'hook' => $hook,
        'value' => $filtered,
        'rendered' => is_scalar($filtered) ? (string) $filtered : wp_json_encode($filtered),
    ]);
}

function vitewp_bridge_setup_hook_context(array $context): void
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

function vitewp_bridge_json(array $payload): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode($payload);
    exit;
}

function vitewp_bridge_register_bundled_blocks(): void
{
    $manifest = vitewp_bridge_assets_manifest();

    foreach (($manifest['blocks'] ?? []) as $block) {
        foreach (($block['entries'] ?? []) as $entry) {
            vitewp_bridge_register_asset_entry($entry);
        }

        $directory = vitewp_bridge_project_path((string) ($block['directory'] ?? ''));

        if ($directory && file_exists($directory . '/block.json')) {
            register_block_type($directory);
        }
    }
}

function vitewp_bridge_blocks(): array
{
    $manifest_file = defined('VITEWP_ASSETS_MANIFEST') ? (string) VITEWP_ASSETS_MANIFEST : '';
    $manifest = vitewp_bridge_assets_manifest();
    $registry = WP_Block_Type_Registry::get_instance();

    return [
        'manifest' => [
            'path' => $manifest_file,
            'exists' => $manifest_file !== '' && file_exists($manifest_file),
        ],
        'blocks' => array_map(function (array $block) use ($registry) {
            $name = (string) ($block['name'] ?? '');
            $directory = vitewp_bridge_project_path((string) ($block['directory'] ?? ''));
            $block_type = $name !== '' && $registry->is_registered($name) ? $registry->get_registered($name) : null;

            return [
                'name' => $name,
                'directory' => $directory,
                'blockJson' => $directory ? $directory . '/block.json' : null,
                'blockJsonExists' => $directory ? file_exists($directory . '/block.json') : false,
                'registered' => $name !== '' && $registry->is_registered($name),
                'editorScriptHandles' => vitewp_bridge_block_type_property($block_type, 'editor_script_handles'),
                'scriptHandles' => vitewp_bridge_block_type_property($block_type, 'script_handles'),
                'styleHandles' => vitewp_bridge_block_type_property($block_type, 'style_handles'),
                'registeredAssets' => array_map('vitewp_bridge_asset_status', is_array($block['entries'] ?? null) ? $block['entries'] : []),
                'entries' => $block['entries'] ?? [],
            ];
        }, is_array($manifest['blocks'] ?? null) ? $manifest['blocks'] : []),
    ];
}

function vitewp_bridge_block_type_property($block_type, string $property): array
{
    if (! is_object($block_type) || ! isset($block_type->{$property}) || ! is_array($block_type->{$property})) {
        return [];
    }

    return array_values($block_type->{$property});
}

function vitewp_bridge_asset_status(array $entry): array
{
    $handle = (string) ($entry['handle'] ?? '');
    $kind = (string) ($entry['kind'] ?? '');

    return [
        'handle' => $handle,
        'kind' => $kind,
        'registered' => $kind === 'style' ? wp_style_is($handle, 'registered') : wp_script_is($handle, 'registered'),
        'enqueued' => $kind === 'style' ? wp_style_is($handle, 'enqueued') : wp_script_is($handle, 'enqueued'),
    ];
}

function vitewp_bridge_enqueue_plugin_assets(): void
{
    $manifest = vitewp_bridge_assets_manifest();

    foreach (($manifest['plugins'] ?? []) as $entry) {
        vitewp_bridge_enqueue_asset_entry($entry);
    }
}

function vitewp_bridge_enqueue_block_assets(): void
{
    $manifest = vitewp_bridge_assets_manifest();

    foreach (($manifest['blocks'] ?? []) as $block) {
        foreach (($block['entries'] ?? []) as $entry) {
            vitewp_bridge_enqueue_asset_entry($entry);
        }
    }
}

function vitewp_bridge_assets_manifest(): array
{
    static $manifest = null;

    if (is_array($manifest)) {
        return $manifest;
    }

    $file = defined('VITEWP_ASSETS_MANIFEST') ? (string) VITEWP_ASSETS_MANIFEST : '';

    if ($file === '' || ! file_exists($file)) {
        $manifest = [];
        return $manifest;
    }

    $decoded = json_decode((string) file_get_contents($file), true);
    $manifest = is_array($decoded) ? $decoded : [];
    return $manifest;
}

function vitewp_bridge_enqueue_asset_entry(array $entry): void
{
    $file = (string) ($entry['file'] ?? '');
    $handle = (string) ($entry['handle'] ?? '');

    if ($file === '' || $handle === '') {
        return;
    }

    $dependencies = is_array($entry['dependencies'] ?? null) ? array_values($entry['dependencies']) : [];
    $url = vitewp_bridge_asset_url($file);

    if (($entry['kind'] ?? '') === 'style') {
        wp_enqueue_style($handle, $url, $dependencies, null);
        return;
    }

    wp_enqueue_script($handle, $url, $dependencies, null, true);

    foreach (($entry['css'] ?? []) as $index => $css) {
        wp_enqueue_style($handle . '-css-' . $index, vitewp_bridge_asset_url((string) $css), [], null);
    }
}

function vitewp_bridge_register_asset_entry(array $entry): void
{
    $file = (string) ($entry['file'] ?? '');
    $handle = (string) ($entry['handle'] ?? '');

    if ($file === '' || $handle === '') {
        return;
    }

    $dependencies = is_array($entry['dependencies'] ?? null) ? array_values($entry['dependencies']) : [];
    $url = vitewp_bridge_asset_url($file);

    if (($entry['kind'] ?? '') === 'style') {
        if (! wp_style_is($handle, 'registered')) {
            wp_register_style($handle, $url, $dependencies, null);
        }
        return;
    }

    if (! wp_script_is($handle, 'registered')) {
        wp_register_script($handle, $url, $dependencies, null, true);
    }

    foreach (($entry['css'] ?? []) as $index => $css) {
        $style_handle = $handle . '-css-' . $index;
        if (! wp_style_is($style_handle, 'registered')) {
            wp_register_style($style_handle, vitewp_bridge_asset_url((string) $css), [], null);
        }
    }
}

function vitewp_bridge_asset_url(string $file): string
{
    return content_url('/vitewp-assets/' . ltrim($file, '/'));
}

function vitewp_bridge_project_path(string $relative_path): ?string
{
    if ($relative_path === '' || ! defined('VITEWP_ROOT')) {
        return null;
    }

    return rtrim((string) VITEWP_ROOT, '/\\') . DIRECTORY_SEPARATOR . ltrim($relative_path, '/\\');
}

function vitewp_bridge_post_types(): array
{
    $post_types = get_post_types(['public' => true, 'show_in_rest' => true], 'objects');
    $items = [];

    foreach ($post_types as $post_type) {
        $items[] = [
            'name' => $post_type->name,
            'restBase' => vitewp_bridge_rest_base($post_type),
            'archive' => (bool) $post_type->has_archive,
            'archiveSlug' => $post_type->has_archive ? vitewp_bridge_archive_slug($post_type) : null,
            'label' => $post_type->label,
            'singularLabel' => $post_type->labels->singular_name,
            'taxonomies' => array_values(get_object_taxonomies($post_type->name)),
            'supports' => get_all_post_type_supports($post_type->name),
        ];
    }

    return $items;
}

function vitewp_bridge_taxonomies(): array
{
    $taxonomies = get_taxonomies(['public' => true, 'show_in_rest' => true], 'objects');
    $items = [];

    foreach ($taxonomies as $taxonomy) {
        $items[] = [
            'name' => $taxonomy->name,
            'restBase' => $taxonomy->rest_base ?: $taxonomy->name,
            'label' => $taxonomy->label,
            'objectTypes' => array_values($taxonomy->object_type),
            'hierarchical' => (bool) $taxonomy->hierarchical,
        ];
    }

    return $items;
}

function vitewp_bridge_page_summary(int $page_id): ?array
{
    if ($page_id <= 0) {
        return null;
    }

    $page = get_post($page_id);

    if (! $page || $page->post_type !== 'page') {
        return null;
    }

    return [
        'id' => $page->ID,
        'slug' => $page->post_name,
        'title' => get_the_title($page),
        'link' => get_permalink($page),
    ];
}

function vitewp_bridge_resolve_path(string $input): WP_REST_Response
{
    $parts = parse_url($input);
    $query = [];
    parse_str($parts['query'] ?? '', $query);

    $path = '/' . trim($parts['path'] ?? '/', '/');
    [$path, $page] = vitewp_bridge_strip_pagination($path);
    $trimmed_path = trim($path, '/');

    $search = vitewp_bridge_search_query($trimmed_path, $query);
    if ($search !== null) {
        return new WP_REST_Response([
            'found' => true,
            'kind' => 'search',
            'slug' => $trimmed_path,
            'postType' => 'post',
            'restBase' => 'posts',
            'title' => sprintf(__('Search results for “%s”'), $search),
            'search' => $search,
            'page' => $page,
        ]);
    }

    if ($path === '/') {
        return vitewp_bridge_resolve_home($page);
    }

    $post_id = url_to_postid(home_url($path));

    if ($post_id > 0) {
        $post = get_post($post_id);

        if ($post) {
            $post_type = get_post_type_object($post->post_type);

            return new WP_REST_Response([
                'found' => true,
                'kind' => $post->post_type === 'page' ? 'page' : 'single',
                'id' => $post->ID,
                'slug' => $post->post_name,
                'postType' => $post->post_type,
                'restBase' => vitewp_bridge_rest_base($post_type),
                'isFrontPage' => false,
                'isPostsPage' => (int) get_option('page_for_posts') === $post->ID,
            ]);
        }
    }

    $single = vitewp_bridge_resolve_single_by_slug($path);

    if ($single) {
        return new WP_REST_Response($single);
    }

    $taxonomy = vitewp_bridge_resolve_taxonomy_archive($path, $page);

    if ($taxonomy) {
        return new WP_REST_Response($taxonomy);
    }

    $archive = vitewp_bridge_resolve_post_type_archive($path, $page);

    if ($archive) {
        return new WP_REST_Response($archive);
    }

    return new WP_REST_Response([
        'found' => false,
        'kind' => 'notFound',
    ], 404);
}

function vitewp_bridge_resolve_home(int $page): WP_REST_Response
{
    if (get_option('show_on_front') === 'page') {
        $front_page_id = (int) get_option('page_on_front');
        $front_page = get_post($front_page_id);

        if ($front_page && $page <= 1) {
            return new WP_REST_Response([
                'found' => true,
                'kind' => 'page',
                'id' => $front_page->ID,
                'slug' => $front_page->post_name,
                'postType' => 'page',
                'restBase' => 'pages',
                'isFrontPage' => true,
                'isPostsPage' => false,
            ]);
        }
    }

    return new WP_REST_Response([
        'found' => true,
        'kind' => 'postsArchive',
        'slug' => '',
        'postType' => 'post',
        'restBase' => 'posts',
        'title' => vitewp_bridge_posts_archive_title(),
        'page' => $page,
    ]);
}

function vitewp_bridge_resolve_single_by_slug(string $path): ?array
{
    $slug = basename(trim($path, '/'));

    if ($slug === '') {
        return null;
    }

    $post_types = array_values(get_post_types(['public' => true], 'names'));

    $query = new WP_Query([
        'name' => $slug,
        'post_type' => $post_types,
        'post_status' => 'publish',
        'posts_per_page' => 1,
        'no_found_rows' => true,
    ]);

    if (! $query->have_posts()) {
        return null;
    }

    $post = $query->posts[0];
    $post_type = get_post_type_object($post->post_type);

    return [
        'found' => true,
        'kind' => $post->post_type === 'page' ? 'page' : 'single',
        'id' => $post->ID,
        'slug' => $post->post_name,
        'postType' => $post->post_type,
        'restBase' => vitewp_bridge_rest_base($post_type),
        'isFrontPage' => (int) get_option('page_on_front') === $post->ID,
        'isPostsPage' => (int) get_option('page_for_posts') === $post->ID,
    ];
}

function vitewp_bridge_resolve_post_type_archive(string $path, int $page): ?array
{
    $trimmed_path = trim($path, '/');

    if ($trimmed_path === '') {
        return null;
    }

    $page_for_posts = (int) get_option('page_for_posts');

    if ($page_for_posts > 0) {
        $posts_page = get_post($page_for_posts);

        if ($posts_page && $trimmed_path === $posts_page->post_name) {
            return [
                'found' => true,
                'kind' => 'postsArchive',
                'slug' => $posts_page->post_name,
                'postType' => 'post',
                'restBase' => 'posts',
                'title' => get_the_title($posts_page),
                'page' => $page,
            ];
        }
    }

    $post_types = get_post_types(['public' => true], 'objects');

    foreach ($post_types as $post_type) {
        if ($post_type->name === 'post' || $post_type->name === 'page') {
            continue;
        }

        if (! $post_type->has_archive) {
            continue;
        }

        $archive_slug = vitewp_bridge_archive_slug($post_type);

        if ($trimmed_path === $archive_slug) {
            return [
                'found' => true,
                'kind' => 'postTypeArchive',
                'slug' => $archive_slug,
                'postType' => $post_type->name,
                'restBase' => vitewp_bridge_rest_base($post_type),
                'title' => $post_type->labels->name,
                'page' => $page,
            ];
        }
    }

    return null;
}

function vitewp_bridge_resolve_taxonomy_archive(string $path, int $page): ?array
{
    $trimmed_path = trim($path, '/');

    if ($trimmed_path === '') {
        return null;
    }

    $segments = explode('/', $trimmed_path);
    $term_slug = end($segments);

    foreach (get_taxonomies(['public' => true], 'objects') as $taxonomy) {
        $base = vitewp_bridge_taxonomy_base($taxonomy);
        $matches_base = count($segments) >= 2 && $segments[0] === $base;
        $matches_direct = count($segments) === 1;

        if (! $matches_base && ! $matches_direct) {
            continue;
        }

        $term = get_term_by('slug', $term_slug, $taxonomy->name);

        if (! $term || is_wp_error($term)) {
            continue;
        }

        return [
            'found' => true,
            'kind' => 'taxonomyArchive',
            'slug' => $term->slug,
            'taxonomy' => $taxonomy->name,
            'taxonomyRestBase' => $taxonomy->rest_base ?: $taxonomy->name,
            'termId' => $term->term_id,
            'termName' => $term->name,
            'postType' => vitewp_bridge_taxonomy_primary_post_type($taxonomy),
            'restBase' => 'posts',
            'title' => $term->name,
            'page' => $page,
        ];
    }

    return null;
}

function vitewp_bridge_archive(WP_REST_Request $request): array
{
    $kind = (string) $request->get_param('kind');
    $page = max(1, (int) ($request->get_param('page') ?: 1));
    $per_page = min(100, max(1, (int) ($request->get_param('perPage') ?: 10)));

    $args = [
        'post_status' => 'publish',
        'posts_per_page' => $per_page,
        'paged' => $page,
    ];

    if ($kind === 'search') {
        $args['post_type'] = array_values(get_post_types(['public' => true], 'names'));
        $args['s'] = (string) $request->get_param('search');
    } elseif ($kind === 'taxonomyArchive') {
        $taxonomy = (string) $request->get_param('taxonomy');
        $term_id = (int) $request->get_param('termId');
        $args['post_type'] = 'any';
        $args['tax_query'] = [[
            'taxonomy' => $taxonomy,
            'field' => 'term_id',
            'terms' => [$term_id],
        ]];
    } else {
        $args['post_type'] = (string) ($request->get_param('postType') ?: 'post');
    }

    $query = new WP_Query($args);

    return [
        'items' => array_map('vitewp_bridge_post_item', $query->posts),
        'page' => $page,
        'perPage' => $per_page,
        'total' => (int) $query->found_posts,
        'totalPages' => (int) $query->max_num_pages,
    ];
}

function vitewp_bridge_post_item(WP_Post $post): array
{
    return [
        'id' => $post->ID,
        'slug' => $post->post_name,
        'type' => $post->post_type,
        'link' => get_permalink($post),
        'title' => ['rendered' => get_the_title($post)],
        'content' => ['rendered' => apply_filters('the_content', $post->post_content)],
        'excerpt' => ['rendered' => apply_filters('the_excerpt', get_the_excerpt($post))],
        'date' => get_post_time(DATE_ATOM, false, $post),
        'modified' => get_post_modified_time(DATE_ATOM, false, $post),
    ];
}

function vitewp_bridge_menus(): array
{
    $locations = get_nav_menu_locations();
    $menus = [];

    foreach (wp_get_nav_menus() as $menu) {
        $items = wp_get_nav_menu_items($menu->term_id) ?: [];
        $menus[] = [
            'id' => $menu->term_id,
            'slug' => $menu->slug,
            'name' => $menu->name,
            'items' => array_map('vitewp_bridge_menu_item', $items),
        ];
    }

    return [
        'locations' => $locations,
        'menus' => $menus,
    ];
}

function vitewp_bridge_menu_item(WP_Post $item): array
{
    return [
        'id' => $item->ID,
        'parent' => (int) $item->menu_item_parent,
        'title' => $item->title,
        'url' => $item->url,
        'target' => $item->target,
        'classes' => array_values(array_filter($item->classes ?? [])),
        'object' => $item->object,
        'objectId' => (int) $item->object_id,
        'type' => $item->type,
    ];
}

function vitewp_bridge_posts_archive_title(): string
{
    $page_for_posts = (int) get_option('page_for_posts');

    if ($page_for_posts > 0) {
        return get_the_title($page_for_posts);
    }

    return __('Posts');
}

function vitewp_bridge_strip_pagination(string $path): array
{
    if (preg_match('#^(.*)/page/([0-9]+)/?$#', $path, $matches)) {
        $base = $matches[1] ?: '/';
        return [$base === '' ? '/' : $base, max(1, (int) $matches[2])];
    }

    return [$path, 1];
}

function vitewp_bridge_search_query(string $trimmed_path, array $query): ?string
{
    $search = trim((string) ($query['s'] ?? $query['q'] ?? ''));

    if ($search !== '') {
        return $search;
    }

    $segments = array_values(array_filter(explode('/', $trimmed_path)));

    if (($segments[0] ?? '') === 'search') {
        return isset($segments[1]) ? urldecode($segments[1]) : '';
    }

    return null;
}

function vitewp_bridge_archive_slug(WP_Post_Type $post_type): string
{
    if (is_string($post_type->has_archive)) {
        return trim($post_type->has_archive, '/');
    }

    if (is_array($post_type->rewrite) && isset($post_type->rewrite['slug'])) {
        return trim((string) $post_type->rewrite['slug'], '/');
    }

    return $post_type->name;
}

function vitewp_bridge_taxonomy_base(WP_Taxonomy $taxonomy): string
{
    if ($taxonomy->name === 'category') {
        return trim((string) get_option('category_base') ?: 'category', '/');
    }

    if ($taxonomy->name === 'post_tag') {
        return trim((string) get_option('tag_base') ?: 'tag', '/');
    }

    if (is_array($taxonomy->rewrite) && isset($taxonomy->rewrite['slug'])) {
        return trim((string) $taxonomy->rewrite['slug'], '/');
    }

    return $taxonomy->name;
}

function vitewp_bridge_taxonomy_primary_post_type(WP_Taxonomy $taxonomy): string
{
    $object_types = array_values($taxonomy->object_type);
    return $object_types[0] ?? 'post';
}

function vitewp_bridge_rest_base(?WP_Post_Type $post_type): string
{
    if (! $post_type) {
        return 'posts';
    }

    return $post_type->rest_base ?: $post_type->name;
}
