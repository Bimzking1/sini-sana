import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 168, className = "" }: QRCodeProps) {
  return (
    <div className={`inline-block rounded-xl bg-white p-3 ${className}`}>
      <QRCodeSVG value={value} size={size} level="M" fgColor="#0f172a" bgColor="#ffffff" />
    </div>
  );
}