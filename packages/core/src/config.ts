export * from "./config/schema";
export * from "./config/loader";
export * from "./config/service";
export * from "./config/validator";

// backward compatibility
export { getConfig as config } from "./config/loader";
export { getConfigService } from "./config/service";
