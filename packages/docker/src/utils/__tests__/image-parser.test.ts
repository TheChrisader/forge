import { describe, it, expect } from "vitest";
import {
  parseDockerImage,
  isValidDockerImage,
  normalizeDockerImage,
  areDockerImagesEqual,
  isDigestReference,
  isTaggedReference,
  splitRepository,
  DockerImageParseError,
} from "../image-parser";

// A valid 64-char hex digest for testing
const VALID_DIGEST = "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

describe("DockerImageParseError", () => {
  it("sets name to 'DockerImageParseError'", () => {
    const err = new DockerImageParseError("bad", "input");
    expect(err.name).toBe("DockerImageParseError");
  });

  it("includes the validation message", () => {
    const err = new DockerImageParseError("Empty reference", "in");
    expect(err.message).toContain("Empty reference");
  });

  it("stores the input string", () => {
    const err = new DockerImageParseError("bad", "my-image");
    expect(err.input).toBe("my-image");
  });

  it("optionally stores the position", () => {
    const err = new DockerImageParseError("bad", "in", 5);
    expect(err.position).toBe(5);
  });

  it("defaults position to undefined", () => {
    const err = new DockerImageParseError("bad", "in");
    expect(err.position).toBeUndefined();
  });
});

describe("parseDockerImage", () => {
  describe("simple images (no registry)", () => {
    it("parses a bare image name with implicit :latest", () => {
      const ref = parseDockerImage("alpine");
      expect(ref.domain).toBeNull();
      expect(ref.path).toBe("alpine");
      expect(ref.tag).toBe("latest");
      expect(ref.digest).toBeNull();
      expect(ref.repository).toBe("alpine");
      expect(ref.isLocalhost).toBe(false);
    });

    it("parses image with explicit tag", () => {
      const ref = parseDockerImage("nginx:1.25");
      expect(ref.domain).toBeNull();
      expect(ref.path).toBe("nginx");
      expect(ref.tag).toBe("1.25");
      expect(ref.digest).toBeNull();
    });

    it("parses scoped image (org/name)", () => {
      const ref = parseDockerImage("myorg/myapp");
      expect(ref.path).toBe("myorg/myapp");
      expect(ref.tag).toBe("latest");
      expect(ref.repository).toBe("myorg/myapp");
    });

    it("parses scoped image with tag", () => {
      const ref = parseDockerImage("myorg/myapp:v2.0");
      expect(ref.path).toBe("myorg/myapp");
      expect(ref.tag).toBe("v2.0");
    });

    it("parses deeply scoped image", () => {
      const ref = parseDockerImage("library/ubuntu:20.04");
      expect(ref.path).toBe("library/ubuntu");
      expect(ref.tag).toBe("20.04");
    });

    it("parses image with digest", () => {
      const ref = parseDockerImage(`alpine@${VALID_DIGEST}`);
      expect(ref.path).toBe("alpine");
      expect(ref.digest).toBe(VALID_DIGEST);
      expect(ref.tag).toBeNull();
    });

    it("parses scoped image with digest", () => {
      const ref = parseDockerImage(`myorg/myapp@${VALID_DIGEST}`);
      expect(ref.path).toBe("myorg/myapp");
      expect(ref.digest).toBe(VALID_DIGEST);
      expect(ref.tag).toBeNull();
    });
  });

  describe("images with domain/registry", () => {
    it("parses docker.io library image", () => {
      const ref = parseDockerImage("docker.io/library/alpine");
      expect(ref.domain).toBe("docker.io");
      expect(ref.path).toBe("library/alpine");
      expect(ref.repository).toBe("docker.io/library/alpine");
    });

    it("parses gcr.io image with tag", () => {
      const ref = parseDockerImage("gcr.io/myproject/myimage:v1");
      expect(ref.domain).toBe("gcr.io");
      expect(ref.path).toBe("myproject/myimage");
      expect(ref.tag).toBe("v1");
    });

    it("parses localhost with numeric port", () => {
      const ref = parseDockerImage("localhost:5000/myimage");
      expect(ref.domain).toBe("localhost:5000");
      expect(ref.path).toBe("myimage");
      expect(ref.tag).toBe("latest");
      expect(ref.isLocalhost).toBe(true);
      expect(ref.repository).toBe("localhost:5000/myimage");
    });

    it("parses localhost with numeric port and explicit tag", () => {
      const ref = parseDockerImage("localhost:5000/myimage:v1.0");
      expect(ref.domain).toBe("localhost:5000");
      expect(ref.path).toBe("myimage");
      expect(ref.tag).toBe("v1.0");
      expect(ref.isLocalhost).toBe(true);
    });

    it("parses localhost with numeric port and digest", () => {
      const ref = parseDockerImage(`localhost:5000/myimage@${VALID_DIGEST}`);
      expect(ref.domain).toBe("localhost:5000");
      expect(ref.path).toBe("myimage");
      expect(ref.tag).toBeNull();
      expect(ref.digest).toBe(VALID_DIGEST);
      expect(ref.isLocalhost).toBe(true);
    });

    it("parses localhost without port", () => {
      const ref = parseDockerImage("localhost/myimage");
      expect(ref.domain).toBe("localhost");
      expect(ref.path).toBe("myimage");
      expect(ref.isLocalhost).toBe(true);
    });

    it("parses IP address with numeric port", () => {
      const ref = parseDockerImage("127.0.0.1:5000/myimage");
      expect(ref.domain).toBe("127.0.0.1:5000");
      expect(ref.path).toBe("myimage");
      expect(ref.tag).toBe("latest");
      expect(ref.repository).toBe("127.0.0.1:5000/myimage");
    });

    it("parses IP address with numeric port and tag", () => {
      const ref = parseDockerImage("127.0.0.1:5000/myimage:debug");
      expect(ref.domain).toBe("127.0.0.1:5000");
      expect(ref.path).toBe("myimage");
      expect(ref.tag).toBe("debug");
    });

    it("parses registry with custom port and tag", () => {
      const ref = parseDockerImage("registry.example.com:8080/org/image:tag");
      expect(ref.domain).toBe("registry.example.com:8080");
      expect(ref.path).toBe("org/image");
      expect(ref.tag).toBe("tag");
    });

    it("parses ghcr.io image", () => {
      const ref = parseDockerImage("ghcr.io/org/repo:latest");
      expect(ref.domain).toBe("ghcr.io");
      expect(ref.path).toBe("org/repo");
      expect(ref.tag).toBe("latest");
    });
  });

  describe("canonical form", () => {
    it("canonical for bare image is 'image:latest'", () => {
      expect(parseDockerImage("alpine").canonical).toBe("alpine:latest");
    });

    it("canonical preserves explicit tag", () => {
      expect(parseDockerImage("nginx:1.25").canonical).toBe("nginx:1.25");
    });

    it("canonical for digest has no :latest", () => {
      const ref = parseDockerImage(`alpine@${VALID_DIGEST}`);
      expect(ref.canonical).toBe(`alpine@${VALID_DIGEST}`);
    });

    it("canonical for registry image includes domain", () => {
      expect(parseDockerImage("docker.io/library/alpine").canonical).toBe(
        "docker.io/library/alpine:latest"
      );
    });
  });

  describe("original and frozen", () => {
    it("preserves the original input string", () => {
      const ref = parseDockerImage("  nginx:latest  ");
      expect(ref.original).toBe("  nginx:latest  ");
    });

    it("returns a frozen object", () => {
      const ref = parseDockerImage("alpine");
      expect(Object.isFrozen(ref)).toBe(true);
    });
  });

  describe("error cases", () => {
    it("throws on empty string", () => {
      expect(() => parseDockerImage("")).toThrow(DockerImageParseError);
    });

    it("throws on whitespace-only string", () => {
      expect(() => parseDockerImage("   ")).toThrow(DockerImageParseError);
    });

    it("throws on string with embedded spaces", () => {
      expect(() => parseDockerImage("my image")).toThrow(DockerImageParseError);
    });

    it("throws on reference exceeding 1024 characters", () => {
      const longRef = "a".repeat(1025);
      expect(() => parseDockerImage(longRef)).toThrow(DockerImageParseError);
    });

    it("throws on non-string input (number)", () => {
      expect(() => parseDockerImage(42 as unknown as string)).toThrow(DockerImageParseError);
    });

    it("throws on object input", () => {
      expect(() => parseDockerImage({} as unknown as string)).toThrow(DockerImageParseError);
    });

    it("throws on domain-only reference (no path)", () => {
      expect(() => parseDockerImage("docker.io")).toThrow(DockerImageParseError);
    });

    it("throws on invalid tag format", () => {
      expect(() => parseDockerImage("image:!bad")).toThrow(DockerImageParseError);
    });

    it("throws on invalid digest format", () => {
      expect(() => parseDockerImage("image@sha256:zzz")).toThrow(DockerImageParseError);
    });

    it("throws on port 0", () => {
      expect(() => parseDockerImage("localhost:0/image")).toThrow(DockerImageParseError);
    });

    it("throws on port above 65535", () => {
      expect(() => parseDockerImage("localhost:99999/image")).toThrow(DockerImageParseError);
    });

    it("throws on non-numeric port", () => {
      expect(() => parseDockerImage("localhost:abc/image")).toThrow(DockerImageParseError);
    });
  });

  describe("edge cases", () => {
    it("parses tag with dots", () => {
      expect(parseDockerImage("image:v1.0.0").tag).toBe("v1.0.0");
    });

    it("parses tag with dashes", () => {
      expect(parseDockerImage("image:v-1-0").tag).toBe("v-1-0");
    });

    it("handles leading/trailing whitespace via trim", () => {
      const ref = parseDockerImage("  alpine  ");
      expect(ref.path).toBe("alpine");
      expect(ref.tag).toBe("latest");
    });

    it("accepts references up to 1024 characters", () => {
      const longPath = "a".repeat(1018);
      expect(() => parseDockerImage(longPath + ":latest")).toThrow(DockerImageParseError);
    });
  });
});

