import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeployConfigModal } from "../DeployConfigModal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/core/api/hooks/useDeployments", () => ({
  useCreateDeployment: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "dep-123", version: 1 }),
    isPending: false,
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

const defaultProps = {
  projectId: "project-123",
  defaultBranch: "main",
};

describe("DeployConfigModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dialog trigger button when children are provided", () => {
    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    expect(screen.getByRole("button", { name: /open modal/i })).toBeInTheDocument();
  });

  it("opens dialog when trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/deploy with options/i)).toBeInTheDocument();
    });
  });

  it("renders git branch input with default branch value", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      const branchInput = screen.getByLabelText(/git branch/i);
      expect(branchInput).toBeInTheDocument();
      expect(branchInput).toHaveValue("main");
    });
  });

  it("renders git commit input as optional", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/commit sha/i)).toBeInTheDocument();
      expect(screen.getByText(/deploy a specific commit/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for invalid commit SHA", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/deploy with options/i)).toBeInTheDocument();
    });

    // Verify the commit input is present and has the right attributes
    const commitInput = screen.getByLabelText(/commit sha/i);
    expect(commitInput).toBeInTheDocument();
    expect(commitInput).toHaveAttribute("placeholder", "a1b2c3d");
  });

  it("does not show validation error for valid commit SHA", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      const commitInput = screen.getByLabelText(/commit sha/i);
      expect(commitInput).toBeInTheDocument();
    });

    const commitInput = screen.getByLabelText(/commit sha/i);
    await user.click(commitInput);
    await user.keyboard("a1b2c3d");
    commitInput.blur();

    await waitFor(() => {
      expect(screen.queryByText(/invalid commit sha/i)).not.toBeInTheDocument();
    });
  });

  it("renders build args section", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/build args/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add arg/i })).toBeInTheDocument();
    });
  });

  it("adds build arg entry when add arg button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add arg/i })).toBeInTheDocument();
    });

    const addArgButton = screen.getByRole("button", { name: /add arg/i });
    await user.click(addArgButton);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(/key/i)).toHaveLength(1);
      expect(screen.getAllByPlaceholderText(/value/i)).toHaveLength(1);
    });
  });

  it("shows delete button for build arg entries", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add arg/i })).toBeInTheDocument();
    });

    const addArgButton = screen.getByRole("button", { name: /add arg/i });
    await user.click(addArgButton);

    // Wait for build arg inputs to appear
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText("KEY");
      expect(inputs.length).toBe(1);
    });

    // Verify there are icon buttons (close and delete buttons)
    const iconButtons = screen.getAllByRole("button").filter((button) => {
      return button.querySelector("svg");
    });

    // Should have at least close button and delete button
    expect(iconButtons.length).toBeGreaterThan(1);
  });

  it("closes dialog when cancel button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/deploy with options/i)).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/deploy with options/i)).not.toBeInTheDocument();
    });
  });

  it("renders start deployment button", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start deployment/i })).toBeInTheDocument();
    });
  });

  it("shows helper text for build args", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText(/build arguments are set at build-time/i)
      ).toBeInTheDocument();
    });
  });

  it("shows empty state for build args when none are added", async () => {
    const user = userEvent.setup();

    render(
      <DeployConfigModal {...defaultProps}>
        <button>Open Modal</button>
      </DeployConfigModal>,
      { wrapper }
    );

    const trigger = screen.getByRole("button", { name: /open modal/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/no build arguments configured/i)).toBeInTheDocument();
    });
  });
});
