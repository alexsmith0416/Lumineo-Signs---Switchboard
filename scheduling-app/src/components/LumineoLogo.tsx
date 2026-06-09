import type { SVGProps } from "react";

interface LumineoLogoProps extends Omit<SVGProps<SVGSVGElement>, "title"> {
  size?: number;
  color?: string;
  title?: string;
}

export default function LumineoLogo({
  size = 32,
  color = "#EE0800",
  title = "Lumineo Signs",
  className,
  ...rest
}: LumineoLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 15.27 15.27"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <title>{title}</title>
      <path
        d="M15.27 6.03l-11.94 5.91 11.94 -4.03 0 -1.87zm0 -4.59l-11.94 10.5 11.94 -7.95 0 -2.55zm-11.94 10.5l2.39 -11.94 -5.72 0 0 15.27 15.27 0 0 -5.72 -11.94 2.39zm4.03 -11.94l-4.03 11.94 5.91 -11.94 -1.87 0zm6.46 0l-10.5 11.94 7.95 -11.94 2.55 0z"
        fill={color}
        fillRule="nonzero"
      />
    </svg>
  );
}

