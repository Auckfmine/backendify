"""Drop app_users table and remove FK constraints

App users are now stored in the _users collection within each project's schema.
This migration removes the old app_users table and updates related tables
to remove their FK constraints to app_users.

Revision ID: drop_app_users_001
Revises: 970bce14e0a0
Create Date: 2025-12-19
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'drop_app_users_001'
down_revision = '970bce14e0a0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK constraints from tables that reference app_users
    # Use raw SQL with IF EXISTS to handle cases where constraints may not exist
    
    conn = op.get_bind()
    
    # Drop FK constraints if they exist
    constraints_to_drop = [
        ('app_refresh_tokens', 'app_refresh_tokens_app_user_id_fkey'),
        ('app_identities', 'app_identities_app_user_id_fkey'),
        ('app_email_tokens', 'app_email_tokens_app_user_id_fkey'),
        ('app_user_roles', 'app_user_roles_app_user_id_fkey'),
        ('audit_events', 'audit_events_actor_app_user_id_fkey'),
    ]
    
    for table, constraint in constraints_to_drop:
        conn.execute(sa.text(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}'))
    
    # Now drop the app_users table if it exists
    conn.execute(sa.text('DROP TABLE IF EXISTS app_users CASCADE'))


def downgrade() -> None:
    # Recreate app_users table
    op.create_table(
        'app_users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_disabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('project_id', 'email', name='uq_app_users_project_email'),
    )
    op.create_index('ix_app_users_project_id', 'app_users', ['project_id'])
    op.create_index('ix_app_users_email', 'app_users', ['email'])
    
    # Recreate FK constraints
    op.create_foreign_key(
        'app_refresh_tokens_app_user_id_fkey', 'app_refresh_tokens', 'app_users',
        ['app_user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'app_identities_app_user_id_fkey', 'app_identities', 'app_users',
        ['app_user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'app_email_tokens_app_user_id_fkey', 'app_email_tokens', 'app_users',
        ['app_user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'app_user_roles_app_user_id_fkey', 'app_user_roles', 'app_users',
        ['app_user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'audit_events_actor_app_user_id_fkey', 'audit_events', 'app_users',
        ['actor_app_user_id'], ['id']
    )
