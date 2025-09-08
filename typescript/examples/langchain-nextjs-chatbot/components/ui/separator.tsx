import * as React from "react";

export function Separator({ className }: { className?: string }) {
  return <div className={`w-full border-t border-gray-700 ${className}`} />;
}
