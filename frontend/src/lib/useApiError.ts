import { useEffect } from "react";
import { useToast } from "../components/Toast";

// Parse error message from API response
function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      // Try to parse JSON error response
      const parsed = JSON.parse(error.message);
      return parsed.detail || parsed.message || error.message;
    } catch {
      return error.message;
    }
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

// Hook to show toast on query/mutation error
export function useApiError(error: unknown, context?: string) {
  const toast = useToast();

  useEffect(() => {
    if (error) {
      const message = parseErrorMessage(error);
      toast.error(
        context ? `${context} failed` : "Request failed",
        message
      );
    }
  }, [error, context, toast]);
}

// Hook to show success toast
export function useApiSuccess(
  isSuccess: boolean,
  message: string,
  description?: string
) {
  const toast = useToast();

  useEffect(() => {
    if (isSuccess) {
      toast.success(message, description);
    }
  }, [isSuccess, message, description, toast]);
}

// Combined hook for mutations
export function useMutationToasts(
  mutation: {
    isSuccess: boolean;
    isError: boolean;
    error: unknown;
  },
  options: {
    successMessage?: string;
    successDescription?: string;
    errorContext?: string;
  } = {}
) {
  const toast = useToast();

  useEffect(() => {
    if (mutation.isSuccess && options.successMessage) {
      toast.success(options.successMessage, options.successDescription);
    }
  }, [mutation.isSuccess, options.successMessage, options.successDescription, toast]);

  useEffect(() => {
    if (mutation.isError && mutation.error) {
      const message = parseErrorMessage(mutation.error);
      toast.error(
        options.errorContext ? `${options.errorContext} failed` : "Request failed",
        message
      );
    }
  }, [mutation.isError, mutation.error, options.errorContext, toast]);
}
