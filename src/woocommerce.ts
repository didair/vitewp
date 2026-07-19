import { getWordPressBaseUrl } from './wordpress/client.js';
import { getAuthContext, ViteWpAuthRequiredError, type WpWooCommerceCustomer } from './wordpress/auth.js';
import { getRequestContext, type ViteWpAstroLike, type ViteWpRequestContext } from './wordpress/context.js';

type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined | null;
type StoreRequestAuth = { cookie?: string; nonce?: string; context?: ViteWpRequestContext };

export interface WooQuery {
  page?: number;
  perPage?: number;
  search?: string;
  slug?: string;
  order?: 'asc' | 'desc';
  orderby?: string;
  category?: string | number | Array<string | number>;
  tag?: string | number | Array<string | number>;
  brand?: string | number | Array<string | number>;
  include?: Array<string | number>;
  exclude?: Array<string | number>;
  [key: string]: QueryValue;
}

export interface WooCollection<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface WooProductImage {
  id: number;
  src: string;
  thumbnail?: string;
  srcset?: string;
  sizes?: string;
  name?: string;
  alt?: string;
}

export interface WooProductTerm {
  id: number;
  name: string;
  slug: string;
  link?: string;
  permalink?: string;
  parent?: number;
  count?: number;
  description?: string;
  image?: WooProductImage | null;
  review_count?: number;
}

export type WooProductBrand = WooProductTerm;

export interface WooProductAttribute {
  id: number;
  name: string;
  taxonomy?: string;
  has_variations?: boolean;
  terms?: WooProductTerm[];
}

export interface WooProductVariationAttribute {
  name: string;
  value: string;
}

export interface WooProductVariation {
  id: number;
  attributes: WooProductVariationAttribute[];
}

export interface WooProductPrices {
  currency_code: string;
  currency_symbol: string;
  currency_minor_unit: number;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
  currency_prefix: string;
  currency_suffix: string;
  price: string;
  regular_price: string;
  sale_price: string;
  price_range?: {
    min_amount: string;
    max_amount: string;
  } | null;
}

export interface WooProduct {
  id: number;
  name: string;
  parent: number;
  slug: string;
  permalink: string;
  type: string;
  variation: string;
  description: string;
  short_description: string;
  sku: string;
  on_sale: boolean;
  prices: WooProductPrices;
  price_html: string;
  average_rating: string;
  review_count: number;
  images: WooProductImage[];
  categories: WooProductTerm[];
  tags: WooProductTerm[];
  brands: WooProductTerm[];
  attributes: WooProductAttribute[];
  variations: WooProductVariation[];
  has_options: boolean;
  is_in_stock: boolean;
  is_purchasable: boolean;
  is_on_backorder: boolean;
  low_stock_remaining: number | null;
  sold_individually: boolean;
  add_to_cart?: {
    text: string;
    description: string;
    url: string;
    minimum: number;
    maximum: number;
    multiple_of: number;
  };
  extensions: Record<string, unknown>;
}

export interface WooAttribute {
  id: number;
  name: string;
  taxonomy: string;
  type: string;
  order: string;
  has_archives: boolean;
}

export interface WooReview {
  id: number;
  date_created: string;
  formatted_date_created: string;
  product_id: number;
  product_name: string;
  product_permalink: string;
  reviewer: string;
  review: string;
  rating: number;
  verified: boolean;
  reviewer_avatar_urls: Record<string, string>;
}

export interface WooReviewQuery {
  productId?: number;
  page?: number;
  perPage?: number;
  [key: string]: QueryValue;
}

export type WooCustomer = WpWooCommerceCustomer;

export interface WooCartItemMeta {
  key?: string;
  name?: string;
  value?: string;
  display?: string;
  [key: string]: unknown;
}

export interface WooCartItemQuantityLimits {
  minimum: number;
  maximum: number;
  multiple_of: number;
  editable: boolean;
}

