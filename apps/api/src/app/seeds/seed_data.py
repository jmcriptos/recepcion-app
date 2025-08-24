"""Main seed data script for development environment."""
import click
from flask.cli import with_appcontext
from app.models import db
from .users import seed_users, clear_users


@click.command()
@with_appcontext
def seed_all():
    """Seed all development data."""
    click.echo('Starting database seeding...')
    
    try:
        # Ensure all tables exist
        db.create_all()
        click.echo('Database tables verified.')
        
        # Seed users
        click.echo('Seeding users...')
        seed_users()
        
        click.echo('✅ Database seeding completed successfully!')
        
    except Exception as e:
        click.echo(f'❌ Error during seeding: {e}')
        raise


@click.command()
@with_appcontext
def clear_all():
    """Clear all seeded data (WARNING: This will delete data!)."""
    if click.confirm('This will delete all seeded data. Are you sure?'):
        click.echo('Clearing all seeded data...')
        
        try:
            clear_users()
            click.echo('✅ All seeded data cleared successfully!')
            
        except Exception as e:
            click.echo(f'❌ Error during clearing: {e}')
            raise
    else:
        click.echo('Operation cancelled.')


@click.command()
@with_appcontext  
def seed_users_only():
    """Seed only users data."""
    click.echo('Seeding users only...')
    
    try:
        db.create_all()
        seed_users()
        click.echo('✅ Users seeded successfully!')
        
    except Exception as e:
        click.echo(f'❌ Error seeding users: {e}')
        raise