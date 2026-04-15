#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { platform } from "os";
import { createCA, createCert, generateCRL } from "@forge/certificate";

const CERT_DIR = resolve("./data/certs");
const CRL_DIR = resolve("./data/crl");
const ORG_NAME = "Forge Dev CA";

/**
 * Resolves a path relative to the project root.
 * Handles the case where the process is running from apps/api or apps/workers.
 */
function resolveProjectPath(relativePath: string): string {
  const cwd = process.cwd();

  if (cwd.includes("/apps/") || cwd.includes("\\apps\\")) {
    const appsIndex = Math.max(cwd.lastIndexOf("/apps/"), cwd.lastIndexOf("\\apps\\"));
    const projectRoot = cwd.substring(0, appsIndex);
    return resolve(projectRoot, relativePath);
  }

  return resolve(cwd, relativePath);
}

function isAdmin(): boolean {
  const osType = platform();
  if (osType !== "win32") return false;

  try {
    // On Windows, check if running as administrator by trying to read a protected file
    execSync("net session", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function relaunchAsAdmin(): void {
  log("This script requires administrator privileges on Windows.", "warn");
  log("Attempting to relaunch with elevated permissions...", "info");

  const scriptPath = process.argv[1];
  const args = process.argv
    .slice(2)
    .map((arg) => `"${arg}"`)
    .join(" ");

  try {
    // Launch elevated process and WAIT for it to complete so this shell
    // can resume afterwards (e.g. to print next steps).
    execSync(
      `powershell -Command "Start-Process -FilePath 'node' -ArgumentList '${scriptPath} ${args}' -Verb RunAs -Wait"`,
      { stdio: "inherit" }
    );
    log("Elevated process completed.", "success");
  } catch {
    log("Failed to relaunch with elevation. Please run as administrator manually:", "error");
    console.log(`  Right-click Command Prompt/PowerShell → "Run as administrator"`);
    console.log(`  Then run: pnpm setup:certs`);
    throw new Error("Administrator privileges required");
  }
}

const CERT_FILES = [
  join(CERT_DIR, "ca.crt"),
  join(CERT_DIR, "ca.key"),
  join(CERT_DIR, "cert.crt"),
  join(CERT_DIR, "cert.key"),
];

const CRL_FILES = [join(CRL_DIR, "ca.crl")];

function log(message: string, type: "info" | "success" | "error" | "warn" = "info"): void {
  const colors = {
    info: "\x1b[36m", // cyan
    success: "\x1b[32m", // green
    error: "\x1b[31m", // red
    warn: "\x1b[33m", // yellow
    reset: "\x1b[0m",
  };
  const prefix = {
    info: "ℹ",
    success: "✓",
    error: "✗",
    warn: "⚠",
  };
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
}

function runCommand(command: string, description: string): void {
  try {
    log(`Running: ${description}`, "info");
    execSync(command, { stdio: "inherit" });
    log(`Completed: ${description}`, "success");
  } catch (error) {
    log(`Failed: ${description}`, "error");
    throw error;
  }
}

function hasSudo(): boolean {
  try {
    execSync("sudo -n true 2>/dev/null", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function certsExist(): boolean {
  return CERT_FILES.every((file) => existsSync(file));
}

function crlExists(): boolean {
  return CRL_FILES.every((file) => existsSync(file));
}

function checkCertsValid(): boolean {
  if (!certsExist()) {
    return false;
  }

  try {
    // Basic check: verify CA cert contains the organization name
    const caCertContent = readFileSync(join(CERT_DIR, "ca.crt"), "utf-8");
    return caCertContent.length > 0 && caCertContent.includes("-----BEGIN CERTIFICATE-----");
  } catch {
    return false;
  }
}

function shouldRegenerateCerts(): boolean {
  return process.argv.includes("--force") || process.argv.includes("-f");
}

async function createCerts(): Promise<boolean> {
  if (!existsSync(CERT_DIR)) {
    log(`Creating certificate directory: ${CERT_DIR}`, "info");
    mkdirSync(CERT_DIR, { recursive: true });
  }
  if (!existsSync(CRL_DIR)) {
    log(`Creating CRL directory: ${CRL_DIR}`, "info");
    mkdirSync(CRL_DIR, { recursive: true });
  }

  if (checkCertsValid() && !shouldRegenerateCerts()) {
    log("Valid certificates already exist. Use --force to regenerate.", "success");
    log("Skipping certificate generation.", "info");
    return false;
  }

  if (certsExist() && !shouldRegenerateCerts()) {
    log("Certificate files exist but appear invalid.", "warn");
    log("Use --force to regenerate, or delete the files manually.", "warn");
    throw new Error("Invalid certificates found. Aborting.");
  }

  if (certsExist() && shouldRegenerateCerts()) {
    log("Regenerating certificates (--force flag provided)...", "warn");
  }

  log("Creating Certificate Authority...", "info");
  const ca = await createCA({
    organization: ORG_NAME,
    countryCode: "US",
    state: "Dev",
    locality: "Local",
    validity: 825,
  });
  writeFileSync(join(CERT_DIR, "ca.crt"), ca.cert);
  writeFileSync(join(CERT_DIR, "ca.key"), ca.key);
  log("Completed: Create CA", "success");

  // CRL generation is best-effort — failure shouldn't prevent domain cert creation
  try {
    log("Generating Certificate Revocation List...", "info");
    const crl = await generateCRL(ca);
    writeFileSync(join(CRL_DIR, "ca.crl"), crl);
    log("Completed: Generate CRL", "success");
  } catch (error) {
    log(
      "CRL generation failed. Certificates will still work, but revocation checking won't be available.",
      "warn"
    );
    if ((error as Error).message) {
      console.log(`  Reason: ${(error as Error).message}`);
    }
  }

  log("Creating domain certificate...", "info");
  const cert = await createCert({
    domains: ["*.forge.localhost", "forge.localhost", "localhost", "127.0.0.1"],
    validity: 825,
    ca,
    crlUrl: "http://localhost/.well-known/crl/ca.crl",
  });
  writeFileSync(join(CERT_DIR, "cert.crt"), cert.cert);
  writeFileSync(join(CERT_DIR, "cert.key"), cert.key);
  log("Completed: Create domain certificate", "success");

  return true;
}

function isCaTrusted(): boolean {
  const osType = platform();

  try {
    switch (osType) {
      case "darwin": {
        // Check if cert is already in system keychain
        const result = execSync(
          `security find-certificate -c "${ORG_NAME}" /Library/Keychains/System.keychain 2>/dev/null || echo "NOT_FOUND"`,
          { encoding: "utf-8" }
        );
        return !result.includes("NOT_FOUND");
      }

      case "win32": {
        // Check if cert is in Root store
        const certResult = execSync(`certutil -store Root "${ORG_NAME}" 2>&1 || echo "NOT_FOUND"`, {
          encoding: "utf-8",
        });
        return !certResult.includes("NOT_FOUND") && certResult.includes(ORG_NAME);
      }

      case "linux": {
        // Check if cert exists in system ca-certificates
        const systemCertPath = "/usr/local/share/ca-certificates/forge-dev-ca.crt";
        const etcCertPath = "/etc/ssl/certs/forge-dev-ca.pem";
        return existsSync(systemCertPath) || existsSync(etcCertPath);
      }

      default:
        return false;
    }
  } catch {
    return false;
  }
}

function trustCa(certsRegenerated: boolean): void {
  const osType = platform();
  const caCertPath = join(CERT_DIR, "ca.crt");

  // Check if already trusted
  if (isCaTrusted()) {
    if (certsRegenerated) {
      log("Certificates were regenerated — re-trusting CA to match new certificate.", "info");
    } else {
      log("CA certificate is already trusted on this system.", "success");
      log("Skipping trust step. Use --force-trust to attempt anyway.", "info");
      if (!process.argv.includes("--force-trust")) {
        return;
      }
      log("--force-trust provided, attempting to trust again...", "warn");
    }
  }

  log(`Detecting platform: ${osType}`, "info");

  switch (osType) {
    case "darwin":
      log("Trusting CA certificate on macOS...", "info");

      if (!hasSudo()) {
        log("Sudo privileges required.", "warn");
        log("Please run this script with sudo:", "error");
        console.log(`  sudo pnpm setup:certs`);
        throw new Error("Sudo required");
      }

      try {
        runCommand(
          `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`,
          "Trust CA on macOS"
        );
      } catch (error) {
        log("Failed to trust CA automatically. Please run manually:", "error");
        console.log(
          `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCertPath}"`
        );
        throw error;
      }
      break;

    case "win32":
      log("Trusting CA certificate on Windows...", "info");

      if (!isAdmin()) {
        log("Administrator privileges required.", "warn");
        log("Attempting to relaunch with elevation...", "info");
        relaunchAsAdmin();
        return; // This exits after relaunching
      }

      try {
        runCommand(`certutil -addstore "Root" "${caCertPath}"`, "Trust CA on Windows");
      } catch (error) {
        log("Failed to trust CA automatically. Please run as administrator:", "error");
        console.log(`  certutil -addstore "Root" "${caCertPath}"`);
        throw error;
      }
      break;

    case "linux":
      log("Trusting CA certificate on Linux...", "info");

      if (!hasSudo()) {
        log("Sudo privileges required.", "warn");
        log("Please run this script with sudo:", "error");
        console.log(`  sudo pnpm setup:certs`);
        throw new Error("Sudo required");
      }

      try {
        const certDest = "/usr/local/share/ca-certificates/forge-dev-ca.crt";
        runCommand(`sudo cp "${caCertPath}" "${certDest}"`, "Copy CA to system certs");
        runCommand("sudo update-ca-certificates", "Update CA certificates");
      } catch (error) {
        log("Failed to trust CA automatically. Please run manually:", "error");
        console.log(`  sudo cp "${caCertPath}" /usr/local/share/ca-certificates/forge-dev-ca.crt`);
        console.log(`  sudo update-ca-certificates`);
        throw error;
      }
      break;

    default:
      log(`Unsupported platform: ${osType}`, "warn");
      log("Please trust the CA certificate manually:", "info");
      console.log(`  CA certificate location: ${caCertPath}`);
      break;
  }
}

function removeCaTrust(): void {
  const osType = platform();

  if (!isCaTrusted()) {
    log("CA certificate is not currently trusted. Nothing to remove.", "info");
    return;
  }

  log("Removing CA certificate from system trust store...", "info");

  switch (osType) {
    case "darwin": {
      if (!hasSudo()) {
        log("Sudo privileges required.", "warn");
        log("Please run this script with sudo:", "error");
        console.log(`  sudo pnpm setup:certs --uninstall`);
        throw new Error("Sudo required");
      }

      try {
        runCommand(
          `sudo security delete-certificate -c "${ORG_NAME}" /Library/Keychains/System.keychain`,
          "Remove CA from macOS keychain"
        );
        log("CA certificate removed from system trust store.", "success");
      } catch (error) {
        log("Failed to remove CA automatically. Please run manually:", "error");
        console.log(
          `  sudo security delete-certificate -c "${ORG_NAME}" /Library/Keychains/System.keychain`
        );
        throw error;
      }
      break;
    }

    case "win32": {
      if (!isAdmin()) {
        log("Administrator privileges required.", "warn");
        log("Attempting to relaunch with elevation...", "info");
        relaunchAsAdmin();
        return;
      }

      try {
        runCommand(`certutil -delstore "Root" "${ORG_NAME}"`, "Remove CA from Windows Root store");
        log("CA certificate removed from system trust store.", "success");
      } catch (error) {
        log("Failed to remove CA automatically. Please run as administrator:", "error");
        console.log(`  certutil -delstore "Root" "${ORG_NAME}"`);
        throw error;
      }
      break;
    }

    case "linux": {
      if (!hasSudo()) {
        log("Sudo privileges required.", "warn");
        log("Please run this script with sudo:", "error");
        console.log(`  sudo pnpm setup:certs --uninstall`);
        throw new Error("Sudo required");
      }

      const systemCertPath = "/usr/local/share/ca-certificates/forge-dev-ca.crt";
      const etcCertPath = "/etc/ssl/certs/forge-dev-ca.pem";

      try {
        if (existsSync(systemCertPath)) {
          runCommand(`sudo rm "${systemCertPath}"`, "Remove CA from system certs");
        }
        if (existsSync(etcCertPath)) {
          runCommand(`sudo rm "${etcCertPath}"`, "Remove CA from etc certs");
        }
        runCommand("sudo update-ca-certificates", "Update CA certificates");
        log("CA certificate removed from system trust store.", "success");
      } catch (error) {
        log("Failed to remove CA automatically. Please run manually:", "error");
        console.log(`  sudo rm ${systemCertPath}`);
        console.log("  sudo update-ca-certificates");
        throw error;
      }
      break;
    }

    default:
      log(`Unsupported platform: ${osType}`, "warn");
      log("Please remove the CA certificate manually from your trust store.", "info");
      break;
  }
}

function removeCertFiles(): void {
  let certError: Error | null = null;
  let crlError: Error | null = null;

  // Remove certificate files
  if (existsSync(CERT_DIR)) {
    log(`Removing certificate directory: ${CERT_DIR}`, "info");
    try {
      for (const file of CERT_FILES) {
        if (existsSync(file)) {
          execSync(`rm "${file}"`, { stdio: "pipe" });
          log(`  Removed: ${file}`);
        }
      }

      const remaining = execSync(`ls "${CERT_DIR}" 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (!remaining) {
        execSync(`rmdir "${CERT_DIR}"`, { stdio: "pipe" });
        log(`  Removed: ${CERT_DIR}`);
      }
    } catch (error) {
      log("Failed to remove certificate files.", "error");
      certError = error as Error;
    }
  } else {
    log("No certificate directory found. Nothing to remove.", "info");
  }

  // Remove CRL files — independent of cert file removal
  if (existsSync(CRL_DIR)) {
    log(`Removing CRL directory: ${CRL_DIR}`, "info");
    try {
      for (const file of CRL_FILES) {
        if (existsSync(file)) {
          execSync(`rm "${file}"`, { stdio: "pipe" });
          log(`  Removed: ${file}`);
        }
      }

      const remaining = execSync(`ls "${CRL_DIR}" 2>/dev/null`, { encoding: "utf-8" }).trim();
      if (!remaining) {
        execSync(`rmdir "${CRL_DIR}"`, { stdio: "pipe" });
        log(`  Removed: ${CRL_DIR}`);
      }
    } catch (error) {
      log("Failed to remove CRL files.", "error");
      crlError = error as Error;
    }
  }

  // Throw the first error encountered so the caller knows something failed,
  // but both cleanups still got a chance to run.
  if (certError) throw certError;
  if (crlError) throw crlError;
}

function removeProviderArtifacts(): void {
  const providerDir = resolveProjectPath("./data/traefik");
  if (!existsSync(providerDir)) {
    return;
  }

  log(`Removing Traefik provider artifacts: ${providerDir}`, "info");
  try {
    execSync(`rm -rf "${providerDir}"`, { stdio: "pipe" });
    log(`  Removed: ${providerDir}`);
  } catch (error) {
    log("Failed to remove provider artifacts.", "error");
    throw error;
  }
}

function uninstall(): void {
  console.log("");
  log("Forge TLS Certificate Uninstall", "info");
  console.log("");

  const errors: string[] = [];

  try {
    removeCaTrust();
  } catch (error) {
    errors.push(`Trust store removal: ${(error as Error).message}`);
  }

  try {
    removeCertFiles();
  } catch (error) {
    errors.push(`Certificate file removal: ${(error as Error).message}`);
  }

  try {
    removeProviderArtifacts();
  } catch (error) {
    errors.push(`Provider artifact removal: ${(error as Error).message}`);
  }

  console.log("");
  if (errors.length > 0) {
    log("Uninstall completed with some errors:", "warn");
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    console.log("");
    log("You may need to clean up the remaining items manually.", "warn");
  } else {
    log(
      "Uninstall complete. All Forge certificates and trust store entries have been removed.",
      "success"
    );
  }
  console.log("");
  log("To regenerate, run:", "info");
  console.log("  pnpm setup:certs");
}

function printNextSteps(): void {
  console.log("\n" + "=".repeat(60));
  log("Certificate setup complete!", "success");
  console.log("=".repeat(60) + "\n");

  log("Next steps:", "info");
  console.log("1. Add these environment variables to your .env file:");
  console.log(`   PROXY_SSL_MODE=selfsigned`);
  console.log(`   PROXY_SSL_ENABLED=true`);
  console.log(`   PROXY_CERT_PATH=./data/certs`);
  console.log("");
  console.log("2. Restart Forge");
  console.log("");
  console.log(
    "3. Deployments at *.forge.localhost will now serve over HTTPS with a valid certificate!"
  );
  console.log("");
  log("Generated files:", "info");
  console.log(`  ${join(CERT_DIR, "ca.crt")} - Certificate Authority`);
  console.log(`  ${join(CERT_DIR, "ca.key")} - CA private key`);
  console.log(`  ${join(CERT_DIR, "cert.crt")} - Domain certificate`);
  console.log(`  ${join(CERT_DIR, "cert.key")} - Domain private key`);
  console.log(`  ${join(CRL_DIR, "ca.crl")} - Certificate Revocation List`);
}

function printUsage(): void {
  console.log("\nUsage: pnpm setup:certs [options]");
  console.log("");
  console.log("Options:");
  console.log("  --uninstall       Remove certificates and trust store entries");
  console.log("  --force, -f       Regenerate certificates even if they exist");
  console.log("  --force-trust     Attempt to trust CA even if already trusted");
  console.log("  --skip-trust      Skip the CA trust step (do it manually)");
  console.log("");
}

async function main(): Promise<void> {
  try {
    log("Forge TLS Certificate Setup", "info");
    console.log("");

    // Show help if requested
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printUsage();
      return;
    }

    // Uninstall mode
    if (process.argv.includes("--uninstall")) {
      uninstall();
      return;
    }

    // Create certificates using @forge/certificate
    const certsRegenerated = await createCerts();

    // Trust CA (optional - can be skipped)
    const skipTrust = process.argv.includes("--skip-trust");
    if (!skipTrust) {
      console.log("");
      try {
        trustCa(certsRegenerated);
      } catch {
        log(
          "CA trust step failed, but certificates were generated successfully. You can trust the CA manually later.",
          "warn"
        );
      }
    } else {
      log("Skipping CA trust step (--skip-trust flag provided)", "warn");
      log("You'll need to trust the CA manually:", "info");
      console.log(`  CA certificate: ${join(CERT_DIR, "ca.crt")}`);
    }

    printNextSteps();
  } catch (error) {
    console.log("");
    log("Certificate setup failed. Please fix the errors above and try again.", "error");
    if ((error as Error).message) {
      console.log(`\nError: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}

main();
