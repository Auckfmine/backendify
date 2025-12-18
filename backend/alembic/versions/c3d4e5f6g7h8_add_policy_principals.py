"""add policy principals

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add allowed_principals column to policies
    op.add_column('policies', sa.Column('allowed_principals', sa.String(128), nullable=True))
    # Add require_email_verified column to policies
    op.add_column('policies', sa.Column('require_email_verified', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('policies', 'require_email_verified')
    op.drop_column('policies', 'allowed_principals')
