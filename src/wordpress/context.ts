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
  wooCartToken?: string;
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
  const context = requestContext.getStore();

  if (astro) {
    if (context?.request === astro.request) {
      return context;
    }

    return createRequestContext(astro);
  }

  if (!context) {
    throw new Error('No ViteWP request context found. Use this helper during Astro SSR or pass the Astro object explicitly.');
  }

  return context;
}

export function getOptionalRequestContext(): ViteWpRequestContext | null {
  return requestContext.getStore() ?? null;
}

export function forwardResponseCookies(response: Response, context: ViteWpRequestContext): void {
  for (const cookie of getResponseSetCookies(response.headers)) {
    context.responseHeaders?.append('set-cookie', cookie);
    context.responseCookies.push(cookie);
  }
}

function createRequestContext(astro: ViteWpAstroLike): ViteWpRequestContext {
  const headers = astro.request.headers;
  return {
    request: astro.request,
    url: astro.url ?? new URL(astro.request.url),
    headers,
    cookie: headers.get('cookie') ?? '',
    wooCartToken: readCookie(headers.get('cookie') ?? '', 'vitewp_woocommerce_cart_token'),
    responseHeaders: astro.response?.headers,
    responseCookies: [],
    locals: astro.locals,
    redirect: astro.redirect,
    cache: new Map(),
  };
}

function getResponseSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };

  if (withGetSetCookie.getSetCookie) {
    return withGetSetCookie.getSetCookie();
  }

  const cookie = headers.get('set-cookie');
  return cookie ? [cookie] : [];
}

function readCookie(header: string, name: string): string | undefined {
  for (const cookie of header.split(';')) {
    const [cookieName, ...value] = cookie.trim().split('=');

    if (cookieName !== name) continue;

    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return value.join('=');
    }
  }

  return undefined;
}
