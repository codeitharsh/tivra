// Shared with LessonBlockRenderer's local copy of the same one-liner —
// course-assets is a public bucket, so a storage path maps straight to a
// public URL with no signing needed.
export function courseAssetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/course-assets/${path}`
}
