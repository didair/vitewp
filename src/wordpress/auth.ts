import { getRequestContext, type ViteWpAstroLike, type ViteWpRequestContext } from './context.js';
import { getWordPressBaseUrl } from './client.js';

export interface WpCurrentUser {
  id: number;
  username: string;
  email: string;
  name: string;
  displayName: string;
  firstName: string;
  lastName: string;
  roles: string[];
  capabilities: string[];
  avatarUrls: Record<string, string>;
}

export interface WpNonce {
  action: string;
  value: string;
}

export interface WpAuthContext {
  loggedIn: boolean;
  user: WpCurrentUser | null;
  nonce: WpNonce;
  restNonce: string;
  loginUrl: string;
  logoutUrl: string;
  lostPasswordUrl: string;
  registerUrl: string;
  woocommerce?: WpWooCommerceAuthContext | null;
}

export interface WpWooCommerceCustomer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
}

export interface WpWooCommerceAuthContext {
  active: boolean;
  customer: WpWooCommerceCustomer | null;
  myAccountUrl: string;
  cartUrl: string;
  checkoutUrl: string;
  storeApiNonce: string;
}

export interface AuthContextOptions {
  action?: string;
  redirectTo?: string;
}

export class ViteWpAuthRequiredError extends Error {
  loginUrl: string;
  response: Response;

  constructor(loginUrl: string) {
    super(`Authentication required. Redirect the request to ${loginUrl}.`);
    this.name = 'ViteWpAuthRequiredError';
    this.loginUrl = loginUrl;
    this.response = Response.redirect(loginUrl, 302);
  }
}

export async function getAuthContext(
  input?: ViteWpAstroLike | AuthContextOptions,
  options: AuthContextOptions = {},
): Promise<WpAuthContext> {
  const { context, authOptions } = resolveAuthInput(input, options);
  const action = authOptions.action ?? 'wp_rest';
  const redirectTo = authOptions.redirectTo ?? context.url.pathname;
  const cacheKey = `wordpress:auth:${action}:${redirectTo}`;
  const cached = context.cache.get(cacheKey);

  if (cached) {
    return cached as WpAuthContext;
  }

  const auth = await fetchAuthContext(context, action, redirectTo);
  context.cache.set(cacheKey, auth);
  return auth;
}

export async function getCurrentUser(input?: ViteWpAstroLike | AuthContextOptions): Promise<WpCurrentUser | null> {
  return getAuthContext(input).then((auth) => auth.user);
}

export async function isLoggedIn(input?: ViteWpAstroLike | AuthContextOptions): Promise<boolean> {
  return getAuthContext(input).then((auth) => auth.loggedIn);
}

export async function requireUser(input?: ViteWpAstroLike | AuthContextOptions): Promise<WpCurrentUser> {
  const auth = await getAuthContext(input);

  if (!auth.user) {
    throw new ViteWpAuthRequiredError(auth.loginUrl);
  }

  return auth.user;
}

export async function getNonce(
  input?: ViteWpAstroLike | AuthContextOptions,
  options: AuthContextOptions = {},
): Promise<WpNonce> {
  return getAuthContext(input, options).then((auth) => auth.nonce);
}

export async function loginUrl(input?: ViteWpAstroLike | AuthContextOptions): Promise<string> {
  return getAuthContext(input).then((auth) => auth.loginUrl);
}

export async function logoutUrl(input?: ViteWpAstroLike | AuthContextOptions): Promise<string> {
  return getAuthContext(input).then((auth) => auth.logoutUrl);
}

function resolveAuthInput(input: ViteWpAstroLike | AuthContextOptions | undefined, options: AuthContextOptions) {
  if (isAstroLike(input)) {
    return {
      context: getRequestContext(input),
      authOptions: options,
    };
  }

  return {
    context: getRequestContext(),
    authOptions: input ?? options,
  };
}

function isAstroLike(input: unknown): input is ViteWpAstroLike {
  return Boolean(input && typeof input === 'object' && 'request' in input);
}

async function fetchAuthContext(context: ViteWpRequestContext, action: string, redirectTo: string) {
  const phpUrl = process.env.VITEWP_PHP_URL;
  const secret = process.env.VITEWP_INTERNAL_SECRET;

  if (!phpUrl || !secret) {
    throw new Error('WordPress auth helpers are only available during ViteWP SSR. Start the site with `vite-wp dev`.');
  }

  const url = new URL(`${phpUrl.replace(/\/$/, '')}/index.php`);
  url.searchParams.set('vitewp_internal_auth', '1');
  url.searchParams.set('action', action);
  url.searchParams.set('redirect_to', new URL(redirectTo, context.url).toString());

  const response = await fetch(url, {
    headers: authRequestHeaders(context, secret),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`WordPress auth context failed: ${response.status} ${message}`);
  }

  return response.json() as Promise<WpAuthContext>;
}

export function authRequestHeaders(context: ViteWpRequestContext, secret: string): HeadersInit {
  const headers: Record<string, string> = {
    'x-vitewp-internal-secret': secret,
  };

  if (context.cookie) {
    headers.cookie = context.cookie;
  }

  const publicUrl = process.env.VITEWP_PUBLIC_URL ?? getWordPressBaseUrl();

  if (publicUrl) {
    const url = new URL(publicUrl);
    headers.host = url.host;
    headers['x-forwarded-host'] = url.host;
    headers['x-forwarded-proto'] = url.protocol.replace(':', '');

    if (url.port) {
      headers['x-forwarded-port'] = url.port;
    }

    if (url.protocol === 'https:') {
      headers['x-forwarded-ssl'] = 'on';
    }
  }

  return headers;
}
