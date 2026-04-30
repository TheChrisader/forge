import type { DiscoveredScripts } from "./script-discovery.js";

const FRAMEWORK_DEFAULTS = {
  nextjs: {
    build: "next build",
    start: "next start",
    install: "npm ci",
  },
  vite: {
    build: "vite build",
    start: "npx serve dist -s",
    install: "npm ci",
  },
  nestjs: {
    build: "npm run build",
    start: "node dist/main.js",
    install: "npm ci",
  },
  react: {
    build: "react-scripts build",
    start: "react-scripts start",
    install: "npm ci",
  },
  vue: {
    build: "vite build",
    start: "vite preview",
    install: "npm ci",
  },
  svelte: {
    build: "vite build",
    start: "vite preview",
    install: "npm ci",
  },
  astro: {
    build: "astro build",
    start: "astro preview",
    install: "npm ci",
  },
  nuxt: {
    build: "nuxt build",
    start: "node .output/server/index.mjs",
    install: "npm ci",
  },
  remix: {
    build: "remix build",
    start: "remix-serve server/index.js",
    install: "npm ci",
  },
  express: {
    build: undefined,
    start: "node server.js",
    install: "npm ci",
  },
  fastapi: {
    install: "pip install -r requirements.txt",
    start: "uvicorn main:app --host 0.0.0.0 --port 8000",
    build: undefined,
  },
  django: {
    install: "pip install -r requirements.txt",
    start: "python manage.py runserver 0.0.0.0:8000",
    build: undefined,
  },
  flask: {
    install: "pip install -r requirements.txt",
    start: "flask run --host=0.0.0.0 --port 5000",
    build: undefined,
  },
  tornado: {
    install: "pip install -r requirements.txt",
    start: "python main.py",
    build: undefined,
  },
  gin: {
    install: "go mod download",
    build: "go build -o app",
    start: "./app",
  },
  echo: {
    install: "go mod download",
    build: "go build -o app",
    start: "./app",
  },
  fiber: {
    install: "go mod download",
    build: "go build -o app",
    start: "./app",
  },
  hugo: {
    install: "hugo",
    build: "hugo --minify",
    start: "hugo server",
  },
  jekyll: {
    install: "bundle install",
    build: "bundle exec jekyll build",
    start: "bundle exec jekyll serve",
  },
  generic: {
    install: "npm ci",
    build: "npm run build",
    start: "npm start",
  },
  "generic-python": {
    install: "pip install -r requirements.txt",
    start: "python main.py",
    build: undefined,
  },
  "generic-go": {
    install: "go mod download",
    build: "go build -o app",
    start: "./app",
  },
} as const;

export interface ResolvedCommand {
  /** The resolved command, or null if no command could be determined */
  command: string | null;
  /** Source of the command (e.g., "override", "discovered", "framework-default", "generic-fallback") */
  source: string;
  /** Any warnings generated during resolution */
  warnings: string[];
}

export interface CommandResolutionOptions {
  /** User-provided override command (highest priority) */
  override?: string;
  /** Framework identifier for defaults */
  framework?: string;
  /** Environment context (e.g., "production", "staging") */
  environment?: string;
  /** Whether to allow null results when no command is found */
  allowNull?: boolean;
}

/**
 * Resolve a build command with intelligent fallbacks
 *
 * Priority order:
 * 1. User-provided override
 * 2. Discovered script from manifest
 * 3. Framework-specific default
 * 4. Generic fallback
 *
 * @param scripts - Discovered scripts from manifest file
 * @param options - Resolution options
 * @returns ResolvedCommand with command and metadata
 */
