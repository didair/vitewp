import { z } from 'astro/zod';

export const wpRenderedFieldSchema = z.looseObject({
  rendered: z.string(),
  protected: z.boolean().optional(),
});

export const wpContentItemSchema = z.looseObject({
  id: z.number(),
  slug: z.string(),
  type: z.string(),
  link: z.string(),
  title: wpRenderedFieldSchema,
  content: wpRenderedFieldSchema,
  excerpt: wpRenderedFieldSchema.optional(),
  date: z.string().optional(),
  modified: z.string().optional(),
  acf: z.record(z.string(), z.unknown()).optional(),
  taxonomies: z.record(z.string(), z.array(z.number())).optional(),
  terms: z.record(z.string(), z.array(z.looseObject({
    id: z.number(),
    termId: z.number(),
    taxonomy: z.string(),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
    link: z.string(),
    parent: z.number(),
    count: z.number(),
  }))).optional(),
});

export const wpResolvedRouteSchema = z.looseObject({
  kind: z.string(),
  postType: z.string(),
  restBase: z.string(),
  slug: z.string(),
});

export const wpMenuItemSchema = z.looseObject({
  id: z.number(),
  parent: z.number(),
  title: z.string(),
  url: z.string(),
  target: z.string(),
  classes: z.array(z.string()),
  object: z.string(),
  objectId: z.number(),
  type: z.string(),
});

export const wpMenuSchema = z.looseObject({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  items: z.array(wpMenuItemSchema),
});
