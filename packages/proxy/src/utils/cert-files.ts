import { existsSync, accessSync, constants } from "fs";
import { join } from "path";

export interface CertFileSet {
  caCert: string; // absolute path to CA cert
  cert: string; // absolute path to domain cert
  key: string; // absolute path to domain key
}

export interface CertValidationResult {
  valid: boolean;
  missing: string[];
  certSet?: CertFileSet;
}

/**
 * Validates that all required cert files exist in the given directory.
 * Returns the file set if valid, or a list of missing files.
 */
export function validateCertFiles(
  certPath: string,
  filenames: {
    caCertFile: string;
    certFile: string;
    keyFile: string;
  }
): CertValidationResult {
  const required = [
    { name: "CA certificate", file: filenames.caCertFile },
    { name: "domain certificate", file: filenames.certFile },
    { name: "private key", file: filenames.keyFile },
  ];

  const missing: string[] = [];
  for (const { name, file } of required) {
    if (!existsSync(join(certPath, file))) {
      missing.push(`${name} (${join(certPath, file)})`);
    }
  }

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  // Verify the key file is readable
  try {
    accessSync(join(certPath, filenames.keyFile), constants.R_OK);
  } catch {
    missing.push(`private key is not readable (${join(certPath, filenames.keyFile)})`);
    return { valid: false, missing };
  }

  return {
    valid: true,
    missing: [],
    certSet: {
      caCert: join(certPath, filenames.caCertFile),
      cert: join(certPath, filenames.certFile),
      key: join(certPath, filenames.keyFile),
    },
  };
}
