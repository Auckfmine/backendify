"""add rbac tables

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2024-12-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(63), nullable=False),
        sa.Column('display_name', sa.String(127), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('project_id', 'name', name='uq_roles_project_name'),
    )
    op.create_index('ix_roles_project_id', 'roles', ['project_id'])

    # Create permissions table
    op.create_table(
        'permissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(127), nullable=False),
        sa.Column('display_name', sa.String(127), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(63), nullable=False, default='general'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('project_id', 'name', name='uq_permissions_project_name'),
    )
    op.create_index('ix_permissions_project_id', 'permissions', ['project_id'])

    # Create role_permissions junction table
    op.create_table(
        'role_permissions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('permission_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permissions'),
    )
    op.create_index('ix_role_permissions_role_id', 'role_permissions', ['role_id'])
    op.create_index('ix_role_permissions_permission_id', 'role_permissions', ['permission_id'])

    # Create app_user_roles junction table
    op.create_table(
        'app_user_roles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('app_user_id', sa.String(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('assigned_by', sa.String(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['app_user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('app_user_id', 'role_id', name='uq_app_user_roles'),
    )
    op.create_index('ix_app_user_roles_app_user_id', 'app_user_roles', ['app_user_id'])
    op.create_index('ix_app_user_roles_role_id', 'app_user_roles', ['role_id'])

    # Add allowed_roles column to policies table for RBAC integration
    op.add_column('policies', sa.Column('allowed_roles', sa.String(512), nullable=True))


def downgrade() -> None:
    # Remove allowed_roles from policies
    op.drop_column('policies', 'allowed_roles')
    
    # Drop tables in reverse order
    op.drop_index('ix_app_user_roles_role_id', 'app_user_roles')
    op.drop_index('ix_app_user_roles_app_user_id', 'app_user_roles')
    op.drop_table('app_user_roles')
    
    op.drop_index('ix_role_permissions_permission_id', 'role_permissions')
    op.drop_index('ix_role_permissions_role_id', 'role_permissions')
    op.drop_table('role_permissions')
    
    op.drop_index('ix_permissions_project_id', 'permissions')
    op.drop_table('permissions')
    
    op.drop_index('ix_roles_project_id', 'roles')
    op.drop_table('roles')
