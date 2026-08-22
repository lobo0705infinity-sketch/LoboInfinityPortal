import { useMemo, useState } from 'react'
import { FACTION_PORTRAIT_DERIVATIVES } from '../config/factionPortraitDerivatives'

type FactionPortraitImageProps = {
  alt: string
  className?: string
  height: number
  loading: 'eager' | 'lazy'
  onError?: () => void
  sizes: string
  src: string
  width: number
}

function FactionPortraitImage({
  alt,
  className,
  height,
  loading,
  onError,
  sizes,
  src,
  width,
}: FactionPortraitImageProps) {
  const [useOptimized, setUseOptimized] = useState(true)
  const derivatives = useMemo(() => getPortraitDerivatives(src), [src])
  const srcSet = derivatives
    ? derivatives.map(({ src: derivativeSrc, width: derivativeWidth }) => `${derivativeSrc} ${derivativeWidth}w`).join(', ')
    : ''

  return (
    <picture className={className}>
      {useOptimized && srcSet ? <source sizes={sizes} srcSet={srcSet} type="image/webp" /> : null}
      <img
        alt={alt}
        decoding="async"
        height={height}
        loading={loading}
        onError={() => {
          if (useOptimized && srcSet) {
            setUseOptimized(false)
            return
          }

          onError?.()
        }}
        src={src}
        width={width}
      />
    </picture>
  )
}

function getPortraitDerivatives(src: string) {
  const match = src.match(/^\/faction-portraits\/([^/]+)\.png$/)

  return match ? FACTION_PORTRAIT_DERIVATIVES[match[1]] : undefined
}

export default FactionPortraitImage
