// Read the published thumbnail from YouTube so channel artwork changes carry through.
export default function TerritoryVideoThumbnail({ videoId, src }: { videoId: string; src?: string }) {
  return <img
    src={src || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg?v=20261028-custom`}
    width="1280"
    height="720"
    loading="lazy"
    decoding="async"
    alt=""
    onError={event => {
      if (!src && event.currentTarget.src.includes('/maxresdefault.jpg')) {
        event.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?v=20261028-custom`
      }
    }}
  />
}
