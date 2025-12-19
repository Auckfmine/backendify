import { ComponentProps, forwardRef } from "react";
import { clsx } from "clsx";

export interface CardProps extends ComponentProps<"div"> {
  variant?: "default" | "elevated" | "bordered" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
}

const variantStyles = {
  default: "bg-white border border-slate-200/80 shadow-sm shadow-slate-200/50",
  elevated: "bg-white border border-slate-200/60 shadow-lg shadow-slate-200/60",
  bordered: "bg-white/80 border-2 border-slate-200",
  glass: "bg-white/70 backdrop-blur-xl border border-white/20 shadow-lg shadow-slate-200/40",
};

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "none", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "rounded-2xl transition-all duration-200",
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export interface CardHeaderProps extends ComponentProps<"div"> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx("flex flex-col space-y-1.5 p-6 pb-4", className)}
      {...props}
    />
  )
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends ComponentProps<"h3"> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={clsx("text-lg font-semibold text-slate-900 tracking-tight", className)}
      {...props}
    />
  )
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends ComponentProps<"p"> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={clsx("text-sm text-slate-500", className)}
      {...props}
    />
  )
);

CardDescription.displayName = "CardDescription";

export interface CardContentProps extends ComponentProps<"div"> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx("p-6 pt-0", className)} {...props} />
  )
);

CardContent.displayName = "CardContent";

export interface CardFooterProps extends ComponentProps<"div"> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
);

CardFooter.displayName = "CardFooter";
