import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';

const BackendImage = ({
  src,
  fallbackSrc = '',
  alt,
  className = '',
  fallbackClassName = '',
  iconClassName = 'w-6 h-6 text-slate-400',
  icon: Icon = ImageIcon,
  imgClassName = '',
  loading = 'lazy',
  decoding = 'async',
}) => {
  const resolvedSrc = useMemo(() => resolveMediaUrl(src), [src]);
  const resolvedFallbackSrc = useMemo(() => resolveMediaUrl(fallbackSrc), [fallbackSrc]);
  const [hasError, setHasError] = useState(false);
  const [activeSrc, setActiveSrc] = useState(resolvedSrc);

  useEffect(() => {
    setHasError(false);
    setActiveSrc(resolvedSrc);
  }, [resolvedSrc, resolvedFallbackSrc]);

  if (!activeSrc || hasError) {
    return (
      <div className={`flex items-center justify-center bg-white ${className} ${fallbackClassName}`.trim()}>
        <Icon className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={`${className} ${imgClassName}`.trim()}
      loading={loading}
      decoding={decoding}
      onError={() => {
        if (activeSrc !== resolvedFallbackSrc && resolvedFallbackSrc) {
          setActiveSrc(resolvedFallbackSrc);
          return;
        }
        setHasError(true);
      }}
    />
  );
};

export default BackendImage;