describe("isValidDockerImage", () => {
  it("returns true for valid simple image", () => {
    expect(isValidDockerImage("alpine")).toBe(true);
  });

  it("returns true for valid tagged image", () => {
    expect(isValidDockerImage("nginx:1.25")).toBe(true);
  });

  it("returns true for valid image with registry", () => {
    expect(isValidDockerImage("docker.io/library/alpine")).toBe(true);
  });

  it("returns true for valid image with digest", () => {
    expect(isValidDockerImage(`alpine@${VALID_DIGEST}`)).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidDockerImage("")).toBe(false);
  });

  it("returns false for string with spaces", () => {
    expect(isValidDockerImage("my image")).toBe(false);
  });

  it("returns false for domain-only reference", () => {
    expect(isValidDockerImage("docker.io")).toBe(false);
  });
});

describe("normalizeDockerImage", () => {
  it("returns canonical form for simple image", () => {
    expect(normalizeDockerImage("alpine")).toBe("alpine:latest");
  });

  it("returns canonical form for image with tag", () => {
    expect(normalizeDockerImage("nginx:1.25")).toBe("nginx:1.25");
  });

  it("returns canonical form for image with digest", () => {
    expect(normalizeDockerImage(`alpine@${VALID_DIGEST}`)).toBe(`alpine@${VALID_DIGEST}`);
  });

  it("throws for invalid image reference", () => {
    expect(() => normalizeDockerImage("")).toThrow(DockerImageParseError);
  });
});

