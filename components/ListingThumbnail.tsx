"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

// Photos uploaded by the app under <user>/photos/ have a card-sized copy at <user>/photos/thumbs/
// with the same filename (see the presign-upload function). Older photos have none, so they get
// null here rather than a guessed URL that would 404.
function thumbnailUrl(url: string): string | null {
  const match = url.match(/^(.*\/photos\/)([^/]+)$/);
  return match ? `${match[1]}thumbs/${match[2]}` : null;
}

/**
 * next/image for a listing's card photo: loads the small thumbnail when one exists and falls
 * back to the full photo if it fails. Needs to be a client component for onError.
 */
export default function ListingThumbnail({ src, alt, ...props }: ImageProps & { src: string }) {
  // Which URL failed rather than a boolean, so a reused card showing another listing retries.
  const [failedThumb, setFailedThumb] = useState<string | null>(null);
  const thumb = thumbnailUrl(src);
  const displaySrc = thumb && thumb !== failedThumb ? thumb : src;

  return (
    <Image
      {...props}
      src={displaySrc}
      alt={alt}
      onError={() => {
        if (displaySrc === thumb) setFailedThumb(thumb);
      }}
    />
  );
}
