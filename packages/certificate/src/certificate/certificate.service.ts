import { md, pki } from "node-forge";
import nodeCrypto from "node:crypto";
import net from "node:net";
import { promisify } from "node:util";
import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import {
  Certificate,
  CertificateAuthorityOptions,
  CertificateOptions,
  GenerateOptions,
} from "./certificate.types";

async function generateCert(options: GenerateOptions): Promise<Certificate> {
  const { subject, issuer, extensions, validity } = options;
  const generateKeyPair = promisify(pki.rsa.generateKeyPair.bind(pki.rsa));

  // create random serial number between between 50000 and 99999
  const serial = Math.floor(Math.random() * 95000 + 50000).toString();
  const keyPair = await generateKeyPair({ bits: 2048, workers: 4 });
  const cert = pki.createCertificate();

  // serial number must be hex encoded
  cert.serialNumber = Buffer.from(serial).toString("hex");
  cert.publicKey = keyPair.publicKey;
  cert.setSubject(subject);
  cert.setIssuer(issuer);
  cert.setExtensions(extensions);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validity);

  // sign the certificate with it's own
  // private key if no separate signing key is provided
  const signWith = options.signWith ? pki.privateKeyFromPem(options.signWith) : keyPair.privateKey;
  cert.sign(signWith, md.sha256.create());

  return {
    key: pki.privateKeyToPem(keyPair.privateKey),
    cert: pki.certificateToPem(cert),
  };
}

export async function createCA(options: CertificateAuthorityOptions): Promise<Certificate> {
  // certificate Attributes: https://git.io/fptna
  const attributes = [
    { name: "commonName", value: options.organization },
    { name: "countryName", value: options.countryCode },
    { name: "stateOrProvinceName", value: options.state },
    { name: "localityName", value: options.locality },
    { name: "organizationName", value: options.organization },
  ];

  // required certificate extensions for a certificate authority
  const extensions = [
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ];

  return await generateCert({
    subject: attributes,
    issuer: attributes,
    extensions: extensions,
    validity: options.validity,
  });
}

export async function createCert(options: CertificateOptions): Promise<Certificate> {
  let CRL_URL = "http://localhost/.well-known/crl/ca.crl";
  // certificate Attributes: https://git.io/fptna
  const attributes = [
    { name: "commonName", value: options.domains[0] }, // use the first address as common name
  ];

  const ca = pki.certificateFromPem(options.ca.cert);

  if (options.organization) {
    attributes.push({ name: "organizationName", value: options.organization });
  }

  if (options.email) {
    attributes.push({ name: "emailAddress", value: options.email });
  }

  if (options.crlUrl) {
    CRL_URL = options.crlUrl;
  }

  // required certificate extensions for a tls certificate
  const extensions = [
    { name: "basicConstraints", cA: false, critical: true },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
      critical: true,
    },
    { name: "extKeyUsage", serverAuth: true, clientAuth: true },
    { name: "subjectKeyIdentifier" },
    { name: "authorityKeyIdentifier", keyIdentifier: ca.generateSubjectKeyIdentifier().getBytes() },
    {
      name: "subjectAltName",
      altNames: options.domains.map((domain) => {
        // types https://git.io/fptng
        const TYPE_DOMAIN = 2;
        const TYPE_IP = 7;

        if (net.isIP(domain)) {
          return { type: TYPE_IP, ip: domain };
        }

        return { type: TYPE_DOMAIN, value: domain };
      }),
    },
    {
      name: "cRLDistributionPoints",
      altNames: [
        {
          type: 6, // URI = 6, IP = 7
          value: CRL_URL,
        },
      ],
    },
  ];

  return await generateCert({
    subject: attributes,
    issuer: ca.subject.attributes,
    extensions: extensions,
    validity: options.validity,
    signWith: options.ca.key,
  });
}

export async function generateCRL(ca: Certificate): Promise<Buffer> {
  // Import the CA private key via Node's crypto (handles PKCS#1, PKCS#8, SEC1),
  // then export as PKCS#8 DER for crypto.subtle (which pkijs expects for signing).
  const nodeKey = nodeCrypto.createPrivateKey(ca.key);
  const pkcs8Der = nodeKey.export({ type: "pkcs8", format: "der" });

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Parse the CA cert to get its issuer for the CRL
  const caCertPem = ca.cert
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "");
  const caCertDer = Buffer.from(caCertPem, "base64");
  const asn1 = asn1js.fromBER(caCertDer);
  const caCert = new pkijs.Certificate({ schema: asn1.result });

  // Build the CRL
  const crl = new pkijs.CertificateRevocationList();
  crl.version = 1; // v2 CRL
  crl.issuer = caCert.subject;

  const now = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  crl.thisUpdate = new pkijs.Time({ type: 1, value: now });
  crl.nextUpdate = new pkijs.Time({ type: 1, value: nextYear });

  // Sign it — Node's built-in crypto.subtle is used directly
  await crl.sign(cryptoKey, "SHA-256");

  // Export as DER — pkijs lacks precise return types for toSchema/toBER
  const crlDer = (crl.toSchema(true) as { toBER(sizeOnly: boolean): ArrayBuffer }).toBER(false);

  return Buffer.from(crlDer);
}
