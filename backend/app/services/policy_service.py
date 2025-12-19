import json
from typing import Any, TYPE_CHECKING

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.collection import Collection
from app.models.policy import Policy
from app.models.user import User

if TYPE_CHECKING:
    from app.api.deps import Principal

VALID_ACTIONS = frozenset(["create", "read", "update", "delete", "list"])
VALID_EFFECTS = frozenset(["allow", "deny"])
VALID_PRINCIPALS = frozenset(["admin_user", "app_user", "api_key", "anonymous"])
DEFAULT_ALLOWED_PRINCIPALS = ["admin_user", "api_key"]


def create_policy(
    db: Session,
    collection: Collection,
    name: str,
    action: str,
    effect: str = "allow",
    condition_json: str | None = None,
    priority: int = 0,
    allowed_principals: str | None = None,
    require_email_verified: bool = False,
    allowed_roles: str | None = None,
) -> Policy:
    if action not in VALID_ACTIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action. Must be one of: {', '.join(VALID_ACTIONS)}",
        )
    
    if effect not in VALID_EFFECTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid effect. Must be one of: {', '.join(VALID_EFFECTS)}",
        )
    
    # Validate allowed_principals if provided
    if allowed_principals:
        principals = [p.strip() for p in allowed_principals.split(",") if p.strip()]
        for p in principals:
            if p not in VALID_PRINCIPALS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid principal '{p}'. Must be one of: {', '.join(VALID_PRINCIPALS)}",
                )
    
    if condition_json:
        try:
            json.loads(condition_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid condition JSON",
            )
    
    policy = Policy(
        collection_id=collection.id,
        name=name,
        action=action,
        effect=effect,
        condition_json=condition_json,
        priority=priority,
        is_active=True,
        allowed_principals=allowed_principals,
        require_email_verified=require_email_verified,
        allowed_roles=allowed_roles,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


def list_policies(db: Session, collection: Collection) -> list[Policy]:
    return (
        db.query(Policy)
        .filter(Policy.collection_id == collection.id, Policy.is_active == True)
        .order_by(Policy.priority.desc())
        .all()
    )


def get_policy(db: Session, collection: Collection, policy_id: str) -> Policy:
    policy = db.query(Policy).filter(
        Policy.id == policy_id,
        Policy.collection_id == collection.id,
    ).first()
    if not policy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Policy not found",
        )
    return policy


def update_policy(
    db: Session,
    policy: Policy,
    name: str | None = None,
    effect: str | None = None,
    condition_json: str | None = None,
    priority: int | None = None,
    is_active: bool | None = None,
    allowed_principals: str | None = None,
    require_email_verified: bool | None = None,
    allowed_roles: str | None = None,
) -> Policy:
    if effect is not None and effect not in VALID_EFFECTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid effect. Must be one of: {', '.join(VALID_EFFECTS)}",
        )
    
    if allowed_principals is not None:
        principals = [p.strip() for p in allowed_principals.split(",") if p.strip()]
        for p in principals:
            if p not in VALID_PRINCIPALS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid principal '{p}'. Must be one of: {', '.join(VALID_PRINCIPALS)}",
                )
    
    if condition_json is not None:
        try:
            json.loads(condition_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid condition JSON",
            )
    
    if name is not None:
        policy.name = name
    if effect is not None:
        policy.effect = effect
    if condition_json is not None:
        policy.condition_json = condition_json
    if priority is not None:
        policy.priority = priority
    if is_active is not None:
        policy.is_active = is_active
    if allowed_principals is not None:
        policy.allowed_principals = allowed_principals
    if require_email_verified is not None:
        policy.require_email_verified = require_email_verified
    if allowed_roles is not None:
        policy.allowed_roles = allowed_roles
    
    db.commit()
    db.refresh(policy)
    return policy


def delete_policy(db: Session, policy: Policy) -> None:
    db.delete(policy)
    db.commit()


def check_permission(
    db: Session,
    collection: Collection,
    action: str,
    user: User | None,
    record: dict[str, Any] | None = None,
) -> bool:
    """Legacy permission check for admin users."""
    policies = list_policies(db, collection)
    
    if not policies:
        return True
    
    for policy in policies:
        if policy.action != action:
            continue
        
        if policy.condition_json:
            condition = json.loads(policy.condition_json)
            if not _evaluate_condition(condition, user, record):
                continue
        
        return policy.effect == "allow"
    
    return True


