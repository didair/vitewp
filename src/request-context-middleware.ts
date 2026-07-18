import { defineMiddleware } from 'astro:middleware';
import { runWithRequestContext } from './wordpress/context.js';

export const onRequest = defineMiddleware((context, next) => {
  return runWithRequestContext(context, () => next());
});
