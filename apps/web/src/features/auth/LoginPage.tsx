import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Shield } from "lucide-react";
import { useAuth } from "@/core/auth";
import type { ApiClientError } from "@/core/api/client";

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const { login, isAuthenticated } = useAuth();

  const redirectPath = ((search as Record<string, unknown>).redirect as string | undefined) ?? "/";

  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: redirectPath, replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    email: false,
    password: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = useCallback((email: string): string | undefined => {
    if (!email) {
      return "Email is required";
    }
    if (!EMAIL_PATTERN.test(email)) {
      return "Please enter a valid email address";
    }
    return undefined;
  }, []);

  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) {
      return "Password is required";
    }
    return undefined;
  }, []);

  const handleFieldBlur = (field: keyof FormData): void => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const newErrors: FormErrors = {};

    if (field === "email") {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }

    if (field === "password") {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        newErrors.password = passwordError;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    setTouched({ email: true, password: true });

    const newErrors: FormErrors = {};

    const emailError = validateEmail(formData.email);
    if (emailError) {
      newErrors.email = emailError;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await login({
        email: formData.email,
        password: formData.password,
      });
    } catch (err) {
      const error = err as ApiClientError;

      if (error.statusCode === 401) {
        setErrors({ general: "Invalid email or password" });
      } else if (error.code === "NETWORK_ERROR") {
        setErrors({ general: "Network error. Please check your connection and try again." });
      } else if (error.code === "TIMEOUT") {
        setErrors({ general: "Request timed out. Please try again." });
      } else {
        setErrors({ general: error.message || "An unexpected error occurred. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your Forge account</CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={() => handleFieldBlur("email")}
                placeholder="you@example.com"
                disabled={isSubmitting}
                aria-invalid={touched.email && !!errors.email}
                aria-describedby={touched.email && errors.email ? "email-error" : undefined}
              />
              {touched.email && errors.email && (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onBlur={() => handleFieldBlur("password")}
                placeholder="••••••••"
                disabled={isSubmitting}
                aria-invalid={touched.password && !!errors.password}
                aria-describedby={
                  touched.password && errors.password ? "password-error" : undefined
                }
              />
              {touched.password && errors.password && (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {errors.password}
                </p>
              )}
            </div>

            {errors.general && (
              <Alert variant="destructive">
                <AlertDescription role="alert">{errors.general}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
