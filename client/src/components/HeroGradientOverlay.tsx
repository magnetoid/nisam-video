interface HeroGradientOverlayProps {
  className?: string;
  direction?: "left" | "right" | "top" | "bottom";
}

export function HeroGradientOverlay({ className = "", direction = "left" }: HeroGradientOverlayProps) {
  const gradients = {
    left: "linear-gradient(90deg, rgba(8,8,8,1) 30%, transparent 70%)",
    right: "linear-gradient(270deg, rgba(8,8,8,1) 30%, transparent 70%)",
    top: "linear-gradient(180deg, rgba(8,8,8,1) 30%, transparent 70%)",
    bottom: "linear-gradient(0deg, rgba(8,8,8,1) 30%, transparent 70%)",
  };

  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{ background: gradients[direction] }}
    />
  );
}