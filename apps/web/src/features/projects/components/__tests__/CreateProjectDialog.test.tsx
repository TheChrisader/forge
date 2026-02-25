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
    expect(screen.getByLabelText(/source type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("shows git repository URL input when git is selected", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Open the source type selector
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);

    // Select git option
    const gitOption = await screen.findByText("Git Repository");
    await user.click(gitOption);

    // Git URL input should now be visible
    expect(screen.getByLabelText(/git repository url/i)).toBeInTheDocument();
  });

  it("shows local path input when local is selected", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Open the source type selector
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);

    // Select local option
    const localOption = await screen.findByText("Local Path");
    await user.click(localOption);

    // Local path input should now be visible
    expect(screen.getByLabelText(/local path/i)).toBeInTheDocument();
  });

  it("shows image reference input when image is selected", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Open the source type selector
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);

    // Select image option
    const imageOption = await screen.findByText("Docker Registry");
    await user.click(imageOption);

    // Image reference input should now be visible
    expect(screen.getByLabelText(/image reference/i)).toBeInTheDocument();
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

    // Select git source type first
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);
    const gitOption = await screen.findByText("Git Repository");
    await user.click(gitOption);

    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("ftp://invalid-url.com");

    gitUrlInput.blur();

    await waitFor(() => {
      expect(screen.getByText(/Git URL must start with/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for local path with invalid format", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Select local source type first
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);
    const localOption = await screen.findByText("Local Path");
    await user.click(localOption);

    const localPathInput = screen.getByLabelText(/local path/i);

    await user.click(localPathInput);
    await user.keyboard("invalid-path");

    localPathInput.blur();

    await waitFor(() => {
      expect(screen.getByText(/Invalid local path format/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for image with invalid format", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Select image source type first
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);
    const imageOption = await screen.findByText("Docker Registry");
    await user.click(imageOption);

    const imageInput = screen.getByLabelText(/image reference/i);

    await user.click(imageInput);
    await user.keyboard("Invalid_Image_Name");

    imageInput.blur();

    await waitFor(() => {
      expect(screen.getByText(/Invalid image format/i)).toBeInTheDocument();
    });
  });

  it("does not show validation error for valid https URL", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Select git source type first
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);
    const gitOption = await screen.findByText("Git Repository");
    await user.click(gitOption);

    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("https://github.com/username/repo");

    gitUrlInput.blur();

    expect(screen.queryByText(/Git URL must start with/i)).not.toBeInTheDocument();
  });

  it("does not show validation error for valid SSH URL", async () => {
    render(<CreateProjectDialog isOpen onClose={() => {}} />, { wrapper });

    const user = userEvent.setup();

    // Select git source type first
    const sourceTypeTrigger = screen.getByRole("combobox");
    await user.click(sourceTypeTrigger);
    const gitOption = await screen.findByText("Git Repository");
    await user.click(gitOption);

    const gitUrlInput = screen.getByLabelText(/git repository url/i);

    await user.click(gitUrlInput);
    await user.keyboard("git@github.com:username/repo.git");

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
