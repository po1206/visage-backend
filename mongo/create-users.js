use admin;

db.createUser(
  {
    user: "visageAdmin",
    pwd: "{{VISAGE_ADMIN_USER}}",
    roles: [
      {role: "dbAdminAnyDatabase", db: "admin"},
      {role: "userAdminAnyDatabase", db: "admin"},
      {role: "readWriteAnyDatabase", db: "admin"}]
  }
);

db.auth('visageAdmin', '{{VISAGE_ADMIN_USER}}');

use visagebackendusers;

db.createUser(
  {
    user: "nodebackend",
    pwd: "{{NODE_BACKEND_USER}}",
    roles: [
      {role: "read", db: "visagebackendusers"},
      {role: "readWrite", db: "visage"}
    ]
  }
);