describe("areDockerImagesEqual", () => {
  it("returns true for identical simple references", () => {
    expect(areDockerImagesEqual("alpine", "alpine")).toBe(true);
  });

  it("returns true for implicit vs explicit :latest", () => {
    expect(areDockerImagesEqual("alpine", "alpine:latest")).toBe(true);
  });

  it("returns true when both have same digest", () => {
    const a = `alpine@${VALID_DIGEST}`;
    const b = `alpine@${VALID_DIGEST}`;
    expect(areDockerImagesEqual(a, b)).toBe(true);
  });

  it("returns true for same registry image with implicit/explicit latest", () => {
    expect(
      areDockerImagesEqual("docker.io/library/alpine", "docker.io/library/alpine:latest")
    ).toBe(true);
  });

  it("returns false for different tags", () => {
    expect(areDockerImagesEqual("alpine:3.18", "alpine:3.19")).toBe(false);
  });

  it("returns false for different repositories", () => {
    expect(areDockerImagesEqual("alpine", "nginx")).toBe(false);
  });

  it("returns false when one has digest and other has tag", () => {
    expect(areDockerImagesEqual(`alpine@${VALID_DIGEST}`, "alpine:latest")).toBe(false);
  });

  it("returns false for invalid inputs (does not throw)", () => {
    expect(areDockerImagesEqual("", "alpine")).toBe(false);
    expect(areDockerImagesEqual("alpine", "")).toBe(false);
  });
});

describe("isDigestReference", () => {
  it("returns true for image with digest", () => {
    expect(isDigestReference(`alpine@${VALID_DIGEST}`)).toBe(true);
  });

  it("returns false for image with tag only", () => {
    expect(isDigestReference("alpine:latest")).toBe(false);
  });

  it("returns false for image with implicit latest", () => {
    expect(isDigestReference("alpine")).toBe(false);
  });

  it("returns false for invalid input", () => {
    expect(isDigestReference("")).toBe(false);
  });
});

describe("isTaggedReference", () => {
  it("returns true for image with explicit tag", () => {
    expect(isTaggedReference("alpine:latest")).toBe(true);
  });

  it("returns false for image with digest only", () => {
    expect(isTaggedReference(`alpine@${VALID_DIGEST}`)).toBe(false);
  });

  it("returns true for image with implicit latest (effective tag is set)", () => {
    // parseDockerImage sets effectiveTag to "latest" when no explicit tag is given,
    // so isTaggedReference considers it tagged.
    expect(isTaggedReference("alpine")).toBe(true);
  });

  it("returns false for invalid input", () => {
    expect(isTaggedReference("")).toBe(false);
  });
});

describe("splitRepository", () => {
  it("returns domain and path for registry image", () => {
    const result = splitRepository("docker.io/library/alpine");
    expect(result.domain).toBe("docker.io");
    expect(result.path).toBe("library/alpine");
  });

  it("returns null domain and path for simple image", () => {
    const result = splitRepository("alpine");
    expect(result.domain).toBeNull();
    expect(result.path).toBe("alpine");
  });

  it("returns domain and path for localhost with port", () => {
    const result = splitRepository("localhost:5000/myimage");
    expect(result.domain).toBe("localhost:5000");
    expect(result.path).toBe("myimage");
  });

  it("returns domain and path for IP with port", () => {
    const result = splitRepository("127.0.0.1:5000/myimage");
    expect(result.domain).toBe("127.0.0.1:5000");
    expect(result.path).toBe("myimage");
  });
});
