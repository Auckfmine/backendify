#!/usr/bin/env python3
"""
Seed script to create the Todo App project in Backendify BaaS.

This script creates:
1. A project named "Todo App"
2. Auth settings with email/password and OTP enabled
3. A "todos" collection with title and completed fields
4. Policies allowing app_user to manage their own todos

Run this from the backend container:
    docker compose exec backend python /app/examples/todo-app/seed_project.py

Or copy it into the container and run it.
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, '/app')

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import User
from app.models.project import Project
from app.models.collection import Collection
from app.models.field import Field
from app.models.policy import Policy
from app.models.auth_settings import AuthSettings
from app.services import schema_manager
from app.core.security import get_password_hash
import uuid


def create_todo_app_project(db: Session, owner_email: str = "admin@example.com"):
    """Create the Todo App project with all necessary configuration."""
    
    # 1. Find or create the admin user
    user = db.query(User).filter(User.email == owner_email).first()
    if not user:
        print(f"Creating admin user: {owner_email}")
        user = User(
            id=str(uuid.uuid4()),
            email=owner_email,
            hashed_password=get_password_hash("admin123"),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"  Created user with ID: {user.id}")
    else:
        print(f"Using existing user: {user.email} (ID: {user.id})")
    
    # 2. Create the project
    project = db.query(Project).filter(Project.name == "Todo App").first()
    if project:
        print(f"Project 'Todo App' already exists with ID: {project.id}")
    else:
        project = Project(
            id=str(uuid.uuid4()),
            name="Todo App",
            description="Example Todo application demonstrating BaaS features",
            owner_id=user.id,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        print(f"Created project 'Todo App' with ID: {project.id}")
    
    # 3. Configure auth settings
    auth_settings = db.query(AuthSettings).filter(AuthSettings.project_id == project.id).first()
    if auth_settings:
        print("Updating auth settings...")
        auth_settings.email_password_enabled = True
        auth_settings.otp_enabled = True
        auth_settings.magic_link_enabled = True
        auth_settings.public_signup_enabled = True
        auth_settings.email_verification_required = False
    else:
        print("Creating auth settings...")
        auth_settings = AuthSettings(
            id=str(uuid.uuid4()),
            project_id=project.id,
            email_password_enabled=True,
            otp_enabled=True,
            magic_link_enabled=True,
            public_signup_enabled=True,
            email_verification_required=False,
            google_oauth_enabled=False,
            github_oauth_enabled=False,
        )
        db.add(auth_settings)
    db.commit()
    print("  Auth settings configured: email/password, OTP, magic link enabled")
    
    # 4. Create the todos collection
    collection = db.query(Collection).filter(
        Collection.project_id == project.id,
        Collection.name == "todos"
    ).first()
    
    if collection:
        print(f"Collection 'todos' already exists with ID: {collection.id}")
    else:
        print("Creating 'todos' collection...")
        collection = Collection(
            id=str(uuid.uuid4()),
            project_id=project.id,
            name="todos",
            display_name="Todos",
            description="User todo items",
        )
        db.add(collection)
        db.commit()
        db.refresh(collection)
        print(f"  Created collection with ID: {collection.id}")
        
        # Create the actual table in the database
        schema_manager.create_collection_table(db, project.id, "todos")
        print("  Created database table for todos")
    
    # 5. Create fields for the collection
    existing_fields = {f.name for f in db.query(Field).filter(Field.collection_id == collection.id).all()}
    
    fields_to_create = [
        {"name": "title", "display_name": "Title", "field_type": "text", "is_required": True},
        {"name": "completed", "display_name": "Completed", "field_type": "boolean", "is_required": False},
    ]
    
    for field_def in fields_to_create:
        if field_def["name"] not in existing_fields:
            field = Field(
                id=str(uuid.uuid4()),
                collection_id=collection.id,
                name=field_def["name"],
                display_name=field_def["display_name"],
                field_type=field_def["field_type"],
                is_required=field_def.get("is_required", False),
                is_unique=False,
                is_indexed=False,
            )
            db.add(field)
            print(f"  Created field: {field_def['name']} ({field_def['field_type']})")
            
            # Add column to the table
            schema_manager.add_column(db, project.id, "todos", field_def["name"], field_def["field_type"])
        else:
            print(f"  Field '{field_def['name']}' already exists")
    
    db.commit()
    
    # 6. Create policies for app_user access
    existing_policies = {p.name for p in db.query(Policy).filter(Policy.collection_id == collection.id).all()}
    
    policies_to_create = [
        {
            "name": "App users can create todos",
            "action": "create",
            "effect": "allow",
            "allowed_principals": "app_user",
            "require_email_verified": False,
        },
        {
            "name": "App users can read own todos",
            "action": "read",
            "effect": "allow",
            "allowed_principals": "app_user",
            "require_email_verified": False,
            "condition_json": '{"created_by_app_user_id": "$current_user_id"}',
        },
        {
            "name": "App users can update own todos",
            "action": "update",
            "effect": "allow",
            "allowed_principals": "app_user",
            "require_email_verified": False,
            "condition_json": '{"created_by_app_user_id": "$current_user_id"}',
        },
        {
            "name": "App users can delete own todos",
            "action": "delete",
            "effect": "allow",
            "allowed_principals": "app_user",
            "require_email_verified": False,
            "condition_json": '{"created_by_app_user_id": "$current_user_id"}',
        },
        {
            "name": "App users can list own todos",
            "action": "list",
            "effect": "allow",
            "allowed_principals": "app_user",
            "require_email_verified": False,
            "condition_json": '{"created_by_app_user_id": "$current_user_id"}',
        },
    ]
    
    for policy_def in policies_to_create:
        if policy_def["name"] not in existing_policies:
            policy = Policy(
                id=str(uuid.uuid4()),
                collection_id=collection.id,
                name=policy_def["name"],
                action=policy_def["action"],
                effect=policy_def["effect"],
                allowed_principals=policy_def.get("allowed_principals"),
                require_email_verified=policy_def.get("require_email_verified", False),
                condition_json=policy_def.get("condition_json"),
                is_active=True,
                priority=0,
            )
            db.add(policy)
            print(f"  Created policy: {policy_def['name']}")
        else:
            print(f"  Policy '{policy_def['name']}' already exists")
    
    db.commit()
    
    print("\n" + "=" * 60)
    print("Todo App project created successfully!")
    print("=" * 60)
    print(f"\nProject ID: {project.id}")
    print(f"\nUpdate your app.js CONFIG with:")
    print(f"  PROJECT_ID: '{project.id}'")
    print("\nAuth methods enabled:")
    print("  - Email/Password login")
    print("  - OTP/Magic Link login")
    print("  - Public signup")
    print("\nCollection: todos")
    print("  Fields: title (text), completed (boolean)")
    print("\nPolicies: App users can CRUD their own todos")
    print("=" * 60)
    
    return project.id


if __name__ == "__main__":
    print("Seeding Todo App project in Backendify BaaS...\n")
    
    db = SessionLocal()
    try:
        project_id = create_todo_app_project(db)
    finally:
        db.close()