export interface WooCartItem {
  key: string;
  id: number;
  type: string;
  quantity: number;
  quantity_limits?: WooCartItemQuantityLimits;
  name: string;
  short_description?: string;
  description?: string;
  sku?: string;
  low_stock_remaining?: number | null;
  images: WooProductImage[];
  variation: WooCartItemMeta[];
  item_data: WooCartItemMeta[];
  prices: Record<string, unknown>;
  totals: Record<string, unknown>;
  catalog_visibility?: string;
  permalink?: string;
  extensions: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WooCart {
  items: WooCartItem[];
  items_count: number;
  items_weight: number;
  needs_payment: boolean;
  needs_shipping: boolean;
  has_calculated_shipping: boolean;
  itemsCount?: number;
  itemsWeight?: number;
  needsPayment?: boolean;
  needsShipping?: boolean;
  hasCalculatedShipping?: boolean;
  fees: unknown[];
  totals: Record<string, unknown>;
  errors: unknown[];
  payment_requirements: string[];
  shipping_rates: unknown[];
  cross_sells: unknown[];
  paymentRequirements?: string[];
  shippingRates?: unknown[];
  coupons: unknown[];
  crossSells?: unknown[];
  notices: unknown[];
  extensions: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WooAddCartItemOptions {
  id: number;
  quantity?: number;
  variation?: WooCartItemMeta[] | Record<string, string | number | boolean>;
  itemData?: Record<string, unknown>;
  item_data?: Record<string, unknown>;
}

export interface WooUpdateCartItemOptions {
  key: string;
  quantity: number;
}

export interface WooRemoveCartItemOptions {
  key: string;
}

export async function getProducts(query: WooQuery = {}): Promise<WooProduct[]> {
  return getProductCollection(query).then((collection) => collection.items);
}

export async function getProductCollection(query: WooQuery = {}): Promise<WooCollection<WooProduct>> {
  return getStoreCollection<WooProduct>('products', query);
}

export async function getProduct(id: number): Promise<WooProduct> {
  return getStoreJson<WooProduct>(`products/${id}`);
}

export async function getProductBySlug(slug: string): Promise<WooProduct | null> {
  const products = await getProducts({ slug, perPage: 1 });
  return products[0] ?? null;
}

export async function getProductCategories(query: WooQuery = {}): Promise<WooProductTerm[]> {
  return getStoreJson<WooProductTerm[]>('products/categories', query);
}

export async function getProductTags(query: WooQuery = {}): Promise<WooProductTerm[]> {
  return getStoreJson<WooProductTerm[]>('products/tags', query);
}

export async function getProductBrands(query: WooQuery = {}): Promise<WooProductTerm[]> {
  return getStoreJson<WooProductTerm[]>('products/brands', query, [404]);
}

export async function getProductAttributes(query: WooQuery = {}): Promise<WooAttribute[]> {
  return getStoreJson<WooAttribute[]>('products/attributes', query);
}

export async function getProductAttributeTerms(attributeId: number, query: WooQuery = {}): Promise<WooProductTerm[]> {
  return getStoreJson<WooProductTerm[]>(`products/attributes/${attributeId}/terms`, query);
}

export async function getProductReviews(query: WooReviewQuery = {}): Promise<WooReview[]> {
  const params = { ...query };

  if (query.productId !== undefined) {
    params.product_id = query.productId;
    delete params.productId;
  }

  return getStoreJson<WooReview[]>('products/reviews', params);
}

export async function getCurrentCustomer(input?: ViteWpAstroLike): Promise<WooCustomer | null> {
  const auth = await getAuthContext(input);
  return auth.woocommerce?.customer ?? null;
}

export async function requireCustomer(input?: ViteWpAstroLike): Promise<WooCustomer> {
  const auth = await getAuthContext(input);
  const customer = auth.woocommerce?.customer ?? null;

  if (!customer) {
    throw new ViteWpAuthRequiredError(auth.woocommerce?.myAccountUrl ?? auth.loginUrl);
  }

  return customer;
}

export async function getCart(input?: ViteWpAstroLike): Promise<WooCart> {
  return getStoreJson<WooCart>('cart', {}, [], await getCartRequestAuth(input));
}

export async function addCartItem(options: WooAddCartItemOptions, input?: ViteWpAstroLike): Promise<WooCart> {
  const body: Record<string, unknown> = {
    id: options.id,
  };

  if (options.quantity !== undefined) {
    body.quantity = options.quantity;
  }

  if (options.variation !== undefined) {
    body.variation = options.variation;
  }

  const itemData = options.item_data ?? options.itemData;

  if (itemData !== undefined) {
    body.item_data = itemData;
  }

  return postStoreJson<WooCart>('cart/add-item', body, await getCartRequestAuth(input));
}

export const addToCart = addCartItem;

export async function updateCartItem(options: WooUpdateCartItemOptions, input?: ViteWpAstroLike): Promise<WooCart> {
  return postStoreJson<WooCart>('cart/update-item', { ...options }, await getCartRequestAuth(input));
}

export async function removeCartItem(options: WooRemoveCartItemOptions, input?: ViteWpAstroLike): Promise<WooCart> {
  return postStoreJson<WooCart>('cart/remove-item', { ...options }, await getCartRequestAuth(input));
}

export function getWooCommerceStoreApiBase() {
  return `${getWordPressBaseUrl()}/wp-json/wc/store/v1`;
}

async function getStoreCollection<T>(path: string, query: Record<string, QueryValue>): Promise<WooCollection<T>> {
  const { response, data } = await fetchStoreJson<T[]>(path, query);
  const page = Number(query.page ?? 1);
  const perPage = Number(query.perPage ?? query.per_page ?? data.length);

  return {
    items: data,
    page,
    perPage,
    total: Number(response.headers.get('x-wp-total') ?? data.length),
    totalPages: Number(response.headers.get('x-wp-totalpages') ?? 1),
  };
}

async function getStoreJson<T>(
  path: string,
  query: Record<string, QueryValue> = {},
  emptyStatuses: number[] = [],
  auth: StoreRequestAuth = {},
): Promise<T> {
  const { data } = await fetchStoreJson<T>(path, query, emptyStatuses, auth);
  return data;
}

async function fetchStoreJson<T>(
  path: string,
  query: Record<string, QueryValue> = {},
  emptyStatuses: number[] = [],
  auth: StoreRequestAuth = {},
) {
  const url = storeUrl(path, query);
  const response = await fetch(url, {
    headers: storeRequestHeaders(auth),
  });

  if (emptyStatuses.includes(response.status)) {
    return { response, data: [] as T };
  }

  if (!response.ok) {
    throw new Error(`WooCommerce Store API request failed: ${response.status} ${response.statusText}`);
  }

  return {
    response,
    data: await response.json() as T,
  };
}

async function postStoreJson<T>(
  path: string,
  body: Record<string, unknown>,
  auth: StoreRequestAuth,
): Promise<T> {
  const response = await fetch(storeUrl(path, {}), {
    method: 'POST',
    headers: {
      ...storeRequestHeaders(auth),
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`WooCommerce Store API request failed: ${response.status} ${response.statusText} ${message}`.trim());
  }

  forwardStoreResponseCookies(response, auth.context);

  return response.json() as Promise<T>;
}

async function getCartRequestAuth(input?: ViteWpAstroLike) {
  const context = getRequestContext(input);
  const auth = await getAuthContext(input);
  return {
    cookie: context.cookie,
    nonce: auth.woocommerce?.storeApiNonce,
    context,
  };
}

function forwardStoreResponseCookies(response: Response, context?: ViteWpRequestContext) {
  if (!context) return;

  for (const cookie of getResponseSetCookies(response.headers)) {
    context.responseHeaders?.append('set-cookie', cookie);
    context.responseCookies.push(cookie);
  }
}

function getResponseSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };

  if (withGetSetCookie.getSetCookie) {
    return withGetSetCookie.getSetCookie();
  }

  const cookie = headers.get('set-cookie');
  return cookie ? [cookie] : [];
}

function storeRequestHeaders(auth: StoreRequestAuth): Record<string, string> {
  const headers: Record<string, string> = {};

  if (auth.cookie) {
    headers.cookie = auth.cookie;
  }

  if (auth.nonce) {
    headers.nonce = auth.nonce;
    headers['x-wp-nonce'] = auth.nonce;
  }

  return headers;
}

function storeUrl(path: string, query: Record<string, QueryValue>) {
  const url = new URL(`${getWooCommerceStoreApiBase()}/${path.replace(/^\/+/, '')}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    const param = key === 'perPage' ? 'per_page' : key;

    if (Array.isArray(value)) {
      url.searchParams.set(param, value.join(','));
    } else {
      url.searchParams.set(param, String(value));
    }
  }

  return url;
}
