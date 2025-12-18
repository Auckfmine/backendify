"""add app user auth tables

Revision ID: a1b2c3d4e5f6
Revises: d20a13efde47
Create Date: 2025-12-17 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f64d1b2603c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # App Users table
    op.create_table(
        'app_users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_disabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'email', name='uq_app_users_project_email')
    )
    op.create_index('ix_app_users_project_id', 'app_users', ['project_id'])
    op.create_index('ix_app_users_email', 'app_users', ['email'])

    # App Refresh Tokens table
    op.create_table(
        'app_refresh_tokens',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('app_user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['app_user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_app_refresh_tokens_project_id', 'app_refresh_tokens', ['project_id'])
    op.create_index('ix_app_refresh_tokens_app_user_id', 'app_refresh_tokens', ['app_user_id'])
    op.create_index('ix_app_refresh_tokens_token_hash', 'app_refresh_tokens', ['token_hash'], unique=True)

    # Project Auth Settings table
    op.create_table(
        'project_auth_settings',
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('enable_email_password', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('enable_magic_link', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_otp', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_oauth_google', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('enable_oauth_github', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('access_ttl_minutes', sa.Integer(), nullable=False, server_default='15'),
        sa.Column('refresh_ttl_days', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('session_mode', sa.String(), nullable=False, server_default='header'),
        sa.Column('allow_public_signup', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('require_email_verification', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id')
    )

    # App OTP Codes table
    op.create_table(
        'app_otp_codes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('purpose', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_app_otp_codes_project_id', 'app_otp_codes', ['project_id'])
    op.create_index('ix_app_otp_codes_email', 'app_otp_codes', ['email'])

    # App Identities table (OAuth)
    op.create_table(
        'app_identities',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('app_user_id', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_user_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['app_user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'provider', 'provider_user_id', name='uq_app_identities_provider')
    )
    op.create_index('ix_app_identities_project_id', 'app_identities', ['project_id'])
    op.create_index('ix_app_identities_app_user_id', 'app_identities', ['app_user_id'])

    # App Email Tokens table
    op.create_table(
        'app_email_tokens',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('app_user_id', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('purpose', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['app_user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_app_email_tokens_project_id', 'app_email_tokens', ['project_id'])
    op.create_index('ix_app_email_tokens_app_user_id', 'app_email_tokens', ['app_user_id'])
    op.create_index('ix_app_email_tokens_token_hash', 'app_email_tokens', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_table('app_email_tokens')
    op.drop_table('app_identities')
    op.drop_table('app_otp_codes')
    op.drop_table('project_auth_settings')
    op.drop_table('app_refresh_tokens')
    op.drop_table('app_users')
