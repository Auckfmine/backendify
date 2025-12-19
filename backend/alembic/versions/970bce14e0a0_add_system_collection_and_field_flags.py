"""add_system_collection_and_field_flags

Revision ID: 970bce14e0a0
Revises: 832ed552e824
Create Date: 2025-12-19 01:02:57.755571

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '970bce14e0a0'
down_revision: Union[str, None] = '832ed552e824'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_system flag to collections (for system collections like _users)
    op.add_column('collections', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))
    
    # Add is_system and is_hidden flags to fields
    op.add_column('fields', sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('fields', sa.Column('is_hidden', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('fields', 'is_hidden')
    op.drop_column('fields', 'is_system')
    op.drop_column('collections', 'is_system')
