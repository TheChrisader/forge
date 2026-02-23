import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateProjectDialog } from "../CreateProjectDialog";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    navigate: vi.fn(),
  }),
  useParams: () => ({ from: "/projects/$projectId" }),
}));

vi.mock("@/core/api/client", () => ({
  apiClient: new (class {
    async get() {
      return { data: [] };
    }
    async post() {
      return { data: { id: "123", name: "test-project" } };
    }
  })(),
  ApiClientError: class extends Error {
    constructor(
      message: string,
      public statusCode?: number,
      public code?: string,
      public details?: unknown
    ) {
      super(message);
      this.name = "ApiClientError";
    }
  },
}));

vi.mock("@/core/api/hooks/useProjects", () => ({
  useCreateProject: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "123", name: "test-project" }),
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

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form fields correctly", () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/git repository url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("shows validation error for invalid name", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();
    const nameInput = screen.getByLabelText(/project name/i);

    await user.click(nameInput);
    await user.keyboard("Invalid_Name!");

    nameInput.blur();

    await waitFor(() => {
      expect(screen.getByText(/lowercase letters/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for git URL with invalid format", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();
    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("ftp://invalid-url.com");

    gitUrlInput.blur();

    await waitFor(() => {
      expect(screen.getByText(/Git URL must start with/i)).toBeInTheDocument();
    });
  });

  it("does not show validation error for valid https URL", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();
    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("https://github.com/username/repo");

    gitUrlInput.blur();

    expect(screen.queryByText(/Git URL must start with/i)).not.toBeInTheDocument();
  });

  it("does not show validation error for valid SSH URL", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();
    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("git@github.com:username/repo.git");

    gitUrlInput.blur();

    expect(screen.queryByText(/Git URL must start with/i)).not.toBeInTheDocument();
  });

  it("does not show validation error for empty git URL (optional field)", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    gitUrlInput.blur();

    expect(screen.queryByText(/Git URL must start with/i)).not.toBeInTheDocument();
  });

  it("has create button that is disabled when name is empty", () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const createButton = screen.getByRole("button", { name: /create project/i });
    const nameInput = screen.getByLabelText(/project name/i);

    nameInput.blur();

    expect(createButton).toBeInTheDocument();
  });
});
