import { pki } from "node-forge";

export type Certificate = {
  key: string;
  cert: string;
};

export type GenerateOptions = {
  subject: pki.CertificateField[];
  issuer: pki.CertificateField[];
  extensions: Record<string, unknown>[];
  validity: number;
  signWith?: string;
};

export type CertificateAuthorityOptions = {
  organization: string;
  countryCode: string;
  state: string;
  locality: string;
  validity: number;
};

export type CertificateOptions = {
  domains: string[];
  validity: number;
  organization?: string;
  email?: string;
  ca: Certificate;
  crlUrl?: string;
};
