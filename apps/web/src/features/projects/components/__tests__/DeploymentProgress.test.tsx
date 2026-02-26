import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeploymentProgress } from "../DeploymentProgress";
import type { Deployment } from "@forge/types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params: Record<string, string> }) => (
    <a href={to.replace(/\$\w+/g, (match) => params[match.slice(1)] || "")}>{children}</a>
  ),
}));

vi.mock("@/core/api/hooks/useDeployments", () => ({
  useCancelDeployment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "dep-123", status: "CANCELLED" }),
    isPending: false,
  }),
}));

vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 minutes ago",
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

const mockDeployment: Deployment = {
  id: "dep-123",
  projectId: "project-123",
  version: 1,
  status: "BUILDING",
  createdAt: new Date(Date.now() - 120000).toISOString(),
  updatedAt: new Date(Date.now() - 60000).toISOString(),
  strategy: "ROLLING",
};

const defaultProps = {
  deployment: mockDeployment,
  projectId: "project-123",
};

describe("DeploymentProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders deployment progress card for building status", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByText(/deployment in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/building/i)).toBeInTheDocument();
  });

  it("renders correct progress value for building status", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("renders deployment version and id", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByText(/version 1/i)).toBeInTheDocument();
    expect(screen.getByText(/dep-123/i)).toBeInTheDocument();
  });

  it("renders time ago information", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByText(/started 2 minutes ago/i)).toBeInTheDocument();
  });

  it("renders view logs button", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByRole("button", { name: /view logs/i })).toBeInTheDocument();
  });

  it("renders cancel button for cancellable status", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders queued status correctly", () => {
    const queuedDeployment = { ...mockDeployment, status: "QUEUED" as const };
    render(<DeploymentProgress {...defaultProps} deployment={queuedDeployment} />, { wrapper });

    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
  });

  it("renders deploying status correctly", () => {
    const deployingDeployment = { ...mockDeployment, status: "DEPLOYING" as const };
    render(<DeploymentProgress {...defaultProps} deployment={deployingDeployment} />, { wrapper });

    expect(screen.getByText(/deploying/i)).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("renders live status correctly", () => {
    const liveDeployment = { ...mockDeployment, status: "SUCCEEDED" as const };
    render(<DeploymentProgress {...defaultProps} deployment={liveDeployment} />, { wrapper });

    expect(screen.getByText(/live/i)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders failed status with destructive variant", () => {
    const failedDeployment = { ...mockDeployment, status: "FAILED" as const, error: "Build failed" };
    render(<DeploymentProgress {...defaultProps} deployment={failedDeployment} />, { wrapper });

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/build failed/i)).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders cancelled status with destructive variant", () => {
    const cancelledDeployment = { ...mockDeployment, status: "CANCELLED" as const };
    render(<DeploymentProgress {...defaultProps} deployment={cancelledDeployment} />, { wrapper });

    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows error message for failed deployment", () => {
    const failedDeployment = { ...mockDeployment, status: "FAILED" as const, error: "Docker build timeout" };
    render(<DeploymentProgress {...defaultProps} deployment={failedDeployment} />, { wrapper });

    expect(screen.getByText(/deployment failed/i)).toBeInTheDocument();
    expect(screen.getByText(/docker build timeout/i)).toBeInTheDocument();
  });

  it("shows status-specific message for building deployment", () => {
    render(<DeploymentProgress {...defaultProps} />, { wrapper });

    expect(
      screen.getByText(/your application is being built. this may take a few minutes/i)
    ).toBeInTheDocument();
  });

  it("shows status-specific message for deploying deployment", () => {
    const deployingDeployment = { ...mockDeployment, status: "DEPLOYING" as const };
    render(<DeploymentProgress {...defaultProps} deployment={deployingDeployment} />, { wrapper });

    expect(
      screen.getByText(/your application is being deployed to the infrastructure/i)
    ).toBeInTheDocument();
  });

  it("shows status-specific message for queued deployment", () => {
    const queuedDeployment = { ...mockDeployment, status: "QUEUED" as const };
    render(<DeploymentProgress {...defaultProps} deployment={queuedDeployment} />, { wrapper });

    expect(
      screen.getByText(/your deployment is queued and will start shortly/i)
    ).toBeInTheDocument();
  });

  it("does not show cancel button for non-cancellable status", () => {
    const deployingDeployment = { ...mockDeployment, status: "DEPLOYING" as const };
    render(<DeploymentProgress {...defaultProps} deployment={deployingDeployment} />, { wrapper });

    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
  });

  it("does not show status-specific message for failed deployment", () => {
    const failedDeployment = { ...mockDeployment, status: "FAILED" as const };
    render(<DeploymentProgress {...defaultProps} deployment={failedDeployment} />, { wrapper });

    expect(
      screen.queryByText(/your application is being built/i)
    ).not.toBeInTheDocument();
  });
});
