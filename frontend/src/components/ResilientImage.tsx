import { useState, type ImgHTMLAttributes } from "react";
import { FALLBACK_IMAGE } from "../lib/images";

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

export default function ResilientImage({
  src,
  onError,
  ...props
}: ResilientImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <img
      {...props}
      src={failedSource === src ? FALLBACK_IMAGE : src}
      onError={(event) => {
        onError?.(event);
        if (failedSource !== src) setFailedSource(src);
      }}
    />
  );
}
