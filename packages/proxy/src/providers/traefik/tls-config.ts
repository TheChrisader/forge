import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { CertFileSet } from "../../utils/cert-files";

/**
 * Generates the fullchain file (cert + CA concatenated) that Traefik's
 * file-provider TLS store requires.
 *
 * Writes to a Traefik-internal working directory — NOT to the user's cert store.
 */
export function generateFullChain(certSet: CertFileSet, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });
  const fullChainPath = join(outputDir, "fullchain.pem");

  const certContent = readFileSync(certSet.cert, "utf-8");
  const caContent = readFileSync(certSet.caCert, "utf-8");
  writeFileSync(fullChainPath, `${certContent}\n${caContent}`);

  return fullChainPath;
}

/**
 * Generates a Traefik file-provider config (TOML) that includes TLS
 * certificate references and an HTTP route for the CRL endpoint.
 *
 * When `apiUrl` is provided, a router and service are added so that
 * `/.well-known/crl/` requests are forwarded to the Forge API server.
 * The CRL is served over plain HTTP (entrypoint "web") to avoid the
 * circular dependency of fetching a CRL over the TLS connection it validates.
 *
 * Writes to a Traefik-internal working directory — NOT to the user's cert store.
 */
export function generateTlsConfig(
  fullChainMountPath: string,
  keyMountPath: string,
  outputDir: string,
  apiUrl?: string
): string {
  let configContent = `[[tls.certificates]]
  certFile = "${fullChainMountPath}"
  keyFile = "${keyMountPath}"

[tls.stores]
  [tls.stores.default]
    [tls.stores.default.defaultCertificate]
      certFile = "${fullChainMountPath}"
      keyFile = "${keyMountPath}"
`;

  if (apiUrl) {
    configContent += `
[http.routers.forge-crl]
  rule = "PathPrefix(\`/.well-known/crl/\`)"
  service = "forge-api"
  entryPoints = ["web"]

[http.services.forge-api]
  [http.services.forge-api.loadBalancer]
    [[http.services.forge-api.loadBalancer.servers]]
      url = "${apiUrl}"
`;
  }

  const configPath = join(outputDir, "tls-config.toml");
  writeFileSync(configPath, configContent);

  return configPath;
}
