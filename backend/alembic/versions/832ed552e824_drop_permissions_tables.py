"""drop_permissions_tables

Revision ID: 832ed552e824
Revises: d4e5f6g7h8i9
Create Date: 2025-12-19 00:45:31.513054

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '832ed552e824'
down_revision: Union[str, None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop role_permissions first (has FK to permissions)
    op.drop_index('ix_role_permissions_permission_id', table_name='role_permissions')
    op.drop_index('ix_role_permissions_role_id', table_name='role_permissions')
    op.drop_table('role_permissions')
    
    # Drop permissions table
    op.drop_index('ix_permissions_project_id', table_name='permissions')
    op.drop_table('permissions')


def downgrade() -> None:
    # Recreate permissions table
    op.create_table('permissions',
        sa.Column('id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('project_id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('name', sa.VARCHAR(length=127), autoincrement=False, nullable=False),
        sa.Column('display_name', sa.VARCHAR(length=127), autoincrement=False, nullable=False),
        sa.Column('description', sa.TEXT(), autoincrement=False, nullable=True),
        sa.Column('category', sa.VARCHAR(length=63), autoincrement=False, nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='permissions_project_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='permissions_pkey'),
        sa.UniqueConstraint('project_id', 'name', name='uq_permissions_project_name')
    )
    op.create_index('ix_permissions_project_id', 'permissions', ['project_id'], unique=False)
    
    # Recreate role_permissions table
    op.create_table('role_permissions',
        sa.Column('id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('role_id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('permission_id', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], name='role_permissions_permission_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name='role_permissions_role_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='role_permissions_pkey'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permissions')
    )
    op.create_index('ix_role_permissions_role_id', 'role_permissions', ['role_id'], unique=False)
    op.create_index('ix_role_permissions_permission_id', 'role_permissions', ['permission_id'], unique=False)
