import type { WpContentItem, WpResolvedRoute } from './client.js';

export interface TemplateContext {
  route: WpResolvedRoute;
  url: string;
  path: string;
  cacheKey: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  postType: string;
  items: WpContentItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  search?: string;
  taxonomy?: string;
  termName?: string;
}

export interface TemplateContextOptions {
  url?: string;
  path?: string;
}

export function createTemplateContext(route: WpResolvedRoute, options: TemplateContextOptions = {}): TemplateContext {
  const base = {
    route,
    url: options.url ?? '',
    path: options.path ?? '',
    cacheKey: createCacheKey(route, options),
  };

  switch (route.kind) {
    case 'postsArchive':
    case 'postTypeArchive':
    case 'search':
      return {
        ...base,
        title: route.title,
        content: '',
        excerpt: '',
        slug: route.slug,
        postType: route.postType,
        items: route.items,
        page: route.page,
        perPage: route.perPage,
        total: route.total,
        totalPages: route.totalPages,
        search: route.search,
      };
    case 'taxonomyArchive':
      return {
        ...base,
        title: route.title,
        content: '',
        excerpt: '',
        slug: route.slug,
        postType: route.postType,
        items: route.items,
        page: route.page,
        perPage: route.perPage,
        total: route.total,
        totalPages: route.totalPages,
        taxonomy: route.taxonomy,
        termName: route.termName,
      };
    case 'page':
    case 'single':
      return {
        ...base,
        title: route.item.title.rendered,
        content: route.item.content.rendered,
        excerpt: route.item.excerpt?.rendered ?? '',
        slug: route.slug,
        postType: route.postType,
        items: [],
        page: 1,
        perPage: 0,
        total: 0,
        totalPages: 0,
      };
  }
}

function createCacheKey(route: WpResolvedRoute, options: TemplateContextOptions) {
  return [
    route.kind,
    'postType' in route ? route.postType : '',
    route.slug,
    'item' in route ? route.item.id : '',
    'taxonomy' in route ? route.taxonomy : '',
    'termId' in route ? route.termId : '',
    'page' in route ? route.page : '',
    options.path ?? '',
  ].join(':');
}

export function templateCandidates(route: WpResolvedRoute): string[] {
  if (route.kind === 'search') {
    return ['search.astro', 'posts/archive.astro'];
  }

  if (route.kind === 'taxonomyArchive') {
    return [
      `taxonomies/${route.taxonomy}-${route.slug}.astro`,
      `taxonomies/${route.taxonomy}.astro`,
      'taxonomies/taxonomy-[taxonomy].astro',
      'posts/archive.astro',
    ];
  }

  if (route.kind === 'postsArchive') {
    return ['posts/archive.astro'];
  }

  if (route.kind === 'postTypeArchive') {
    return [
      `post-types/${route.postType}/archive.astro`,
      'posts/archive.astro',
    ];
  }

  if (route.kind === 'page') {
    return [
      ...(route.isFrontPage ? ['pages/front-page.astro'] : []),
      `pages/page-${route.slug}.astro`,
      'pages/default.astro',
    ];
  }

  return [
    `post-types/${route.postType}/single-${route.slug}.astro`,
    `post-types/${route.postType}/single.astro`,
    ...(route.postType === 'post' ? [] : ['posts/single.astro']),
    `posts/single-${route.slug}.astro`,
    'posts/single.astro',
  ];
}
