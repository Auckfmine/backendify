from fastapi import APIRouter

from app.api.routes import api_keys, app_auth, audit, auth, auth_settings, collections, data, files, policies, projects, rbac, relations, schema_evolution, users, validations, views, webhooks, workflows

api_router = APIRouter(prefix="/api")

# Admin auth (console users)
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])

# App user auth (end users of customer apps)
api_router.include_router(app_auth.router, prefix="/projects/{project_id}/auth", tags=["app_auth"])
api_router.include_router(auth_settings.router, prefix="/projects/{project_id}/settings/auth", tags=["auth_settings"])

# Project resources
api_router.include_router(api_keys.router, prefix="/projects/{project_id}/api-keys", tags=["api_keys"])
api_router.include_router(collections.router, prefix="/projects/{project_id}/schema/collections", tags=["schema"])
api_router.include_router(policies.router, prefix="/projects/{project_id}/schema/collections/{collection_name}/policies", tags=["policies"])
api_router.include_router(schema_evolution.router, prefix="/projects/{project_id}/schema/evolution", tags=["schema_evolution"])
api_router.include_router(relations.router, prefix="/projects/{project_id}/schema/relations", tags=["relations"])
api_router.include_router(views.router, prefix="/projects/{project_id}/views", tags=["views"])
api_router.include_router(validations.router, prefix="/projects/{project_id}/validations", tags=["validations"])
api_router.include_router(files.router, prefix="/projects/{project_id}/files", tags=["files"])
api_router.include_router(data.router, prefix="/projects/{project_id}/data", tags=["data"])
api_router.include_router(audit.router, prefix="/projects/{project_id}/audit", tags=["audit"])
api_router.include_router(webhooks.router, prefix="/projects/{project_id}/webhooks", tags=["webhooks"])
api_router.include_router(workflows.router, prefix="/projects/{project_id}/workflows", tags=["workflows"])
api_router.include_router(rbac.router, prefix="/projects/{project_id}/rbac", tags=["rbac"])
