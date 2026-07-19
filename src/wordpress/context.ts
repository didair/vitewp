import { AsyncLocalStorage } from 'node:async_hooks';

export interface ViteWpAstroLike {
  request: Request;
  response?: {
    headers?: Headers;
  };
  url?: URL;
  locals?: App.Locals;
  redirect?: (path: string, status?: 300 | 301 | 302 | 303 | 304 | 307 | 308) => Response;
}

export interface ViteWpRequestContext {
  request: Request;
  url: URL;
  headers: Headers;
  cookie: string;
  responseHeaders?: Headers;
  responseCookies: string[];
  locals?: App.Locals;
  redirect?: (path: string, status?: 300 | 301 | 302 | 303 | 304 | 307 | 308) => Response;
  cache: Map<string, unknown>;
}

const requestContext = new AsyncLocalStorage<ViteWpRequestContext>();

export function runWithRequestContext<T>(astro: ViteWpAstroLike, callback: () => T): T {
  return requestContext.run(createRequestContext(astro), callback);
}

export function getRequestContext(astro?: ViteWpAstroLike): ViteWpRequestContext {
  if (astro) {
    return createRequestContext(astro);
  }

  const context = requestContext.getStore();

  if (!context) {
    throw new Error('No ViteWP request context found. Use this helper during Astro SSR or pass the Astro object explicitly.');
  }

  return context;
}

export function getOptionalRequestContext(): ViteWpRequestContext | null {
  return requestContext.getStore() ?? null;
}

function createRequestContext(astro: ViteWpAstroLike): ViteWpRequestContext {
  const headers = astro.request.headers;
  return {
    request: astro.request,
    url: astro.url ?? new URL(astro.request.url),
    headers,
    cookie: headers.get('cookie') ?? '',
    responseHeaders: astro.response?.headers,
    responseCookies: [],
    locals: astro.locals,
    redirect: astro.redirect,
    cache: new Map(),
  };
}
