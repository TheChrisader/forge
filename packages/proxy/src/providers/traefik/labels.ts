export interface TraefikRouteConfig {
  routeId: string;
  domains: string[];
  targetPort: number;
  pathPrefix?: string;
  httpsRedirect?: boolean;
  tlsResolver?: string;
  middlewares?: string[];
  stickySessions?: boolean;
  headers?: Record<string, string>;
  priority?: number;
  enabled?: boolean;
}

/**
 * Builds Traefik v3 Docker labels from a route configuration.
 *
 * Output follows Traefik's label schema:
 * - `traefik.enable` — master switch
 * - `traefik.http.routers.{routeId}.rule` — routing rule (Host + optional PathPrefix)
 * - `traefik.http.routers.{routeId}.entrypoints` — websecure (HTTPS)
 * - `traefik.http.routers.{routeId}.tls.certresolver` — ACME resolver
 * - `traefik.http.routers.{routeId}.service` — linked service
 * - `traefik.http.services.{routeId}.loadbalancer.server.port` — target port
 *
 * When `httpsRedirect` is true, an additional HTTP→HTTPS redirect router is emitted.
 * When `pathPrefix` is set, a StripPrefix middleware is automatically added.
 */
export function buildTraefikLabels(config: TraefikRouteConfig): Record<string, string> {
  const labels: Record<string, string> = {};

  const isEnabled = config.enabled !== false;
  labels["traefik.enable"] = String(isEnabled);

  if (!isEnabled) {
    return labels;
  }

  const hostMatchers = config.domains.map((d) => `Host(\`${d}\`)`).join(" || ");

  let rule = hostMatchers;
  if (config.pathPrefix) {
    rule = `${hostMatchers} && PathPrefix(\`${config.pathPrefix}\`)`;
  }

  const rid = config.routeId;

  labels[`traefik.http.routers.${rid}.rule`] = rule;
  labels[`traefik.http.routers.${rid}.entrypoints`] = "websecure";
  labels[`traefik.http.routers.${rid}.service`] = rid;

  if (config.priority !== undefined) {
    labels[`traefik.http.routers.${rid}.priority`] = String(config.priority);
  }

  if (config.tlsResolver) {
    labels[`traefik.http.routers.${rid}.tls.certresolver`] = config.tlsResolver;
    labels[`traefik.http.routers.${rid}.tls`] = "true";
  }

  if (config.pathPrefix) {
    const stripMiddlewareId = `${rid}-strip`;
    labels[`traefik.http.middlewares.${stripMiddlewareId}.stripprefix.prefixes`] =
      config.pathPrefix;

    const existingMiddlewares = config.middlewares || [];
    const allMiddlewares = [stripMiddlewareId, ...existingMiddlewares];
    labels[`traefik.http.routers.${rid}.middlewares`] = allMiddlewares.join(",");
  } else if (config.middlewares && config.middlewares.length > 0) {
    labels[`traefik.http.routers.${rid}.middlewares`] = config.middlewares.join(",");
  }

  if (config.httpsRedirect) {
    const httpRouterId = `${rid}-http`;
    labels[`traefik.http.routers.${httpRouterId}.rule`] = hostMatchers;
    labels[`traefik.http.routers.${httpRouterId}.entrypoints`] = "web";
    labels[`traefik.http.routers.${httpRouterId}.middlewares`] = `${rid}-redirect`;

    const redirectMiddlewareId = `${rid}-redirect`;
    labels[`traefik.http.middlewares.${redirectMiddlewareId}.redirectscheme.scheme`] = "https";
    labels[`traefik.http.middlewares.${redirectMiddlewareId}.redirectscheme.permanent`] = "true";
  }

  labels[`traefik.http.services.${rid}.loadbalancer.server.port`] = String(config.targetPort);

  if (config.stickySessions) {
    labels[`traefik.http.services.${rid}.loadbalancer.sticky.cookie.name`] = `lb_${rid}`;
    labels[`traefik.http.services.${rid}.loadbalancer.sticky.cookie.httponly`] = "true";
    labels[`traefik.http.services.${rid}.loadbalancer.sticky.cookie.secure`] = "true";
    labels[`traefik.http.services.${rid}.loadbalancer.sticky.cookie.samesite`] = "lax";
  }

  if (config.headers && Object.keys(config.headers).length > 0) {
    const headersMiddlewareId = `${rid}-headers`;
    for (const [key, value] of Object.entries(config.headers)) {
      labels[
        `traefik.http.middlewares.${headersMiddlewareId}.headers.customresponseheaders.${key}`
      ] = value;
    }

    const existingRouterMiddlewares =
      labels[`traefik.http.routers.${rid}.middlewares`]?.split(",").filter(Boolean) || [];
    existingRouterMiddlewares.push(headersMiddlewareId);
    labels[`traefik.http.routers.${rid}.middlewares`] = existingRouterMiddlewares.join(",");
  }

  return labels;
}