export function resolveBuildCommand(
  scripts: DiscoveredScripts | null,
  options?: CommandResolutionOptions
): ResolvedCommand {
  const framework = options?.framework?.toLowerCase() ?? "generic";
  const override = options?.override;

  if (override) {
    return {
      command: override,
      source: "override",
      warnings: [],
    };
  }

  if (scripts?.build) {
    return {
      command: scripts.build,
      source: `discovered (${scripts.source})`,
      warnings: [],
    };
  }

  const frameworkDefaults = FRAMEWORK_DEFAULTS[framework as keyof typeof FRAMEWORK_DEFAULTS];
  if (frameworkDefaults?.build) {
    return {
      command: frameworkDefaults.build,
      source: `framework-default (${framework})`,
      warnings: [
        `No build script found in ${scripts?.source || "manifest"}. Using framework default for ${framework}.`,
      ],
    };
  }

  const genericDefaults = FRAMEWORK_DEFAULTS.generic;
  if (genericDefaults.build) {
    return {
      command: genericDefaults.build,
      source: "generic-fallback",
      warnings: [
        `No build script found and no specific default for ${framework}. Using generic build command.`,
      ],
    };
  }

  // No command available
  if (options?.allowNull) {
    return {
      command: null,
      source: "none",
      warnings: ["No build command could be determined."],
    };
  }

  return {
    command: null,
    source: "none",
    warnings: [
      "No build command found. Please provide a build command in your manifest file or via override.",
    ],
  };
}

/**
 * Resolve a start command with intelligent fallbacks
 *
 * Priority order:
 * 1. User-provided override
 * 2. Discovered script from manifest
 * 3. Framework-specific default
 * 4. Generic fallback
 *
 * @param scripts - Discovered scripts from manifest file
 * @param options - Resolution options
 * @returns ResolvedCommand with command and metadata
 */
export function resolveStartCommand(
  scripts: DiscoveredScripts | null,
  options?: CommandResolutionOptions
): ResolvedCommand {
  const framework = options?.framework?.toLowerCase() ?? "generic";
  const override = options?.override;

  if (override) {
    return {
      command: override,
      source: "override",
      warnings: [],
    };
  }

  if (scripts?.start) {
    return {
      command: scripts.start,
      source: `discovered (${scripts.source})`,
      warnings: [],
    };
  }

  const frameworkDefaults = FRAMEWORK_DEFAULTS[framework as keyof typeof FRAMEWORK_DEFAULTS];
  if (frameworkDefaults?.start) {
    return {
      command: frameworkDefaults.start,
      source: `framework-default (${framework})`,
      warnings: [
        `No start script found in ${scripts?.source || "manifest"}. Using framework default for ${framework}.`,
      ],
    };
  }

  const genericDefaults = FRAMEWORK_DEFAULTS.generic;
  if (genericDefaults.start) {
    return {
      command: genericDefaults.start,
      source: "generic-fallback",
      warnings: [
        `No start script found and no specific default for ${framework}. Using generic start command.`,
      ],
    };
  }

  if (options?.allowNull) {
    return {
      command: null,
      source: "none",
      warnings: ["No start command could be determined."],
    };
  }

  return {
    command: null,
    source: "none",
    warnings: [
      "No start command found. Please provide a start command in your manifest file or via override.",
    ],
  };
}

/**
 * Resolve an install command with intelligent fallbacks
 *
 * Priority order:
 * 1. User-provided override
 * 2. Discovered script from manifest
 * 3. Framework-specific default
 * 4. Generic fallback
 *
 * @param scripts - Discovered scripts from manifest file
 * @param options - Resolution options
 * @returns ResolvedCommand with command and metadata
 */
