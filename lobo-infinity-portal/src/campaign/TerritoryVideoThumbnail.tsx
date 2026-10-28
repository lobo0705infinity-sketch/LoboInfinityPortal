// Read the published thumbnail from YouTube so channel artwork changes carry through.
export default function TerritoryVideoThumbnail({ videoId }: { videoId: string }) {
  return <img
    src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg?v=20261028-custom`}
    width="1280"
    height="720"
    loading="lazy"
    decoding="async"
    alt=""
    onError={event => {
      if (event.currentTarget.src.includes('/maxresdefault.jpg')) {
        event.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?v=20261028-custom`
      }
    }}
  />
}
