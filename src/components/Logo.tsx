interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 28, className = "" }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Sini Sana logo"
      width={size}
      height={size}
      className={`shrink-0 transition-transform duration-300 hover:rotate-6 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}