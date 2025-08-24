"""Integration tests for seed data functionality."""
import pytest
from app.models import db, User
from app.seeds.users import seed_users, clear_users


class TestSeedData:
    """Test seed data scripts and CLI commands."""
    
    def test_seed_users_function(self, app):
        """Test seed_users function creates expected users."""
        with app.app_context():
            # Ensure no users exist initially
            assert User.query.count() == 0
            
            # Run seed function
            seed_users()
            
            # Verify users were created
            users = User.query.all()
            assert len(users) == 5  # 3 operators + 2 supervisors
            
            # Verify operators
            operators = User.query.filter_by(role='operator').all()
            assert len(operators) == 3
            operator_names = [user.name for user in operators]
            expected_operators = ['juan_operator', 'maria_operator', 'carlos_operator']
            assert all(name in operator_names for name in expected_operators)
            
            # Verify supervisors
            supervisors = User.query.filter_by(role='supervisor').all()
            assert len(supervisors) == 2
            supervisor_names = [user.name for user in supervisors]
            expected_supervisors = ['ana_supervisor', 'luis_supervisor']
            assert all(name in supervisor_names for name in expected_supervisors)
    
    def test_seed_users_skips_if_users_exist(self, app, sample_user):
        """Test seed_users skips seeding if users already exist."""
        with app.app_context():
            initial_count = User.query.count()
            assert initial_count > 0  # sample_user fixture created a user
            
            # Run seed function
            seed_users()
            
            # Verify no additional users were created
            final_count = User.query.count()
            assert final_count == initial_count
    
    def test_clear_users_function(self, app):
        """Test clear_users function removes all users."""
        with app.app_context():
            # Create some test users
            seed_users()
            assert User.query.count() > 0
            
            # Clear users
            clear_users()
            
            # Verify all users were deleted
            assert User.query.count() == 0
    
    def test_clear_users_handles_empty_database(self, app):
        """Test clear_users handles empty database gracefully."""
        with app.app_context():
            assert User.query.count() == 0
            
            # Clear users from empty database
            clear_users()  # Should not raise error
            
            assert User.query.count() == 0
    
    def test_seed_all_cli_command(self, app, runner):
        """Test seed-all CLI command."""
        with app.app_context():
            # Run CLI command
            result = runner.invoke(args=['seed-all'])
            
            # Verify command succeeded
            assert result.exit_code == 0
            assert '✅ Database seeding completed successfully!' in result.output
            
            # Verify users were created
            assert User.query.count() == 5
    
    def test_seed_users_only_cli_command(self, app, runner):
        """Test seed-users-only CLI command."""
        with app.app_context():
            # Run CLI command
            result = runner.invoke(args=['seed-users-only'])
            
            # Verify command succeeded
            assert result.exit_code == 0
            assert '✅ Users seeded successfully!' in result.output
            
            # Verify users were created
            assert User.query.count() == 5
    
    def test_clear_all_cli_command(self, app, runner):
        """Test clear-all CLI command."""
        with app.app_context():
            # First seed some data
            seed_users()
            assert User.query.count() > 0
            
            # Run clear command with confirmation
            result = runner.invoke(args=['clear-all'], input='y\n')
            
            # Verify command succeeded
            assert result.exit_code == 0
            assert '✅ All seeded data cleared successfully!' in result.output
            
            # Verify data was cleared
            assert User.query.count() == 0
    
    def test_clear_all_cli_command_cancelled(self, app, runner):
        """Test clear-all CLI command when cancelled."""
        with app.app_context():
            # First seed some data
            seed_users()
            initial_count = User.query.count()
            assert initial_count > 0
            
            # Run clear command but cancel
            result = runner.invoke(args=['clear-all'], input='n\n')
            
            # Verify command was cancelled
            assert result.exit_code == 0
            assert 'Operation cancelled.' in result.output
            
            # Verify data was not cleared
            assert User.query.count() == initial_count
    
    def test_user_properties_after_seeding(self, app):
        """Test that seeded users have correct properties."""
        with app.app_context():
            seed_users()
            
            users = User.query.all()
            for user in users:
                # All users should be active by default
                assert user.is_active is True
                
                # All users should have created_at timestamp
                assert user.created_at is not None
                
                # No users should have last_login initially
                assert user.last_login is None
                
                # User ID should be set
                assert user.id is not None
                
                # Role should be valid
                assert user.role in ['operator', 'supervisor']
                
                # Name should not be empty
                assert user.name and len(user.name) > 0
    
    def test_seed_data_idempotency(self, app):
        """Test that running seed multiple times is safe."""
        with app.app_context():
            # Run seed multiple times
            seed_users()
            first_count = User.query.count()
            
            seed_users()  # Second run
            second_count = User.query.count()
            
            seed_users()  # Third run
            third_count = User.query.count()
            
            # Count should remain the same
            assert first_count == second_count == third_count == 5