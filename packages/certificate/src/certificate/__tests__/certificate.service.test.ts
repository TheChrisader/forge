import { describe, it, expect, beforeEach } from "vitest";
import { pki } from "node-forge";
import { createCA, createCert, generateCRL } from "../certificate.service";
import type { Certificate } from "../certificate.types";

describe("CertificateService", () => {
  describe("createCA", () => {
    const caOptions = {
      organization: "Forge CA",
      countryCode: "US",
      state: "California",
      locality: "San Francisco",
      validity: 365,
    };

    it("should generate a CA certificate with a private key", async () => {
      const ca = await createCA(caOptions);

      expect(ca).toHaveProperty("key");
      expect(ca).toHaveProperty("cert");
      expect(typeof ca.key).toBe("string");
      expect(typeof ca.cert).toBe("string");
    });

    it("should produce a valid PEM-encoded key and certificate", async () => {
      const ca = await createCA(caOptions);

      expect(ca.key).toMatch(/^-----BEGIN (?:RSA )?PRIVATE KEY-----/);
      expect(ca.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);

      // node-forge can parse both back without error
      expect(() => pki.privateKeyFromPem(ca.key)).not.toThrow();
      expect(() => pki.certificateFromPem(ca.cert)).not.toThrow();
    });

    it("should set the organization as the common name", async () => {
      const ca = await createCA(caOptions);
      const cert = pki.certificateFromPem(ca.cert);

      const cn = cert.subject.attributes.find((a) => a.name === "commonName");
      expect(cn?.value).toBe("Forge CA");
    });

    it("should include the country code, state, and locality", async () => {
      const ca = await createCA(caOptions);
      const cert = pki.certificateFromPem(ca.cert);

      const attrs = Object.fromEntries(cert.subject.attributes.map((a) => [a.name, a.value]));

      expect(attrs.countryName).toBe("US");
      expect(attrs.stateOrProvinceName).toBe("California");
      expect(attrs.localityName).toBe("San Francisco");
      expect(attrs.organizationName).toBe("Forge CA");
    });

    it("should be self-signed (issuer == subject)", async () => {
      const ca = await createCA(caOptions);
      const cert = pki.certificateFromPem(ca.cert);

      const subject = cert.subject.attributes
        .map((a) => `${a.name}=${a.value?.toString()}`)
        .join(",");
      const issuer = cert.issuer.attributes
        .map((a) => `${a.name}=${a.value?.toString()}`)
        .join(",");

      expect(subject).toBe(issuer);
    });

    it("should produce a unique serial number on each call", async () => {
      const [a, b] = await Promise.all([createCA(caOptions), createCA(caOptions)]);

      const certA = pki.certificateFromPem(a.cert);
      const certB = pki.certificateFromPem(b.cert);

      expect(certA.serialNumber).not.toBe(certB.serialNumber);
    });

    it("should respect the validity period", async () => {
      const ca = await createCA({ ...caOptions, validity: 90 });
      const cert = pki.certificateFromPem(ca.cert);

      // notAfter should be exactly 90 days after notBefore
      const expectedNotAfter = new Date(cert.validity.notBefore);
      expectedNotAfter.setDate(expectedNotAfter.getDate() + 90);
      expect(cert.validity.notAfter.getTime()).toBe(expectedNotAfter.getTime());

      // notBefore should be recent (within the last 60s to account for test execution)
      const oneMinuteAgo = Date.now() - 60_000;
      expect(cert.validity.notBefore.getTime()).toBeGreaterThan(oneMinuteAgo);
      expect(cert.validity.notBefore.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("createCert", () => {
    let ca: Certificate;

    beforeEach(async () => {
      ca = await createCA({
        organization: "Forge CA",
        countryCode: "US",
        state: "California",
        locality: "San Francisco",
        validity: 365,
      });
    });

    it("should generate a leaf certificate signed by the CA", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        ca,
      });

      expect(leaf).toHaveProperty("key");
      expect(leaf).toHaveProperty("cert");
      expect(leaf.key).toMatch(/^-----BEGIN (?:RSA )?PRIVATE KEY-----/);
      expect(leaf.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
    });

    it("should use the first domain as the common name", async () => {
      const leaf = await createCert({
        domains: ["app.example.com", "api.example.com"],
        validity: 90,
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const cn = cert.subject.attributes.find((a) => a.name === "commonName");
      expect(cn?.value).toBe("app.example.com");
    });

    it("should set the issuer to the CA's subject", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        ca,
      });
      const leafCert = pki.certificateFromPem(leaf.cert);
      const caCert = pki.certificateFromPem(ca.cert);

      const leafIssuer = leafCert.issuer.attributes
        .map((a) => `${a.name}=${a.value?.toString()}`)
        .join(",");
      const caSubject = caCert.subject.attributes
        .map((a) => `${a.name}=${a.value?.toString()}`)
        .join(",");

      expect(leafIssuer).toBe(caSubject);
    });

    it("should include SAN entries for all domains", async () => {
      const leaf = await createCert({
        domains: ["app.example.com", "api.example.com"],
        validity: 90,
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const san = cert.getExtension("subjectAltName") as any;
      expect(san).toBeDefined();

      const altNames = (san?.altNames ?? []) as Array<{
        type: number;
        value?: string;
        ip?: string;
      }>;
      const dnsNames = altNames.filter((n) => n.type === 2).map((n) => n.value);
      expect(dnsNames).toContain("app.example.com");
      expect(dnsNames).toContain("api.example.com");
    });

    it("should handle IP addresses in SAN entries", async () => {
      const leaf = await createCert({
        domains: ["127.0.0.1"],
        validity: 90,
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const san = cert.getExtension("subjectAltName") as any;
      const altNames = (san?.altNames ?? []) as Array<{ type: number; ip?: string }>;
      const ipEntries = altNames.filter((n) => n.type === 7).map((n) => n.ip);
      expect(ipEntries).toContain("127.0.0.1");
    });

    it("should include organization and email when provided", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        organization: "Forge Inc",
        email: "admin@forge.dev",
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const attrs = Object.fromEntries(cert.subject.attributes.map((a) => [a.name, a.value]));
      expect(attrs.organizationName).toBe("Forge Inc");
      expect(attrs.emailAddress).toBe("admin@forge.dev");
    });

    it("should omit organization and email when not provided", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const names = cert.subject.attributes.map((a) => a.name);
      expect(names).not.toContain("organizationName");
      expect(names).not.toContain("emailAddress");
    });

    it("should have basicConstraints with cA=false", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        ca,
      });
      const cert = pki.certificateFromPem(leaf.cert);

      const bc = cert.getExtension("basicConstraints");
      expect(bc).toBeDefined();
      expect((bc as { cA: boolean }).cA).toBe(false);
    });

    it("should produce a certificate verifiable against the CA", async () => {
      const leaf = await createCert({
        domains: ["app.example.com"],
        validity: 90,
        ca,
      });
      const caCert = pki.certificateFromPem(ca.cert);
      const leafCert = pki.certificateFromPem(leaf.cert);

      // Verify the leaf was signed by the CA
      expect(() => caCert.verify(leafCert)).not.toThrow();
    });
  });

  describe("generateCRL", () => {
    let ca: Certificate;

    beforeEach(async () => {
      ca = await createCA({
        organization: "Forge CA",
        countryCode: "US",
        state: "California",
        locality: "San Francisco",
        validity: 365,
      });
    });

    it("should return a Buffer", async () => {
      const crl = await generateCRL(ca);
      expect(crl).toBeInstanceOf(Buffer);
      expect(crl.length).toBeGreaterThan(0);
    });

    it("should produce a valid DER-encoded CRL", async () => {
      const crl = await generateCRL(ca);

      // A DER-encoded CRL starts with SEQUENCE (0x30)
      expect(crl[0]).toBe(0x30);
    });

    it("should be parseable by pkijs", async () => {
      const { CertificateRevocationList } = await import("pkijs");
      const { fromBER: asn1FromBER } = await import("asn1js");

      const crlDer = await generateCRL(ca);
      const asn1 = asn1FromBER(
        crlDer.buffer.slice(crlDer.byteOffset, crlDer.byteOffset + crlDer.byteLength) as ArrayBuffer
      );
      expect(asn1.offset).toBe(crlDer.length); // fully consumed, no trailing bytes

      const crl = new CertificateRevocationList({ schema: asn1.result });
      expect(crl.issuer.typesAndValues.length).toBeGreaterThan(0);
    });
  });
});
