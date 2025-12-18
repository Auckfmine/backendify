"""
Validation Service - Milestone M
Handles no-code validation rules for fields.
"""
import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.field import Field
from app.models.validation_rule import ValidationRule

RULE_TYPES = {
    "min_length": {"applies_to": ["string"], "config": {"min": "int"}},
    "max_length": {"applies_to": ["string"], "config": {"max": "int"}},
    "regex": {"applies_to": ["string"], "config": {"pattern": "str"}},
    "email": {"applies_to": ["string"], "config": {}},
    "url": {"applies_to": ["string"], "config": {}},
    "min_value": {"applies_to": ["int", "float"], "config": {"min": "number"}},
    "max_value": {"applies_to": ["int", "float"], "config": {"max": "number"}},
    "range": {"applies_to": ["int", "float"], "config": {"min": "number", "max": "number"}},
    "enum": {"applies_to": ["string", "int"], "config": {"values": "list"}},
    "not_empty": {"applies_to": ["string"], "config": {}},
    "uuid": {"applies_to": ["string"], "config": {}},
    "date_format": {"applies_to": ["string"], "config": {"format": "str"}},
    "custom_regex": {"applies_to": ["string"], "config": {"pattern": "str", "flags": "str"}},
}

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
URL_REGEX = re.compile(r"^https?://[^\s/$.?#].[^\s]*$")
UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


def create_validation_rule(
    db: Session,
    field: Field,
    rule_type: str,
    config: dict | None = None,
    error_message: str | None = None,
    priority: int = 0,
) -> ValidationRule:
    """Create a validation rule for a field."""
    if rule_type not in RULE_TYPES:
        raise ValueError(f"Invalid rule type: {rule_type}. Valid types: {list(RULE_TYPES.keys())}")
    
    rule_def = RULE_TYPES[rule_type]
    if field.field_type not in rule_def["applies_to"] and "all" not in rule_def.get("applies_to", []):
        raise ValueError(f"Rule type '{rule_type}' cannot be applied to field type '{field.field_type}'")
    
    rule = ValidationRule(
        field_id=field.id,
        rule_type=rule_type,
        config_json=json.dumps(config) if config else None,
        error_message=error_message,
        priority=priority,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def get_field_rules(db: Session, field_id: str) -> list[ValidationRule]:
    """Get all active validation rules for a field."""
    return db.query(ValidationRule).filter(
        ValidationRule.field_id == field_id,
        ValidationRule.is_active == True,
    ).order_by(ValidationRule.priority).all()


def delete_validation_rule(db: Session, rule: ValidationRule) -> None:
    """Delete a validation rule."""
    db.delete(rule)
    db.commit()


def update_validation_rule(
    db: Session,
    rule: ValidationRule,
    config: dict | None = None,
    error_message: str | None = None,
    priority: int | None = None,
    is_active: bool | None = None,
) -> ValidationRule:
    """Update a validation rule."""
    if config is not None:
        rule.config_json = json.dumps(config) if config else None
    if error_message is not None:
        rule.error_message = error_message
    if priority is not None:
        rule.priority = priority
    if is_active is not None:
        rule.is_active = is_active
    db.commit()
    db.refresh(rule)
    return rule


def validate_value(value: Any, rule: ValidationRule) -> tuple[bool, str | None]:
    """
    Validate a single value against a rule.
    Returns (is_valid, error_message).
    """
    if value is None:
        return True, None
    
    config = json.loads(rule.config_json) if rule.config_json else {}
    rule_type = rule.rule_type
    
    try:
        if rule_type == "min_length":
            min_len = config.get("min", 0)
            if len(str(value)) < min_len:
                return False, rule.error_message or f"Must be at least {min_len} characters"
        
        elif rule_type == "max_length":
            max_len = config.get("max", 255)
            if len(str(value)) > max_len:
                return False, rule.error_message or f"Must be at most {max_len} characters"
        
        elif rule_type == "regex" or rule_type == "custom_regex":
            pattern = config.get("pattern", "")
            flags_str = config.get("flags", "")
            flags = 0
            if "i" in flags_str:
                flags |= re.IGNORECASE
            if "m" in flags_str:
                flags |= re.MULTILINE
            if not re.match(pattern, str(value), flags):
                return False, rule.error_message or f"Does not match required pattern"
        
        elif rule_type == "email":
            if not EMAIL_REGEX.match(str(value)):
                return False, rule.error_message or "Invalid email format"
        
        elif rule_type == "url":
            if not URL_REGEX.match(str(value)):
                return False, rule.error_message or "Invalid URL format"
        
        elif rule_type == "uuid":
            if not UUID_REGEX.match(str(value)):
                return False, rule.error_message or "Invalid UUID format"
        
        elif rule_type == "min_value":
            min_val = config.get("min", 0)
            if float(value) < min_val:
                return False, rule.error_message or f"Must be at least {min_val}"
        
        elif rule_type == "max_value":
            max_val = config.get("max", 0)
            if float(value) > max_val:
                return False, rule.error_message or f"Must be at most {max_val}"
        
        elif rule_type == "range":
            min_val = config.get("min", 0)
            max_val = config.get("max", 0)
            val = float(value)
            if val < min_val or val > max_val:
                return False, rule.error_message or f"Must be between {min_val} and {max_val}"
        
        elif rule_type == "enum":
            allowed = config.get("values", [])
            if value not in allowed:
                return False, rule.error_message or f"Must be one of: {', '.join(map(str, allowed))}"
        
        elif rule_type == "not_empty":
            if not str(value).strip():
                return False, rule.error_message or "Cannot be empty"
        
        elif rule_type == "date_format":
            from datetime import datetime
            fmt = config.get("format", "%Y-%m-%d")
            try:
                datetime.strptime(str(value), fmt)
            except ValueError:
                return False, rule.error_message or f"Invalid date format, expected {fmt}"
        
        return True, None
    
    except Exception as e:
        return False, rule.error_message or f"Validation error: {str(e)}"


def validate_field_value(db: Session, field: Field, value: Any) -> list[str]:
    """
    Validate a value against all rules for a field.
    Returns list of error messages (empty if valid).
    """
    if value is None:
        return []
    
    rules = get_field_rules(db, field.id)
    errors = []
    
    for rule in rules:
        is_valid, error = validate_value(value, rule)
        if not is_valid and error:
            errors.append(error)
    
    return errors


def validate_record(db: Session, fields: list[Field], data: dict[str, Any]) -> dict[str, list[str]]:
    """
    Validate a record against all field rules.
    Returns dict of field_name -> list of errors.
    """
    errors = {}
    
    for field in fields:
        value = data.get(field.sql_column_name) or data.get(field.name)
        field_errors = validate_field_value(db, field, value)
        if field_errors:
            errors[field.name] = field_errors
    
    return errors


def get_available_rule_types() -> list[dict]:
    """Get list of available rule types with metadata."""
    return [
        {
            "type": rule_type,
            "applies_to": info["applies_to"],
            "config_schema": info["config"],
        }
        for rule_type, info in RULE_TYPES.items()
    ]
