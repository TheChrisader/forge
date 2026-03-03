const DOMAIN_COMPONENT = /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])$/;
const PATH_COMPONENT_REGEX = /^[a-z0-9]+(?:(?:[._]|__|[-]*)[a-z0-9]+)*$/;
const TAG_REGEX = /^[\w][\w.-]{0,127}$/;
const DIGEST_REGEX = /^[A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*:[0-9a-fA-F]{32,}$/;

export interface DockerImageReference {
  /** Original input string */
  readonly original: string;

  /** Registry domain (e.g., "docker.io", "localhost:5000") */
  readonly domain: string | null;

  /** Repository path (e.g., "library/alpine", "myorg/myapp") */
  readonly path: string;

  /** Full repository name including domain if present */
  readonly repository: string;

  /** Tag (e.g., "latest", "v1.0.0") */
  readonly tag: string | null;

  /** Digest (e.g., "sha256:abc123...") */
  readonly digest: string | null;

  /** Whether this is a localhost reference */
  readonly isLocalhost: boolean;

  /** Normalized canonical form */
  readonly canonical: string;
}

export class DockerImageParseError extends Error {
  constructor(
    message: string,
    public readonly input: string,
    public readonly position?: number
  ) {
    super(`Invalid Docker image reference: ${message}`);
    this.name = "DockerImageParseError";
  }
}

function isValidDomainComponent(component: string): boolean {
  if (component.length === 0 || component.length > 63) {
    return false;
  }
  return DOMAIN_COMPONENT.test(component);
}

function isValidDomain(domain: string): boolean {
  const colonIndex = domain.lastIndexOf(":");
  if (colonIndex !== -1) {
    const host = domain.substring(0, colonIndex);
    const port = domain.substring(colonIndex + 1);

    if (!/^\d+$/.test(port)) {
      return false;
    }
    const portNum = parseInt(port, 10);
    if (portNum < 1 || portNum > 65535) {
      return false;
    }

    domain = host;
  }

  if (domain === "localhost") {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    const parts = domain.split(".");
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  if (domain.length === 0 || domain.length > 255) {
    return false;
  }

  if (!domain.includes(".") && domain !== "localhost") {
    return false;
  }

  const components = domain.split(".");
  return components.every(isValidDomainComponent);
}

function isValidPathComponent(component: string): boolean {
  if (component.length === 0) {
    return false;
  }
  if (component.length > 128) {
    return false;
  }
  return PATH_COMPONENT_REGEX.test(component);
}

function isValidPath(path: string): boolean {
  if (path.length === 0 || path.length > 255) {
    return false;
  }

  const components = path.split("/");

  if (components[0] === "" || components[components.length - 1] === "") {
    return false;
  }

  return components.every(isValidPathComponent);
}

function isValidTag(tag: string): boolean {
  if (tag.length === 0 || tag.length > 128) {
    return false;
  }
  return TAG_REGEX.test(tag);
}

function isValidDigest(digest: string): boolean {
  return DIGEST_REGEX.test(digest);
}

export function parseDockerImage(reference: string): DockerImageReference {
  if (typeof reference !== "string") {
    if (typeof reference === "object") {
      reference = JSON.stringify(reference);
    } else {
      reference = String(reference);
    }

    throw new DockerImageParseError("Reference must be a string", reference);
  }

  const original = reference;
  let remaining = reference.trim();

  if (remaining.length === 0) {
    throw new DockerImageParseError("Empty reference", original);
  }

  if (/\s/.test(remaining)) {
    throw new DockerImageParseError("Reference cannot contain whitespace", original);
  }

  if (remaining.length > 1024) {
    throw new DockerImageParseError("Reference too long (max 1024 characters)", original);
  }

  let domain: string | null = null;
  let path: string;
  let tag: string | null = null;
  let digest: string | null = null;

  const atIndex = remaining.indexOf("@");
  if (atIndex !== -1) {
    const digestPart = remaining.substring(atIndex + 1);
    remaining = remaining.substring(0, atIndex);

    if (!isValidDigest(digestPart)) {
      throw new DockerImageParseError(
        `Invalid digest format: ${digestPart}`,
        original,
        atIndex + 1
      );
    }
    digest = digestPart;
  }

  const colonIndex = remaining.lastIndexOf(":");
  if (colonIndex !== -1) {
    const potentialTag = remaining.substring(colonIndex + 1);
    const beforeColon = remaining.substring(0, colonIndex);

    // Check if this is a tag or part of domain (domain:port)
    // It's a port if:
    // 1. Potential tag is all digits
    // 2. beforeColon has no /
    // 3. beforeColon looks like a domain (has . or is localhost)
    const looksLikeDomain = beforeColon.includes(".") || beforeColon === "localhost";
    const isPort = /^\d+$/.test(potentialTag) && !beforeColon.includes("/") && looksLikeDomain;

    if (!isPort) {
      // This is a tag
      if (!isValidTag(potentialTag)) {
        throw new DockerImageParseError(
          `Invalid tag format: ${potentialTag}`,
          original,
          colonIndex + 1
        );
      }
      tag = potentialTag;
      remaining = beforeColon;
    }
  }

  // Now parse domain and path
  // Domain is present if:
  // 1. Contains '.' before first '/'
  // 2. Contains ':' before first '/'
  // 3. Is 'localhost' (with optional port)
  const firstSlash = remaining.indexOf("/");

  if (firstSlash === -1) {
    // No slash - entire thing is path (single component repository)
    // Unless it's a special case like localhost:5000
    if (remaining.includes(".") || remaining.includes(":") || remaining === "localhost") {
      // This looks like a domain without a path - invalid
      throw new DockerImageParseError("Repository name must be specified", original);
    }
    path = remaining;
  } else {
    const beforeSlash = remaining.substring(0, firstSlash);

    // Check if beforeSlash is a domain
    const isDomain =
      beforeSlash.includes(".") || beforeSlash.includes(":") || beforeSlash === "localhost";

    if (isDomain) {
      if (!isValidDomain(beforeSlash)) {
        throw new DockerImageParseError(`Invalid domain: ${beforeSlash}`, original, 0);
      }
      domain = beforeSlash;
      path = remaining.substring(firstSlash + 1);
    } else {
      path = remaining;
    }
  }

  if (!isValidPath(path)) {
    throw new DockerImageParseError(`Invalid repository path: ${path}`, original);
  }

  const repository = domain ? `${domain}/${path}` : path;

  const isLocalhost =
    domain !== null && (domain === "localhost" || domain.startsWith("localhost:"));

  let canonical = repository;

  const effectiveTag = tag ?? (digest === null ? "latest" : null);

  if (effectiveTag) {
    canonical += `:${effectiveTag}`;
  }
  if (digest) {
    canonical += `@${digest}`;
  }

  return Object.freeze({
    original,
    domain,
    path,
    repository,
    tag: effectiveTag,
    digest,
    isLocalhost,
    canonical,
  });
}

export function isValidDockerImage(reference: string): boolean {
  try {
    parseDockerImage(reference);
    return true;
  } catch {
    return false;
  }
}

export function normalizeDockerImage(reference: string): string {
  return parseDockerImage(reference).canonical;
}

export function areDockerImagesEqual(ref1: string, ref2: string): boolean {
  try {
    const parsed1 = parseDockerImage(ref1);
    const parsed2 = parseDockerImage(ref2);

    if (parsed1.digest && parsed2.digest) {
      return parsed1.repository === parsed2.repository && parsed1.digest === parsed2.digest;
    }

    return parsed1.canonical === parsed2.canonical;
  } catch {
    return false;
  }
}

export function isDigestReference(reference: string): boolean {
  try {
    const parsed = parseDockerImage(reference);
    return parsed.digest !== null;
  } catch {
    return false;
  }
}

export function isTaggedReference(reference: string): boolean {
  try {
    const parsed = parseDockerImage(reference);
    return parsed.tag !== null && parsed.digest === null;
  } catch {
    return false;
  }
}

export function splitRepository(repository: string): { domain: string | null; path: string } {
  const parsed = parseDockerImage(repository);
  return { domain: parsed.domain, path: parsed.path };
}
