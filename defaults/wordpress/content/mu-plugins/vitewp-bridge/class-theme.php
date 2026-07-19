<?php

final class ViteWP_Bridge_Theme
{
    public static function forceTheme(): string
    {

        return VITEWP_THEME;
    }

    public static function registerNavMenus(): void
    {

        $menus = ViteWP_Bridge_Theme::configuredMenus();

        if ($menus !== []) {
            register_nav_menus($menus);
        }
    }

    public static function configuredMenus(): array
    {

        if (! defined('VITEWP_MENUS')) {
            return [];
        }

        $decoded = json_decode((string) VITEWP_MENUS, true);

        if (! is_array($decoded)) {
            return [];
        }

        $menus = [];

        foreach ($decoded as $location => $label) {
            $location = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $location);

            if ($location === '') {
                continue;
            }

            $label = wp_strip_all_tags((string) $label);
            $menus[$location] = $label !== '' ? $label : $location;
        }

        return $menus;
    }

}
