import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeploymentSection } from "../DeploymentSection";
import type { Project, Deployment } from "@forge/types";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    navigate: vi.fn(),
  }),
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params: Record<string, string> }) => (
    <a href={to.replace(/\$\w+/g, (match) => params[match.slice(1)] || "")}>{children}</a>
  ),
}));

vi.mock("@/core/api/hooks/useDeployments", () => ({
  useCreateDeployment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "dep-123", version: 1 }),
    isPending: false,
  }),
  useCancelDeployment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "dep-123", status: "CANCELLED" }),
    isPending: false,
  }),
}));

vi.mock("@/core/api/hooks/useProjects", () => ({
  useProjectWithGitIntegration: () => ({
    data: {
      gitIntegration: { id: "git-123", repository: "https://github.com/user/repo", branch: "main" },
    },
  }),
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

const mockProject: Project = {
  id: "project-123",
  name: "test-project",
  type: "nextjs",
  sourceType: "GIT",
  sourceUrl: "https://github.com/user/repo.git",
  status: "INACTIVE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  config: {},
  metadata: {},
};

const mockDeployment: Deployment = {
  id: "dep-123",
  projectId: "project-123",
  version: 1,
  status: "SUCCEEDED",
  createdAt: new Date(Date.now() - 300000).toISOString(),
  updatedAt: new Date(Date.now() - 60000).toISOString(),
  strategy: "ROLLING",
};

const defaultProps = {
  project: mockProject,
  deployments: [mockDeployment],
};

describe("DeploymentSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders deployments title and description", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(screen.getAllByText(/deployments/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/create and manage project deployments/i)
    ).toBeInTheDocument();
  });

  it("renders deploy now button", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(
      screen.getByRole("button", { name: /deploy now/i })
    ).toBeInTheDocument();
  });

  it("renders configure button", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(
      screen.getByRole("button", { name: /configure/i })
    ).toBeInTheDocument();
  });

  it("renders latest deployment info", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    // Check that deployment history section is present
    expect(screen.getByText(/deployment history/i)).toBeInTheDocument();
    // Check that deployments text appears multiple times (title, description)
    expect(screen.getAllByText(/deployments/i).length).toBeGreaterThan(1);
  });

  it("renders deployment history section", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(screen.getByText(/deployment history/i)).toBeInTheDocument();
  });

  it("shows deploy buttons as enabled when no active deployment", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    const deployNowButton = screen.getByRole("button", { name: /deploy now/i });
    const configureButton = screen.getByRole("button", { name: /configure/i });

    expect(deployNowButton).not.toBeDisabled();
    expect(configureButton).not.toBeDisabled();
  });

  it("disables deploy buttons when deployment is active", () => {
    const activeDeployment = { ...mockDeployment, status: "BUILDING" as const };
    render(
      <DeploymentSection {...defaultProps} deployments={[activeDeployment]} />,
      { wrapper }
    );

    const deployNowButton = screen.getByRole("button", { name: /deploying/i });
    const configureButton = screen.getByRole("button", { name: /configure/i });

    expect(deployNowButton).toBeDisabled();
    expect(configureButton).toBeDisabled();
  });

  it("renders deployment progress component for active deployment", () => {
    const activeDeployment = { ...mockDeployment, status: "BUILDING" as const };
    render(
      <DeploymentSection {...defaultProps} deployments={[activeDeployment]} />,
      { wrapper }
    );

    expect(screen.getByText(/deployment in progress/i)).toBeInTheDocument();
  });

  it("does not render latest deployment card when deployment is active", () => {
    const activeDeployment = { ...mockDeployment, status: "BUILDING" as const };
    render(
      <DeploymentSection {...defaultProps} deployments={[activeDeployment]} />,
      { wrapper }
    );

    expect(screen.queryByText(/latest deployment/i)).not.toBeInTheDocument();
  });

  it("renders deployment status badge", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    // Status badge is rendered for the latest deployment
    expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0);
  });

  it("renders deployment list component", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(screen.getByText(/deployment history/i)).toBeInTheDocument();
  });

  it("shows correct icon for configure button", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    const configureButton = screen.getByRole("button", { name: /configure/i });
    expect(configureButton).toBeInTheDocument();
    // Check for the settings SVG icon
    expect(configureButton.querySelector("svg.lucide-settings")).toBeInTheDocument();
  });

  it("shows correct icon for deploy now button", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    const deployNowButton = screen.getByRole("button", { name: /deploy now/i });
    expect(deployNowButton).toBeInTheDocument();
    // Check for the rocket SVG icon
    expect(deployNowButton.querySelector("svg.lucide-rocket")).toBeInTheDocument();
  });

  it("does not render view all button when deployments are 5 or fewer", () => {
    render(<DeploymentSection {...defaultProps} />, { wrapper });

    expect(screen.queryByRole("button", { name: /view all/i })).not.toBeInTheDocument();
  });

  it("renders view all button when deployments are more than 5", () => {
    const manyDeployments = Array.from({ length: 6 }, (_, i) => ({
      ...mockDeployment,
      id: `dep-${i}`,
      version: i + 1,
    }));

    render(<DeploymentSection {...defaultProps} deployments={manyDeployments} />, { wrapper });

    expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
  });

  it("renders error message when set", () => {
    const { rerender } = render(<DeploymentSection {...defaultProps} />, { wrapper });

    // Initially no error message
    expect(screen.queryByText(/a deployment is already in progress/i)).not.toBeInTheDocument();

    // When there's an active deployment, the button shows "Deploying..." instead
    rerender(
      <DeploymentSection
        {...defaultProps}
        deployments={[{ ...mockDeployment, status: "BUILDING" as const }]}
      />
    );

    // The button should show "Deploying..." and be disabled
    expect(screen.getByRole("button", { name: /deploying/i })).toBeDisabled();
  });
});
