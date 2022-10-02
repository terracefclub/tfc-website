variable "servicer" {
  type = string
  description = "The service account or user to control bucket storage"
}

output "media_bucket_url" {
  value = google_storage_bucket.media_server.url
}