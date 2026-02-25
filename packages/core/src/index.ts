export const PLATFORM_NAME = "Forge";
export const PLATFORM_VERSION = "0.1.0";

export * from "./config";
export * from "./container";
export * from "./container/container";
export * from "./container/interfaces";
export * from "./container/keys";
export * from "./errors";
export * from "./modules";
export * from "./services/interfaces";
export * from "./services/build-log.service";
export * from "./plugins/interfaces";

console.log(`${PLATFORM_NAME} v${PLATFORM_VERSION} - Core package loaded`);