def check_permission_for_principal(
    db: Session,
    collection: Collection,
    action: str,
    principal: "Principal",
    record: dict[str, Any] | None = None,
) -> bool:
    """
    Check if a principal has permission to perform an action.
    
    This checks:
    1. Admin users always have full access (they own the project)
    2. If the principal type is in allowed_principals for the policy
    3. If require_email_verified is set and principal has verified email
    4. If allowed_roles is set, check app_user has at least one required role
    5. If condition_json evaluates to true
    """
    # Admin users (console users) always have full access to their project data
    if principal.type == "admin_user":
        return True
    
    policies = list_policies(db, collection)
    
    # If no policies, default to allowing admin_user and api_key only
    if not policies:
        return principal.type in DEFAULT_ALLOWED_PRINCIPALS
    
    for policy in policies:
        if policy.action != action:
            continue
        
        # Check allowed principals
        allowed = _get_allowed_principals(policy)
        if principal.type not in allowed:
            continue
        
        # Check email verification requirement
        if policy.require_email_verified and not principal.is_email_verified:
            continue
        
        # Check RBAC roles (only applies to app_user principals)
        if policy.allowed_roles and principal.type == "app_user":
            if not _check_user_has_role(db, principal, policy.allowed_roles):
                continue
        
        # Check condition
        if policy.condition_json:
            condition = json.loads(policy.condition_json)
            if not _evaluate_condition_for_principal(condition, principal, record):
                continue
        
        return policy.effect == "allow"
    
    # No matching policy - deny by default for security
    return False


def _check_user_has_role(db: Session, principal: "Principal", allowed_roles: str) -> bool:
    """Check if the app user has at least one of the allowed roles."""
    if not principal.app_user:
        return False
    
    # Parse allowed roles from comma-separated string
    required_roles = {r.strip() for r in allowed_roles.split(",") if r.strip()}
    if not required_roles:
        return True  # No roles required
    
    # Import here to avoid circular imports
    from app.services.rbac_service import get_user_roles
    
    # Get user's assigned roles
    user_roles = get_user_roles(db, principal.app_user)
    user_role_names = {role.name for role in user_roles}
    
    # Check if user has at least one required role
    return bool(required_roles & user_role_names)


def _get_allowed_principals(policy: Policy) -> list[str]:
    """Get list of allowed principals for a policy."""
    if not policy.allowed_principals:
        return DEFAULT_ALLOWED_PRINCIPALS
    return [p.strip() for p in policy.allowed_principals.split(",") if p.strip()]


def _evaluate_condition(
    condition: dict[str, Any],
    user: User | None,
    record: dict[str, Any] | None,
) -> bool:
    """Legacy condition evaluation for admin users."""
    cond_type = condition.get("type")
    
    if cond_type == "authenticated":
        return user is not None
    
    if cond_type == "owner":
        if user is None or record is None:
            return False
        owner_field = condition.get("field", "created_by_user_id")
        return record.get(owner_field) == user.id
    
    if cond_type == "field_equals":
        if record is None:
            return False
        field = condition.get("field")
        value = condition.get("value")
        return record.get(field) == value
    
    if cond_type == "and":
        sub_conditions = condition.get("conditions", [])
        return all(_evaluate_condition(c, user, record) for c in sub_conditions)
    
    if cond_type == "or":
        sub_conditions = condition.get("conditions", [])
        return any(_evaluate_condition(c, user, record) for c in sub_conditions)
    
    if cond_type == "not":
        sub_condition = condition.get("condition", {})
        return not _evaluate_condition(sub_condition, user, record)
    
    return True


def _evaluate_condition_for_principal(
    condition: dict[str, Any],
    principal: "Principal",
    record: dict[str, Any] | None,
) -> bool:
    """Evaluate condition for any principal type."""
    cond_type = condition.get("type")
    
    if cond_type == "authenticated":
        return principal.is_authenticated
    
    if cond_type == "owner":
        if not principal.user_id or record is None:
            return False
        owner_field = condition.get("field", "created_by_app_user_id")
        return record.get(owner_field) == principal.user_id
    
    if cond_type == "app_user_owner":
        # Specifically check app user ownership
        if not principal.app_user or record is None:
            return False
        owner_field = condition.get("field", "created_by_app_user_id")
        return record.get(owner_field) == principal.app_user.id
    
    if cond_type == "field_equals":
        if record is None:
            return False
        field = condition.get("field")
        value = condition.get("value")
        # Support principal references in value
        if value == "principal.user_id":
            value = principal.user_id
        elif value == "principal.email":
            value = principal.email
        elif value == "principal.app_user_id" and principal.app_user:
            value = principal.app_user.id
        return record.get(field) == value
    
    if cond_type == "and":
        sub_conditions = condition.get("conditions", [])
        return all(_evaluate_condition_for_principal(c, principal, record) for c in sub_conditions)
    
    if cond_type == "or":
        sub_conditions = condition.get("conditions", [])
        return any(_evaluate_condition_for_principal(c, principal, record) for c in sub_conditions)
    
    if cond_type == "not":
        sub_condition = condition.get("condition", {})
        return not _evaluate_condition_for_principal(sub_condition, principal, record)
    
    return True
