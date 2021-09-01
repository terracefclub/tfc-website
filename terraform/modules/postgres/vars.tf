variable "servicer" {
  type = string
  description = "The service account or user to control bucket storage"
}

variable "database" {
  type = map
}

output "datapass" {
  value = data.google_sql_ca_certs.datapass
}

output "database" {
  value = {
    connection_name = google_sql_database_instance.default.connection_name
    db = google_sql_database.default.name
    user = google_sql_user.users.name
    password = google_sql_user.users.password
  }
}
