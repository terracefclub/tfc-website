terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "3.81.0"
    }
  }
}

resource "google_storage_bucket" "media_server" {
  name = "tfc-media-bucket"
}

resource "google_project_service" "api" {
  service = "cloudresourcemanager.googleapis.com"
}

resource "google_project_iam_member" "bucketman" {
  role = "roles/storage.admin"
  member = "serviceAccount:${var.servicer}"
}