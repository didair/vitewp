import type { WpContentItem, WpResolvedRoute } from './client.js';

export interface TemplateContext {
  route: WpResolvedRoute;
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

export function createTemplateContext(route: WpResolvedRoute): TemplateContext {
  switch (route.kind) {
    case 'postsArchive':
    case 'postTypeArchive':
    case 'search':
      return {
        route,
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
        route,
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
        route,
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
