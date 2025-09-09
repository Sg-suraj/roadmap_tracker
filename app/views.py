from flask import Blueprint, render_template
from google.cloud.firestore_v1.base_query import FieldFilter
from app import db # The Firestore client

main = Blueprint('main', __name__)

@main.route('/')
def index():
    """Renders the main dashboard page."""
    weeks_ref = db.collection('weeks').order_by('week_number').stream()
    weeks = [doc.to_dict() for doc in weeks_ref]
    
    # Pass the weeks and the correct page_type to the template
    return render_template('index.html', weeks=weeks, page_type='dashboard')

@main.route('/week/<int:week_number>')
def week_board(week_number):
    """Renders the Kanban board for a specific week."""
    # Safely find the week document by querying the week_number field
    week_query = db.collection('weeks').where(
        filter=FieldFilter('week_number', '==', week_number)
    ).limit(1).stream()
    
    week_list = list(week_query)
    week_doc = week_list[0] if week_list else None
    
    # If the week exists in the database, use its data. Otherwise, create a default.
    if week_doc:
        week_data = week_doc.to_dict()
    else:
        week_data = {
            'week_number': week_number, 
            'title': f'Week {week_number}', 
            'goal': 'No goal set for this week.'
        }
    
    # Pass the specific week's data and the correct page_type to the board template
    return render_template('board.html', week=week_data, page_type='week_board')