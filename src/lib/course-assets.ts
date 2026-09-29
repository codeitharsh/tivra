// Shared with LessonBlockRenderer's local copy of the same one-liner —
// course-assets is a public bucket, so a storage path maps straight to a
// public URL with no signing needed.
export function courseAssetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-assets/${path}`
}

// course-videos is a separate public bucket from course-assets (large
// lesson recordings vs. small in-lesson images/diagrams) so the two can
// carry different size/mime policies at the bucket level.
export function courseVideoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-videos/${path}`
}
