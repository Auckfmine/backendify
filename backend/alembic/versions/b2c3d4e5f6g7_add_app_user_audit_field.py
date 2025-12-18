"""add app user audit field

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2025-12-17 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add actor_app_user_id column to audit_events
    op.add_column('audit_events', sa.Column('actor_app_user_id', sa.String(), nullable=True))
    op.create_index('ix_audit_events_actor_app_user_id', 'audit_events', ['actor_app_user_id'])
    op.create_foreign_key(
        'fk_audit_events_actor_app_user_id',
        'audit_events',
        'app_users',
        ['actor_app_user_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # Increase action column size (if needed - PostgreSQL handles this gracefully)
    op.alter_column('audit_events', 'action',
                    existing_type=sa.String(16),
                    type_=sa.String(32),
                    existing_nullable=False)


def downgrade() -> None:
    op.drop_constraint('fk_audit_events_actor_app_user_id', 'audit_events', type_='foreignkey')
    op.drop_index('ix_audit_events_actor_app_user_id', table_name='audit_events')
    op.drop_column('audit_events', 'actor_app_user_id')
    op.alter_column('audit_events', 'action',
                    existing_type=sa.String(32),
                    type_=sa.String(16),
                    existing_nullable=False)
