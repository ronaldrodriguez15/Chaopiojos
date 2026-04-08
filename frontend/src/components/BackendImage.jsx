import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media';

const BackendImage = ({
  src,
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || hasError) {
    return (
      <div className={`flex items-center justify-center bg-white ${className} ${fallbackClassName}`.trim()}>
        <Icon className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={`${className} ${imgClassName}`.trim()}
      loading={loading}
      decoding={decoding}
      onError={() => setHasError(true)}
    />
  );
};

export default BackendImage;
