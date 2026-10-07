import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrCode({ value, size = 200 }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value, size]);
  if (!src) return <div className="animate-pulse rounded bg-muted" style={{ width: size, height: size }} />;
  return <img src={src} width={size} height={size} alt="Código QR" className="rounded" />;
}