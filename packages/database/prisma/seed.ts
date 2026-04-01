import { PrismaClient } from "../src/generated/client/index.js";

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  console.log("Seeding database...");

  const systemRoles = [
    { name: "platform_admin", description: "Full access to all platform resources" },
    { name: "team_owner", description: "Full access within a team" },
    { name: "team_admin", description: "Administrative access within a team" },
    { name: "team_member", description: "Standard team access" },
    { name: "team_viewer", description: "Read-only access within a team" },
  ];

  for (const role of systemRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });
  }

  console.log("Seeded system roles");

  const resources = [
    "projects",
    "deployments",
    "containers",
    "environments",
    "domains",
    "secrets",
    "env_vars",
    "images",
    "services",
    "registries",
    "teams",
    "members",
    "users",
    "api_keys",
    "audit_logs",
    "webhooks",
    "jobs",
    "alerts",
    "integrations",
    "network_policies",
  ];

  const actions = [
    "create",
    "read",
    "update",
    "delete",
    "deploy",
    "manage_members",
    "invite",
    "admin",
  ];

  for (const resource of resources) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: {
          resource_action: { resource, action },
        },
        update: {},
        create: { resource, action },
      });
    }
  }

  console.log(`Seeded ${resources.length * actions.length} permissions`);

  const platformAdmin = await prisma.role.findUnique({
    where: { name: "platform_admin" },
    include: { permissions: true },
  });

  if (platformAdmin) {
    const allPermissions = await prisma.permission.findMany();
    const existingPermissionIds = new Set(platformAdmin.permissions.map((p) => p.id));

    for (const permission of allPermissions) {
      if (!existingPermissionIds.has(permission.id)) {
        await prisma.rolePermission.create({
          data: {
            roleId: platformAdmin.id,
            permissionId: permission.id,
          },
        });
      }
    }

    console.log(`Granted ${allPermissions.length} permissions to platform_admin role`);
  }

  await seedTeamRolePermissions();

  console.log("Seed complete");
}

async function seedTeamRolePermissions(): Promise<void> {
  const rolePermissions: Record<string, Array<{ resource: string; action: string }>> = {
    team_owner: [
      ...expandWildcard("projects"),
      ...expandWildcard("deployments"),
      ...expandWildcard("containers"),
      ...expandWildcard("secrets"),
      ...expandWildcard("env_vars"),
      ...expandWildcard("domains"),
      ...expandWildcard("environments"),
      ...expandWildcard("services"),
      ...expandWildcard("registries"),
      { resource: "teams", action: "manage_members" },
      { resource: "teams", action: "invite" },
      { resource: "teams", action: "delete" },
      ...expandWildcard("members"),
      ...expandWildcard("api_keys"),
      { resource: "audit_logs", action: "read" },
      ...expandWildcard("webhooks"),
      ...expandWildcard("jobs"),
      ...expandWildcard("alerts"),
      ...expandWildcard("integrations"),
      ...expandWildcard("network_policies"),
    ],
    team_admin: [
      ...expandWildcard("projects"),
      ...expandWildcard("deployments"),
      ...expandWildcard("containers"),
      ...expandWildcard("secrets"),
      ...expandWildcard("env_vars"),
      ...expandWildcard("domains"),
      ...expandWildcard("environments"),
      ...expandWildcard("services"),
      ...expandWildcard("registries"),
      { resource: "teams", action: "manage_members" },
      { resource: "teams", action: "invite" },
      ...expandWildcard("members"),
      ...expandWildcard("api_keys"),
      { resource: "audit_logs", action: "read" },
      ...expandWildcard("webhooks"),
      ...expandWildcard("jobs"),
      ...expandWildcard("alerts"),
      ...expandWildcard("integrations"),
      ...expandWildcard("network_policies"),
    ],
    team_member: [
      { resource: "projects", action: "create" },
      { resource: "projects", action: "read" },
      { resource: "projects", action: "update" },
      { resource: "projects", action: "delete" },
      { resource: "deployments", action: "create" },
      { resource: "deployments", action: "read" },
      { resource: "deployments", action: "delete" },
      { resource: "containers", action: "create" },
      { resource: "containers", action: "read" },
      { resource: "containers", action: "update" },
      { resource: "containers", action: "delete" },
      { resource: "environments", action: "read" },
      { resource: "environments", action: "update" },
      { resource: "secrets", action: "read" },
      { resource: "env_vars", action: "read" },
      { resource: "api_keys", action: "create" },
      { resource: "api_keys", action: "read" },
      { resource: "api_keys", action: "update" },
      { resource: "api_keys", action: "delete" },
      { resource: "webhooks", action: "create" },
      { resource: "webhooks", action: "read" },
      { resource: "webhooks", action: "update" },
      { resource: "webhooks", action: "delete" },
      { resource: "jobs", action: "create" },
      { resource: "jobs", action: "read" },
      { resource: "jobs", action: "update" },
      { resource: "jobs", action: "delete" },
      { resource: "alerts", action: "create" },
      { resource: "alerts", action: "read" },
      { resource: "alerts", action: "update" },
      { resource: "alerts", action: "delete" },
    ],
    team_viewer: [
      { resource: "projects", action: "read" },
      { resource: "deployments", action: "read" },
      { resource: "containers", action: "read" },
      { resource: "environments", action: "read" },
      { resource: "services", action: "read" },
      { resource: "api_keys", action: "read" },
      { resource: "webhooks", action: "read" },
      { resource: "jobs", action: "read" },
      { resource: "alerts", action: "read" },
    ],
  };

  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      include: { permission: true },
    });
    const existingKeys = new Set(
      existing.map((ep) => `${ep.permission.resource}:${ep.permission.action}`)
    );

    for (const { resource, action } of permissions) {
      const key = `${resource}:${action}`;
      if (existingKeys.has(key)) continue;

      const permission = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (!permission) continue;

      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permission.id },
      });
    }

    console.log(`Seeded permissions for ${roleName}`);
  }
}

function expandWildcard(resource: string): Array<{ resource: string; action: string }> {
  return ["create", "read", "update", "delete"].map((action) => ({
    resource,
    action,
  }));
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
