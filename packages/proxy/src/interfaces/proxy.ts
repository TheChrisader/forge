export interface Route {
  id: string;
  domain: string;
  path?: string;
  target: string;
  stripPrefix?: boolean;
  preserveHost?: boolean;
  headers?: Record<string, string>;
  middlewares?: string[];
}

export interface Certificate {
  domain: string;
  certPath: string;
  keyPath: string;
  autoRenew?: boolean;
}

export interface Middleware {
  id: string;
  type: "auth" | "ratelimit" | "cors" | "compress" | "retry" | "custom";
  config: Record<string, unknown>;
}

export interface HealthCheck {
  path: string;
  interval: string;
  timeout: string;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

export interface LoadBalancer {
  algorithm: "round-robin" | "least-conn" | "ip-hash" | "random";
  targets: Array<{
    url: string;
    weight?: number;
  }>;
  healthCheck?: HealthCheck;
}

export interface IReverseProxy {
  addRoute(route: Route): Promise<void>;

  removeRoute(id: string): Promise<void>;

  updateRoute(id: string, updates: Partial<Route>): Promise<void>;

  getRoutes(): Promise<Route[]>;

  getRoute(id: string): Promise<Route | null>;

  addCertificate(cert: Certificate): Promise<void>;

  removeCertificate(domain: string): Promise<void>;

  addMiddleware(middleware: Middleware): Promise<void>;

  removeMiddleware(id: string): Promise<void>;

  reload(): Promise<void>;

  getStatus(): Promise<{
    healthy: boolean;
    routes: number;
    uptime: number;
  }>;

  toggleRoute(id: string, enabled: boolean): Promise<void>;

  configureLoadBalancer(routeId: string, config: LoadBalancer): Promise<void>;
}

export interface IReverseProxyFactory {
  create(config: ReverseProxyConfig): Promise<IReverseProxy>;
}

export type ReverseProxyType = "traefik" | "caddy" | "nginx" | "custom" | "none";

export interface ReverseProxyConfig {
  type: ReverseProxyType;
  httpPort?: number;
  httpsPort?: number;
  apiUrl?: string;
  configPath?: string;
  domain?: string;
  ssl?: {
    enabled?: boolean;
    autoGenerate?: boolean;
    email?: string;
    certFile?: string;
    keyFile?: string;
    caCertFile?: string;
    certPath?: string;
    mode?: "letsencrypt" | "selfsigned";
  };
  network?: string;
  dashboard?: boolean;
  traefikImage?: string;
  logLevel?: string;
  dockerSocketPath?: string;
}
