import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./Toast";

// Parse error message from API response
function parseErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
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

export function QueryErrorHandler({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    // Set up global mutation error handler
    const mutationCache = queryClient.getMutationCache();
    
    const unsubscribe = mutationCache.subscribe((event) => {
      if (event.type === "updated" && event.mutation.state.status === "error") {
        const error = event.mutation.state.error;
        const message = parseErrorMessage(error);
        
        // Get context from mutation meta if available
        const context = (event.mutation.options.meta as { errorContext?: string })?.errorContext;
        
        toast.error(
          context ? `${context} failed` : "Request failed",
          message
        );
      }
      
      if (event.type === "updated" && event.mutation.state.status === "success") {
        const meta = event.mutation.options.meta as { 
          successMessage?: string; 
          successDescription?: string 
        } | undefined;
        
        if (meta?.successMessage) {
          toast.success(meta.successMessage, meta.successDescription);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, toast]);

  return <>{children}</>;
}