export function resolveInstallCommand(
  scripts: DiscoveredScripts | null,
  options?: CommandResolutionOptions
): ResolvedCommand {
  const framework = options?.framework?.toLowerCase() ?? "generic";
  const override = options?.override;

  if (override) {
    return {
      command: override,
      source: "override",
      warnings: [],
    };
  }

  if (scripts?.install) {
    return {
      command: scripts.install,
      source: `discovered (${scripts.source})`,
      warnings: [],
    };
  }

  const frameworkDefaults = FRAMEWORK_DEFAULTS[framework as keyof typeof FRAMEWORK_DEFAULTS];
  if (frameworkDefaults?.install) {
    return {
      command: frameworkDefaults.install,
      source: `framework-default (${framework})`,
      warnings: [
        `No install script found in ${scripts?.source || "manifest"}. Using framework default for ${framework}.`,
      ],
    };
  }

  const genericDefaults = FRAMEWORK_DEFAULTS.generic;
  if (genericDefaults.install) {
    return {
      command: genericDefaults.install,
      source: "generic-fallback",
      warnings: [
        `No install script found and no specific default for ${framework}. Using generic install command.`,
      ],
    };
  }

  if (options?.allowNull) {
    return {
      command: null,
      source: "none",
      warnings: ["No install command could be determined."],
    };
  }

  return {
    command: null,
    source: "none",
    warnings: [
      "No install command found. Please provide an install command in your manifest file or via override.",
    ],
  };
}

/**
 * Resolve all commands (install, build, start) at once
 *
 * @param scripts - Discovered scripts from manifest file
 * @param options - Resolution options
 * @returns Object with all resolved commands and combined warnings
 */
export function resolveAllCommands(
  scripts: DiscoveredScripts | null,
  options?: CommandResolutionOptions
): {
  install: ResolvedCommand;
  build: ResolvedCommand;
  start: ResolvedCommand;
  allWarnings: string[];
} {
  const install = resolveInstallCommand(scripts, {
    ...options,
    override: options?.override,
  });
  const build = resolveBuildCommand(scripts, options);
  const start = resolveStartCommand(scripts, options);

  const allWarnings = [...install.warnings, ...build.warnings, ...start.warnings];

  return { install, build, start, allWarnings };
}

/**
 * Get framework-specific default commands
 *
 * @param framework - Framework identifier
 * @returns Object with default install, build, and start commands
 */
export function getFrameworkDefaults(framework: string): {
  install?: string;
  build?: string;
  start?: string;
} {
  const key = framework.toLowerCase() as keyof typeof FRAMEWORK_DEFAULTS;
  return FRAMEWORK_DEFAULTS[key] ?? FRAMEWORK_DEFAULTS.generic;
}

/**
 * Normalize framework name to a known identifier
 *
 * @param frameworkName - Raw framework name from detection
 * @returns Normalized framework identifier
 */
export function normalizeFrameworkName(frameworkName?: string): string {
  if (!frameworkName) return "generic";

  const normalized = frameworkName.toLowerCase();

  const frameworkMap: Record<string, string> = {
    "next.js": "nextjs",
    next: "nextjs",
    nestjs: "nestjs",
    nest: "nestjs",
    react: "react",
    "create-react-app": "react",
    cra: "react",
    vue: "vue",
    vuejs: "vue",
    svelte: "svelte",
    sveltekit: "svelte",
    astro: "astro",
    nuxt: "nuxt",
    "nuxt.js": "nuxt",
    remix: "remix",
    "remix.run": "remix",
    express: "express",
    fastapi: "fastapi",
    django: "django",
    flask: "flask",
    gin: "gin",
    "gorilla/mux": "gin",
    "gorilla mux": "gin",
    echo: "echo",
    fiber: "fiber",
    gofiber: "fiber",
    hugo: "hugo",
    jekyll: "jekyll",
    static: "generic",
  };

  return frameworkMap[normalized] ?? normalized;
}

/**
 * Validate if a command string is safe to execute
 *
 * @param command - Command string to validate
 * @returns true if command appears safe, false otherwise
 */
export function validateCommandSafety(command: string): boolean {
  const dangerousPatterns = [
    /\|\|/, // Command chaining
    /&&/, // Command chaining
    /;/, // Command separator
    /\$\(/, // Command substitution
    /`/, // Command substitution
    />\s*\//, // Output redirection to system paths
    /rm\s+-rf/, // Dangerous command
    /sudo/, // Privilege escalation
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return false;
    }
  }

  return true;
}
